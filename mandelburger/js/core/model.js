// From a problem description to compiled pieces.
//
// A problem is plain data (it travels to workers):
//   { expr: 'c1*f^2 + sin(x)', params: {c1: [re, im], r1: 0.3, n1: 2},
//     axes: ['c1.re', 'c1.im'], T: 1, start: 'crit' | 'zero', uv: [u, v] }
//
// `axes` names the two real coordinates of the parameter plane: 'cK.re', 'cK.im'
// or 'rK'. Inside compiled code they are the variables u, v; every other
// parameter is a compile-time constant (integer parameters nK in particular, so
// f^n1 becomes an unrolled product).

import { parse, describe, diff, evaluate, compileSampled, newHoist, bindHoisted, lit, ExprError } from './expr.js';

/** All real coordinates a plane axis can be bound to, for a described expression. */
export function coordinatesOf(info) {
  const out = [];
  for (const c of info.c) out.push({ id: `${c}.re`, label: `Re ${c}`, param: c, part: 're' }, { id: `${c}.im`, label: `Im ${c}`, param: c, part: 'im' });
  for (const r of info.r) out.push({ id: r, label: r, param: r, part: 'val' });
  // the starting point of the orbit: a z0 plane is a fibre Julia set (MATH.md §2a)
  out.push({ id: 'z0.re', label: 'Re z₀', param: 'z0', part: 're' }, { id: 'z0.im', label: 'Im z₀', param: 'z0', part: 'im' });
  return out;
}

const isComplex = (name) => name[0] === 'c' || name === 'z0';
export const isZ0Axis = (axes) => (axes || []).some((id) => id.startsWith('z0.'));

export function defaultValue(name) {
  if (isComplex(name)) return [0, 0];
  if (name[0] === 'n') return 2;
  return 0;
}

export function getCoord(params, id) {
  const [name, part] = id.split('.');
  const v = params[name] ?? defaultValue(name);
  if (isComplex(name)) return part === 'im' ? v[1] : v[0];
  return v;
}

export function setCoord(params, id, value) {
  const [name, part] = id.split('.');
  if (isComplex(name)) {
    const v = [...(params[name] ?? [0, 0])];
    v[part === 'im' ? 1 : 0] = value;
    params[name] = v;
  } else params[name] = value;
}

export const uvOf = (prob) => [getCoord(prob.params, prob.axes[0]), getCoord(prob.params, prob.axes[1])];

/**
 * Parse, differentiate and bind a problem.
 * Returns {ast, D, D2, info, env, dyn, affine}:
 *   D = dF/df, D2 = d²F/df², env = values of fixed names, dyn = JS names of
 *   the per-evaluation variables (f -> zr, zi; plane coordinates -> u, v).
 */
export function buildModel(prob) {
  const ast = parse(prob.expr);
  const info = describe(ast);
  const D = diff(ast, 'f');
  const D2 = diff(D, 'f');
  const env = { T: [prob.T, 0] };
  const val = (name) => prob.params[name] ?? defaultValue(name);
  for (const c of info.c) { const v = val(c); env[c] = [v[0], v[1]]; }
  for (const r of info.r) env[r] = [val(r), 0];
  for (const n of info.n) {
    const v = val(n);
    if (!Number.isInteger(v)) throw new ExprError(`${n} must be an integer`);
    env[n] = [v, 0];
  }
  const ids = coordinatesOf(info).map((c) => c.id);
  const [ax, ay] = prob.axes || [];
  const axisVar = (id) => (id === ax ? 'u' : id === ay ? 'v' : null);
  const dyn = { f: { r: 'zr', i: 'zi' } };
  if (ax && ay && ids.includes(ax) && ids.includes(ay)) {
    for (const c of info.c) {
      const re = axisVar(`${c}.re`), im = axisVar(`${c}.im`);
      if (!re && !im) continue;
      dyn[c] = { r: re || lit(env[c][0]), i: im || (env[c][1] === 0 ? null : lit(env[c][1])) };
    }
    for (const r of info.r) {
      const a = axisVar(r);
      if (a) dyn[r] = { r: a, i: null };
    }
  }
  const affine = !D.vars.has('f');
  // linear-homogeneous F = g(x) f (a multiplicative cocycle): f = 0 is invariant
  let homogeneous = false;
  if (affine) {
    homogeneous = true;
    // the plane coordinates vary per pixel, so probe them at several values as well
    const axisNames = Object.keys(dyn).filter((n) => n !== 'f');
    for (let k = 0; k < 7 && homogeneous; k++) {
      const e = { ...env, f: [0, 0], x: [0.37 + 0.9 * k, 0] };
      for (const n of axisNames) e[n] = [env[n][0] + 0.31 * k - 0.7, info.c.includes(n) ? env[n][1] + 0.23 * k - 0.5 : 0];
      const v = evaluate(ast, e);
      if (Math.hypot(v[0], v[1]) > 1e-12) homogeneous = false;
    }
  }
  const additive = D.k === 'num' && D.re === 1 && D.im === 0; // F = f + L(x)
  return { ast, D, D2, info, env, dyn, affine, homogeneous, additive };
}

/** 'mult' for F = g(x) f, 'add' for F = f + L(x), else null (MATH.md §14) */
export function cocycleKindOf(model) {
  return model.homogeneous ? 'mult' : model.additive ? 'add' : null;
}

/**
 * fill(u, v, zR, zI, off, NR, NI, DR, DI, oOff, M): F and dF/df at the M sample
 * points xs, for states z = zR/zI[off + n].
 */
export function makeGridFill(model, xs) {
  const hoist = newHoist();
  const s = compileSampled([model.ast, model.D], xs, model.dyn, model.env, hoist);
  const [F, D] = s.res;
  const body = `return function fill(u, v, zR, zI, off, NR, NI, DR, DI, oOff, M) {
${s.pre}
  for (let n = 0; n < M; n++) {
    const zr = zR[off + n], zi = zI[off + n];
${s.code}
    NR[oOff + n] = ${F.r}; NI[oOff + n] = ${F.i};
    DR[oOff + n] = ${D.r}; DI[oOff + n] = ${D.i};
  }
};`;
  return bindHoisted(hoist, body);
}
