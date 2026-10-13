// Expression language for the right-hand side F of
//
//        f(x + T) = F(f, x; c1, c2, …, r1, r2, …, n1, n2, …)
//
// Names:  f      the unknown, evaluated at x (complex state z in the orbit)
//         x      base angle (real)
//         cK     complex parameters        rK  real parameters
//         nK     integer parameters        T   the rotation (constant)
//         pi, tau, e, i
// Functions: sin cos tan exp log/ln sqrt sinh cosh tanh cis pow, kepler(e, M) (the
// eccentric anomaly E with E - e sin E = M), mean/gmean (averages over x, by
// quadrature), the exact geometric means gmean1(c, p, q), tgmean(a, e, c),
// kgmean(a, e, c) (closed forms, MATH.md §14.6), the angle stretchings
// arnold(e, x) mobius(a, x) hooke(k, x) pendulum(m, x) (lifts of circle
// diffeomorphisms: E(x + 2pi) = E(x) + 2pi; MATH.md §14.6a), and the non-holomorphic
// abs conj re im arg (allowed only where f does not appear).
// Implicit multiplication: 2x, 3sin(x), 2f.
//
//   parse(src)                 -> AST (every node carries .vars and a structural .key)
//   describe(ast)              -> which parameters and variables occur
//   diff(ast, 'f')             -> AST of dF/df (symbolic, lightly simplified)
//   evaluate(ast, env)         -> [re, im]              reference interpreter
//   compileFixed(ast, env)     -> (x, out) => void      everything but x fixed
//   compileSampled(asts, xs, dyn, env, hoist)          loop-invariant code motion
//
// compileSampled is the performance-critical piece. Heavy loops evaluate F at a
// fixed list of base points x_n (orbit times nT, or a Fourier grid) while only a
// few "dynamic" names change: the state f and the one or two parameter-plane
// coordinates. Subtrees free of dynamic names are constant-folded (no x) or
// precomputed into arrays over the sample points (with x). Common subexpressions
// are shared through structural keys, so F and dF/df computed together cost
// little more than F. The remainder is emitted as straight-line JS.

import * as Cx from './complex.js';

export class ExprError extends Error {}

const FUNCS = {
  sin: 1, cos: 1, tan: 1, exp: 1, log: 1, ln: 1, sqrt: 1, sinh: 1, cosh: 1, tanh: 1,
  abs: 1, conj: 1, re: 1, im: 1, arg: 1, cis: 1, pow: 2, kepler: 2, mean: 1, gmean: 1,
  gmean1: 3, tgmean: 3, kgmean: 3,
  arnold: 2, mobius: 2, hooke: 2, pendulum: 2,
};
// mean(e)  = (1/2pi) ∫ e dx           over one period in x
// gmean(e) = exp((1/2pi) ∫ log e dx)  with log continued along x from its principal value at x = 0
// Both are constants in x; their argument may use parameters but not f.
export const AVERAGES = new Set(['mean', 'gmean']);

/**
 * Reference shown in the app ("Functions and names"): [label, description, text to insert].
 * tests/core.test.js checks that every function in FUNCS is documented here.
 */
export const FUNCTION_DOCS = [
  { group: 'Names', items: [
    ['f', 'the unknown f(x): the state of the orbit', 'f'],
    ['x', 'the base angle', 'x'],
    ['T', 'the rotation step (Rotation panel)', 'T'],
    ['c1, c2, …', 'complex parameters; a Re/Im field appears for each', 'c1'],
    ['r1, r2, …', 'real parameters', 'r1'],
    ['n1, n2, …', 'integer parameters (f^n1 is unrolled exactly)', 'n1'],
    ['pi, tau, e, i', 'π, 2π, Euler’s number, √−1', 'pi'],
  ] },
  { group: 'Operators', items: [
    ['+  −  *  /  ^', 'complex arithmetic; integer powers are exact', '^'],
    ['2f, 3sin(x)', 'implicit multiplication', ''],
  ] },
  { group: 'Elementary functions (complex)', items: [
    ['sin cos tan', 'trigonometric', 'sin(x)'],
    ['sinh cosh tanh', 'hyperbolic', 'tanh(f)'],
    ['exp(z)', 'exponential', 'exp(f)'],
    ['log(z), ln(z)', 'principal logarithm', 'log(f)'],
    ['sqrt(z)', 'principal square root', 'sqrt(f)'],
    ['cis(t)', 'e^{it} = cos t + i sin t', 'cis(x)'],
    ['pow(a, b)', 'a^b', 'pow(f, 2)'],
  ] },
  { group: 'Not holomorphic (only in parts without f)', items: [
    ['abs(z)', '|z|', 'abs(c1)'],
    ['re(z), im(z)', 'real and imaginary part', 're(c1)'],
    ['arg(z)', 'argument in (−π, π]', 'arg(c1)'],
    ['conj(z)', 'complex conjugate', 'conj(c1)'],
  ] },
  { group: 'Averages over x (constants of the parameters; no f inside)', items: [
    ['mean(e)', 'mean of e over x ∈ [0, 2π), by quadrature', 'mean(sin(x)^2)'],
    ['gmean(e)', 'geometric mean exp(mean log e); f*g/gmean(g) is cramped', 'gmean(r1 + sin(x))'],
  ] },
  { group: 'Exact geometric means (closed forms)', items: [
    ['gmean1(c, p, q)', 'of c + p·eⁱˣ + q·e⁻ⁱˣ (Jensen’s formula)', 'gmean1(c1, r1, r2)'],
    ['tgmean(a, e, c)', 'of a Kepler orbit by true anomaly: a(1−e²)eⁱˣ/(1+e·cos x) + c', 'tgmean(r1, r2, 0)'],
    ['kgmean(a, e, c)', 'of a Kepler orbit in time: a(cos E − e) + i·a√(1−e²)·sin E + c, E = kepler(e, x)', 'kgmean(r1, r2, 0)'],
  ] },
  { group: 'Angle stretchings E(x), E(x + 2π) = E(x) + 2π (use cis(E) in place of cis(x))', items: [
    ['kepler(e, M)', 'eccentric anomaly: E − e·sin E = M (Kepler’s equation, time → angle)', 'kepler(r1, x)'],
    ['arnold(e, x)', 'x + e·sin x (the inverse of kepler)', 'arnold(r1, x)'],
    ['mobius(a, x)', 'cis E = (cis x − a)/(1 − ā·cis x), |a| < 1; a = e/(1+√(1−e²)) gives the true anomaly', 'mobius(r1, x)'],
    ['hooke(k, x)', 'tan E = k·tan x: polar angle of a harmonic-oscillator orbit', 'hooke(r1, x)'],
    ['pendulum(m, x)', '2·am(Kx/π, m): angle of a rotating pendulum, 0 ≤ m < 1', 'pendulum(r1, x)'],
  ] },
];
export const FUNCTION_NAMES = Object.keys(FUNCS);
const QUAD = 512; // trapezoid points: spectrally accurate for smooth periodic integrands
const QUAD_DYN = 256; // per-call averages (plane-coordinate dependent): cheaper, still spectral
const NON_HOLOMORPHIC = new Set(['abs', 'conj', 're', 'im', 'arg']);

// Exact geometric means of a degree-one curve (Jensen's formula; MATH.md §14.6):
//   gmean1(c, p, q)  of  c + p e^{ix} + q e^{-ix}                      uniform in x
//   tgmean(a, e, c)  of  a(1-e^2) e^{ix} / (1 + e cos x) + c            (true anomaly)
//   kgmean(a, e, c)  of  a(cos E - e) + i a sqrt(1-e^2) sin E + c,  E = kepler(e, x)
//                                                                       (uniform in time)
// When the curve winds around 0 its logarithm is not periodic and the complex mean is
// not defined; the functions then return the real e^lambda, so f*g/gmean(g) is still
// cramped. They are constants in x and may not contain f.
const CLOSED_MEANS = { gmean1: 0, tgmean: 2, kgmean: 1 };
/* Self-contained (its source is inlined into compiled kernels). */
function closedMean(mode, xr, xi, yr, yi, zr, zi) {
  const mul = (a, b, c, d) => [a * c - b * d, a * d + b * c];
  const div = (a, b, c, d) => { const m = c * c + d * d; return [(a * c + b * d) / m, (b * c - a * d) / m]; };
  let cr, ci, pr, pi, qr, qi, e = 0, scale = 1;
  if (mode === 0) { cr = xr; ci = xi; pr = yr; pi = yi; qr = zr; qi = zi; }
  else {
    const a = xr, k = Math.sqrt(Math.max(0, 1 - yr * yr));
    if (mode === 1) { e = yr; cr = zr - a * yr; ci = zi; pr = a * (1 + k) / 2; pi = 0; qr = a * (1 - k) / 2; qi = 0; }
    else { cr = zr; ci = zi; pr = a * k * k + zr * yr / 2; pi = zi * yr / 2; qr = zr * yr / 2; qi = zi * yr / 2; scale = 2 / (1 + k); }
  }
  // c + p z + q / z = z^{-1} (p z^2 + c z + q); lead coefficient and roots
  let lead, roots;
  if (pr * pr + pi * pi > 1e-300) {
    lead = [pr, pi];
    const dr = cr * cr - ci * ci - 4 * (pr * qr - pi * qi), di = 2 * cr * ci - 4 * (pr * qi + pi * qr);
    const m = Math.hypot(dr, di);
    const sr = Math.sqrt((m + dr) / 2); let si = Math.sqrt(Math.max(0, (m - dr) / 2)); if (di < 0) si = -si;
    roots = [div(-cr - sr, -ci - si, 2 * pr, 2 * pi), div(-cr + sr, -ci + si, 2 * pr, 2 * pi)];
  } else if (cr * cr + ci * ci > 1e-300) { lead = [cr, ci]; roots = [div(-qr, -qi, cr, ci)]; }
  else return [Math.hypot(qr, qi) * scale, 0];
  // log g = log lead + (#inside - 1) log z + sum_out log(-z_j) + sum_in log(1 - z_j/z) + sum_out log(1 - z/z_j)
  let Gr = lead[0], Gi = lead[1], sr = 0, si = 0, nin = 0;
  for (const z of roots) {
    if (Math.hypot(z[0], z[1]) < 1) { nin++; sr += z[0]; si += z[1]; }
    else { [Gr, Gi] = mul(Gr, Gi, -z[0], -z[1]); const w = div(1, 0, z[0], z[1]); sr += w[0]; si += w[1]; }
  }
  // time weight 1 - e cos E picks up the first Fourier coefficients: factor exp(e/2 * sum)
  const m = Math.exp((e / 2) * sr) * scale;
  if (nin === 1) { const [r, i] = mul(Gr, Gi, m * Math.cos((e / 2) * si), m * Math.sin((e / 2) * si)); return [r, i]; }
  return [Math.hypot(Gr, Gi) * m, 0];
}
const CLOSED_MEAN_SRC = closedMean.toString();

// Angle stretchings E(x) with E(x + 2pi) = E(x) + 2pi, E' > 0 (real-valued; the
// parameter's real part is used except for mobius, which takes a complex a, |a| < 1):
//   arnold(e, x)   = x + e sin x                                  (|e| < 1)
//   mobius(a, x):  cis E = (cis x - a) / (1 - conj(a) cis x)      (disc automorphism;
//                  true anomaly of the eccentric anomaly for a = e/(1 + sqrt(1 - e^2)))
//   hooke(k, x):   tan E = k tan x  (polar angle of a harmonic-oscillator orbit in time,
//                  axis ratio k > 0)
//   pendulum(m, x) = 2 am(K(m) x / pi, m)  (angle of a rotating pendulum in time, 0 <= m < 1)
const WARPS = { arnold: 0, mobius: 1, hooke: 2, pendulum: 3 };
/* Self-contained (bound into compiled kernels). */
function warpE(mode, ar, ai, x) {
  if (mode === 0) return x + ar * Math.sin(x);
  if (mode === 1) {
    const s = Math.sin(x), c = Math.cos(x);
    return x + 2 * Math.atan2(ar * s - ai * c, 1 - ar * c - ai * s);
  }
  if (mode === 2) {
    const s = Math.sin(x), c = Math.cos(x);
    return x + Math.atan(((ar - 1) * s * c) / (c * c + ar * s * s));
  }
  // Jacobi amplitude by the descending Landen / AGM scheme
  const m = Math.min(Math.max(ar, 0), 1 - 1e-15);
  if (m < 1e-15) return x;
  const A = [1], C = [Math.sqrt(m)];
  let a = 1, b = Math.sqrt(1 - m), n = 0;
  while (Math.abs(C[n]) > 1e-16 && n < 30) { const an = (a + b) / 2, cn = (a - b) / 2; b = Math.sqrt(a * b); a = an; n++; A.push(a); C.push(cn); }
  let phi = Math.pow(2, n - 1) * x; // 2^n a_n u with u = K x / pi = x / (2 a_n)
  for (let j = n; j >= 1; j--) phi = (phi + Math.asin((C[j] / A[j]) * Math.sin(phi))) / 2;
  return 2 * phi;
}
const WARP_SRC = warpE.toString();
const CONSTS = { pi: [Math.PI, 0], tau: [2 * Math.PI, 0], e: [Math.E, 0], i: [0, 1] };
export const PARAM_RE = /^([crn])([0-9]+)$/;

// ---------------------------------------------------------------- node constructors
const EMPTY = new Set();
function finish(n) {
  switch (n.k) {
    case 'num': n.vars = EMPTY; n.key = `${n.re}|${n.im}`; break;
    case 'var': n.vars = new Set([n.name]); n.key = n.name; break;
    case 'neg': n.vars = n.a.vars; n.key = `-(${n.a.key})`; break;
    case 'op': n.vars = union(n.a.vars, n.b.vars); n.key = `(${n.a.key}${n.op}${n.b.key})`; break;
    case 'fn': {
      n.vars = n.args.reduce((s, a) => union(s, a.vars), EMPTY);
      if (AVERAGES.has(n.name) && n.vars.has('x')) { n.vars = new Set(n.vars); n.vars.delete('x'); }
      n.key = `${n.name}(${n.args.map((a) => a.key).join(',')})`;
      break;
    }
  }
  return n;
}
function union(a, b) {
  if (!a.size) return b;
  if (!b.size) return a;
  const s = new Set(a);
  for (const v of b) s.add(v);
  return s;
}
const isNum = (n, re, im = 0) => n.k === 'num' && n.re === re && n.im === im;
const bothNum = (a, b) => a.k === 'num' && b.k === 'num';

export const mk = {
  num: (re, im = 0) => finish({ k: 'num', re, im }),
  v: (name) => finish({ k: 'var', name }),
  neg(a) {
    if (a.k === 'num') return mk.num(-a.re, -a.im);
    if (a.k === 'neg') return a.a;
    return finish({ k: 'neg', a });
  },
  op(op, a, b) {
    switch (op) {
      case '+':
        if (isNum(a, 0)) return b;
        if (isNum(b, 0)) return a;
        break;
      case '-':
        if (isNum(b, 0)) return a;
        if (isNum(a, 0)) return mk.neg(b);
        break;
      case '*':
        if (isNum(a, 0) || isNum(b, 0)) return mk.num(0);
        if (isNum(a, 1)) return b;
        if (isNum(b, 1)) return a;
        break;
      case '/':
        if (isNum(a, 0)) return mk.num(0);
        if (isNum(b, 1)) return a;
        break;
      case '^':
        if (isNum(b, 1)) return a;
        if (isNum(b, 0)) return mk.num(1);
        break;
    }
    const n = finish({ k: 'op', op, a, b });
    if (bothNum(a, b)) { const v = evaluate(n, {}); return mk.num(v[0], v[1]); }
    return n;
  },
  fn(name, args) {
    const n = finish({ k: 'fn', name, args });
    if (args.every((a) => a.k === 'num')) { const v = evaluate(n, {}); return mk.num(v[0], v[1]); }
    return n;
  },
};
const add = (a, b) => mk.op('+', a, b);
const sub = (a, b) => mk.op('-', a, b);
const mul = (a, b) => mk.op('*', a, b);
const div = (a, b) => mk.op('/', a, b);
const pow = (a, b) => mk.op('^', a, b);
const fn1 = (name, a) => mk.fn(name, [a]);

// ---------------------------------------------------------------- tokenizer
function tokenize(src) {
  const toks = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (/\s/.test(ch)) { i++; continue; }
    if (/[0-9.]/.test(ch)) {
      const m = /^(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?/.exec(src.slice(i));
      if (!m) throw new ExprError(`Bad number at position ${i + 1}`);
      toks.push({ t: 'num', v: parseFloat(m[0]), pos: i });
      i += m[0].length;
      continue;
    }
    if (/[A-Za-z_]/.test(ch)) {
      const m = /^[A-Za-z_][A-Za-z_0-9]*/.exec(src.slice(i));
      toks.push({ t: 'id', v: m[0], pos: i });
      i += m[0].length;
      continue;
    }
    if (src.startsWith('**', i)) { toks.push({ t: 'op', v: '^', pos: i }); i += 2; continue; }
    if ('+-*/^(),'.includes(ch)) { toks.push({ t: 'op', v: ch, pos: i }); i++; continue; }
    throw new ExprError(`Unexpected character “${ch}” at position ${i + 1}`);
  }
  toks.push({ t: 'end', pos: src.length });
  return toks;
}

// ---------------------------------------------------------------- parser
export function parse(src) {
  if (!src || !src.trim()) throw new ExprError('The expression is empty');
  const toks = tokenize(src);
  let k = 0;
  const peek = () => toks[k];
  const isOp = (v) => toks[k].t === 'op' && toks[k].v === v;
  const expect = (v) => {
    if (!isOp(v)) throw new ExprError(`Expected “${v}” at position ${toks[k].pos + 1}`);
    k++;
  };
  const startsPrimary = () => {
    const t = peek();
    return t.t === 'num' || t.t === 'id' || (t.t === 'op' && t.v === '(');
  };

  function additive() {
    let n = multiplicative();
    while (isOp('+') || isOp('-')) {
      const op = toks[k++].v;
      n = mk.op(op, n, multiplicative());
    }
    return n;
  }
  function multiplicative() {
    let n = unary();
    for (;;) {
      if (isOp('*') || isOp('/')) {
        const op = toks[k++].v;
        n = mk.op(op, n, unary());
      } else if (startsPrimary()) {
        n = mul(n, power()); // implicit multiplication
      } else break;
    }
    return n;
  }
  function unary() {
    if (isOp('-')) { k++; return mk.neg(unary()); }
    if (isOp('+')) { k++; return unary(); }
    return power();
  }
  function power() {
    const base = primary();
    if (isOp('^')) { k++; return pow(base, unary()); }
    return base;
  }
  function primary() {
    const t = peek();
    if (t.t === 'num') { k++; return mk.num(t.v); }
    if (t.t === 'op' && t.v === '(') {
      k++;
      const n = additive();
      expect(')');
      return n;
    }
    if (t.t === 'id') {
      k++;
      if (FUNCS[t.v] !== undefined) {
        expect('(');
        const args = [additive()];
        while (isOp(',')) { k++; args.push(additive()); }
        expect(')');
        if (args.length !== FUNCS[t.v]) {
          throw new ExprError(`${t.v}() takes ${FUNCS[t.v]} argument${FUNCS[t.v] > 1 ? 's' : ''}`);
        }
        return mk.fn(t.v === 'ln' ? 'log' : t.v, args);
      }
      if (t.v === 'f') {
        if (isOp('(')) throw new ExprError('Write f, not f(…): the right-hand side is evaluated at f(x)');
        return mk.v('f');
      }
      if (CONSTS[t.v]) return mk.num(CONSTS[t.v][0], CONSTS[t.v][1]);
      if (t.v === 'x' || t.v === 'T' || PARAM_RE.test(t.v)) return mk.v(t.v);
      throw new ExprError(
        `Unknown name “${t.v}”. Use f, x, T, parameters c1 c2 … (complex), r1 … (real), n1 … (integer), and functions like sin, exp, log`,
      );
    }
    if (t.t === 'end') throw new ExprError('The expression ends too early');
    throw new ExprError(`Unexpected “${t.v}” at position ${t.pos + 1}`);
  }

  const ast = additive();
  if (peek().t !== 'end') throw new ExprError(`Unexpected “${peek().v}” at position ${peek().pos + 1}`);
  return ast;
}

/** Parameters and variables used by an expression, sorted c1 < c2 < c10. */
export function describe(ast) {
  const out = { c: [], r: [], n: [], usesF: ast.vars.has('f'), usesX: ast.vars.has('x'), usesT: ast.vars.has('T') };
  for (const v of ast.vars) {
    const m = PARAM_RE.exec(v);
    if (m) out[m[1]].push(v);
  }
  const byIndex = (a, b) => +a.slice(1) - +b.slice(1);
  out.c.sort(byIndex); out.r.sort(byIndex); out.n.sort(byIndex);
  return out;
}

// ---------------------------------------------------------------- differentiation
/** Symbolic complex derivative with respect to variable w (holomorphic rules). */
export function diff(n, w) {
  if (!n.vars.has(w)) return mk.num(0);
  switch (n.k) {
    case 'var': return mk.num(n.name === w ? 1 : 0);
    case 'neg': return mk.neg(diff(n.a, w));
    case 'op': {
      const { a, b } = n;
      const da = diff(a, w), db = diff(b, w);
      switch (n.op) {
        case '+': return add(da, db);
        case '-': return sub(da, db);
        case '*': return add(mul(da, b), mul(a, db));
        case '/': return sub(div(da, b), div(mul(a, db), mul(b, b)));
        case '^':
          if (!b.vars.has(w)) return mul(mul(b, pow(a, sub(b, mk.num(1)))), da);
          return mul(n, add(mul(db, fn1('log', a)), div(mul(b, da), a)));
      }
      break;
    }
    case 'fn': {
      const a = n.args[0];
      if (NON_HOLOMORPHIC.has(n.name)) {
        throw new ExprError(`${n.name}(…) of an expression containing ${w} is not holomorphic, so ∂F/∂${w} is not defined`);
      }
      if (n.name === 'pow') return diff(pow(n.args[0], n.args[1]), w);
      if (WARPS[n.name] !== undefined) throw new ExprError(`${n.name}(…, …) of an expression containing ${w} is not supported: the stretchings are functions of x and the parameters`);
      if (CLOSED_MEANS[n.name] !== undefined) throw new ExprError(`${n.name}(…) of an expression containing ${w} is not supported: it is a constant of the parameters`);
      if (n.name === 'kepler') {
        // E - e sin E = M  =>  dE = (dM + sin E de) / (1 - e cos E)
        const [ea, Ma] = n.args;
        return div(add(diff(Ma, w), mul(fn1('sin', n), diff(ea, w))), sub(mk.num(1), mul(ea, fn1('cos', n))));
      }
      if (AVERAGES.has(n.name)) throw new ExprError(`${n.name}(…) of an expression containing ${w} is not supported: averages are taken over x for fixed parameters`);
      const da = diff(a, w);
      switch (n.name) {
        case 'sin': return mul(fn1('cos', a), da);
        case 'cos': return mk.neg(mul(fn1('sin', a), da));
        case 'tan': return div(da, pow(fn1('cos', a), mk.num(2)));
        case 'exp': return mul(n, da);
        case 'log': return div(da, a);
        case 'sqrt': return div(da, mul(mk.num(2), n));
        case 'sinh': return mul(fn1('cosh', a), da);
        case 'cosh': return mul(fn1('sinh', a), da);
        case 'tanh': return mul(sub(mk.num(1), pow(n, mk.num(2))), da);
        case 'cis': return mul(mul(mk.num(0, 1), n), da);
      }
    }
  }
  throw new ExprError('Internal: cannot differentiate');
}

// ---------------------------------------------------------------- interpreter
export function evaluate(n, env) {
  switch (n.k) {
    case 'num': return [n.re, n.im];
    case 'var': {
      const v = env[n.name];
      if (!v) throw new ExprError(`No value for ${n.name}`);
      return v;
    }
    case 'neg': return Cx.neg(evaluate(n.a, env));
    case 'op': {
      const a = evaluate(n.a, env), b = evaluate(n.b, env);
      switch (n.op) {
        case '+': return Cx.add(a, b);
        case '-': return Cx.sub(a, b);
        case '*': return Cx.mul(a, b);
        case '/': return Cx.div(a, b);
        case '^': return Cx.pow(a, b);
      }
      break;
    }
    case 'fn': {
      if (AVERAGES.has(n.name)) return evalAverage(n.name, n.args[0], env);
      const a = evaluate(n.args[0], env);
      switch (n.name) {
        case 'sin': return Cx.sin(a);
        case 'cos': return Cx.cos(a);
        case 'tan': return Cx.tan(a);
        case 'exp': return Cx.exp(a);
        case 'log': return Cx.log(a);
        case 'sqrt': return Cx.sqrt(a);
        case 'sinh': return Cx.sinh(a);
        case 'cosh': return Cx.cosh(a);
        case 'tanh': return Cx.tanh(a);
        case 'abs': return [Cx.abs(a), 0];
        case 'conj': return Cx.conj(a);
        case 're': return [a[0], 0];
        case 'im': return [a[1], 0];
        case 'arg': return [Math.atan2(a[1], a[0]), 0];
        case 'cis': return Cx.cis(a);
        case 'pow': return Cx.pow(a, evaluate(n.args[1], env));
        case 'kepler': return Cx.kepler(a, evaluate(n.args[1], env));
        case 'arnold': case 'mobius': case 'hooke': case 'pendulum':
          return [warpE(WARPS[n.name], a[0], a[1], evaluate(n.args[1], env)[0]), 0];
        case 'gmean1': case 'tgmean': case 'kgmean': {
          const b = evaluate(n.args[1], env), c = evaluate(n.args[2], env);
          return closedMean(CLOSED_MEANS[n.name], a[0], a[1], b[0], b[1], c[0], c[1]);
        }
      }
    }
  }
  throw new ExprError('Internal: unknown node');
}

/** mean / gmean of an expression over x in [0, 2pi), by the trapezoid rule. */
function evalAverage(name, arg, env) {
  let sr = 0, si = 0, prev = 0, unwrap = 0;
  for (let q = 0; q < QUAD; q++) {
    const v = evaluate(arg, { ...env, x: [(2 * Math.PI * q) / QUAD, 0] });
    if (name === 'mean') { sr += v[0]; si += v[1]; continue; }
    const a = Math.atan2(v[1], v[0]);
    if (q === 0) unwrap = a;
    else { let d = a - prev; d -= 2 * Math.PI * Math.round(d / (2 * Math.PI)); unwrap += d; }
    prev = a;
    sr += 0.5 * Math.log(v[0] * v[0] + v[1] * v[1]);
    si += unwrap;
  }
  sr /= QUAD; si /= QUAD;
  if (name === 'mean') return [sr, si];
  const e = Math.exp(sr);
  return [e * Math.cos(si), e * Math.sin(si)];
}

// ---------------------------------------------------------------- code generator
// A value is {r: <js expr>, i: <js expr> | null}; i === null means "known real".
export const lit = (v) => (Number.isFinite(v) ? `(${v})` : Number.isNaN(v) ? 'NaN' : v > 0 ? 'Infinity' : '(-Infinity)');
const litVal = (v) => ({ r: lit(v[0]), i: v[1] === 0 ? null : lit(v[1]) });

class Gen {
  constructor(ctx, prefix = 't') { this.lines = []; this.pre = []; this.n = 0; this.memo = new Map(); this.ctx = ctx; this.prefix = prefix; }
  val(r, i) {
    const t = `${this.prefix}${this.n++}`;
    this.lines.push(`const ${t}r = ${r};`);
    if (i === null) return { r: `${t}r`, i: null };
    this.lines.push(`const ${t}i = ${i};`);
    return { r: `${t}r`, i: `${t}i` };
  }
}
const I = (v) => (v.i === null ? '0' : v.i);

function gen(n, g) {
  const hit = g.memo.get(n.key);
  if (hit) return hit;
  const v = gen0(n, g);
  g.memo.set(n.key, v);
  return v;
}

function gen0(n, g) {
  const l = g.ctx.leaf(n);
  if (l) return l;
  switch (n.k) {
    case 'num': return litVal([n.re, n.im]);
    case 'var': throw new ExprError(`Internal: unbound variable ${n.name}`);
    case 'neg': {
      const a = gen(n.a, g);
      return g.val(`-${a.r}`, a.i === null ? null : `-${a.i}`);
    }
    case 'op': {
      if (n.op === '^') return genPow(n, g);
      const a = gen(n.a, g), b = gen(n.b, g);
      const real = a.i === null && b.i === null;
      switch (n.op) {
        case '+':
        case '-':
          return g.val(`${a.r} ${n.op} ${b.r}`, real ? null : `${I(a)} ${n.op} ${I(b)}`);
        case '*':
          return cmul(g, a, b);
        case '/':
          if (b.i === null) return g.val(`${a.r} / ${b.r}`, a.i === null ? null : `${a.i} / ${b.r}`);
          {
            const d = g.val(`${b.r} * ${b.r} + ${b.i} * ${b.i}`, null);
            return g.val(
              `(${a.r} * ${b.r} + ${I(a)} * ${b.i}) / ${d.r}`,
              `(${I(a)} * ${b.r} - ${a.r} * ${b.i}) / ${d.r}`,
            );
          }
      }
      break;
    }
    case 'fn': return genFn(n, g);
  }
  throw new ExprError('Internal: cannot generate code');
}

function cmul(g, a, b) {
  if (a.i === null && b.i === null) return g.val(`${a.r} * ${b.r}`, null);
  if (a.i === null) return g.val(`${a.r} * ${b.r}`, `${a.r} * ${b.i}`);
  if (b.i === null) return g.val(`${a.r} * ${b.r}`, `${a.i} * ${b.r}`);
  return g.val(`${a.r} * ${b.r} - ${a.i} * ${b.i}`, `${a.r} * ${b.i} + ${a.i} * ${b.r}`);
}

function genPow(n, g) {
  const a = gen(n.a, g);
  // exponent known at compile time (numbers, n-parameters, fixed parameters)
  const e = g.ctx.constVal(n.b);
  if (e && e[1] === 0 && Number.isInteger(e[0]) && Math.abs(e[0]) <= 64) {
    let k = Math.abs(e[0]);
    if (k === 0) return { r: '1', i: null };
    let result = null;
    let base = a;
    while (k > 0) {
      if (k & 1) result = result ? cmul(g, result, base) : base;
      k >>= 1;
      if (k > 0) base = cmul(g, base, base);
    }
    if (e[0] < 0) {
      if (result.i === null) return g.val(`1 / ${result.r}`, null);
      const d = g.val(`${result.r} * ${result.r} + ${result.i} * ${result.i}`, null);
      return g.val(`${result.r} / ${d.r}`, `-${result.i} / ${d.r}`);
    }
    return result;
  }
  const b = gen(n.b, g);
  return genCpow(g, a, b);
}

function genCpow(g, a, b) {
  const m = g.val(`${a.r} * ${a.r} + ${I(a)} * ${I(a)}`, null);
  const L = g.val(`0.5 * Math.log(${m.r})`, `Math.atan2(${I(a)}, ${a.r})`);
  const w = cmul(g, b, L);
  const e = g.val(`(${m.r} === 0 ? 0 : Math.exp(${w.r}))`, null);
  return g.val(`${e.r} * Math.cos(${I(w)})`, `${e.r} * Math.sin(${I(w)})`);
}

/**
 * An average whose argument depends on the plane coordinates (u, v): it is constant
 * along the orbit, so it goes into the prologue (once per call) as a quadrature loop.
 */
function genAverage(n, g) {
  const shared = g.ctx.shared;
  if (shared && shared.avg.has(n.key)) return shared.avg.get(n.key);
  const id = `${g.prefix}m${g.n++}`;
  const dyn = g.ctx.dyn || {};
  const env = g.ctx.env || {};
  const hoist = g.ctx.hoist;
  const sub = new Gen({
    dyn, env, hoist, shared,
    leaf(m) {
      if (m.k === 'var') {
        if (m.name === 'x') return { r: 'qx', i: null };
        if (dyn[m.name]) return dyn[m.name];
        const v = env[m.name];
        if (!v) throw new ExprError(`No value for ${m.name}`);
        return litVal(v);
      }
      if (!isStatic(m, dyn)) return null;
      if (!m.vars.has('x')) return m.k === 'num' ? null : litVal(evaluate(m, env));
      // x-only subtree: precompute once at the quadrature nodes
      if (!hoist) return null;
      const key = `${m.key}@Q`;
      let h = hoist.byKey.get(key);
      if (!h) {
        const f = compileFixed(m, env);
        const re = new Float64Array(QUAD_DYN), im = new Float64Array(QUAD_DYN);
        const out = [0, 0];
        let anyIm = false;
        for (let q = 0; q < QUAD_DYN; q++) {
          f((2 * Math.PI * q) / QUAD_DYN, out);
          re[q] = out[0]; im[q] = out[1];
          if (out[1] !== 0) anyIm = true;
        }
        const nameR = `H${hoist.arrays.length}`;
        hoist.names.push(nameR); hoist.arrays.push(re);
        let nameI = null;
        if (anyIm) { nameI = `H${hoist.arrays.length}`; hoist.names.push(nameI); hoist.arrays.push(im); }
        h = { r: `${nameR}[qq]`, i: nameI ? `${nameI}[qq]` : null };
        hoist.byKey.set(key, h);
      }
      return h;
    },
    constVal(m) { return isStatic(m, dyn) && !m.vars.has('x') ? evaluate(m, env) : null; },
  }, `${id}t`);
  const v = gen(n.args[0], sub);
  const re = v.r, im = I(v);
  const lines = [`let ${id}sr = 0, ${id}si = 0, ${id}pa = 0, ${id}uw = 0;`, `for (let qq = 0; qq < ${QUAD_DYN}; qq++) {`, `const qx = qq * ${(2 * Math.PI) / QUAD_DYN};`, ...sub.pre, ...sub.lines];
  if (n.name === 'mean') {
    lines.push(`${id}sr += ${re}; ${id}si += ${im};`, '}');
    lines.push(`const ${id}R = ${id}sr / ${QUAD_DYN}, ${id}I = ${id}si / ${QUAD_DYN};`);
  } else {
    lines.push(
      `const ${id}a = Math.atan2(${im}, ${re});`,
      `if (qq === 0) ${id}uw = ${id}a; else { let d = ${id}a - ${id}pa; d -= ${2 * Math.PI} * Math.round(d / ${2 * Math.PI}); ${id}uw += d; }`,
      `${id}pa = ${id}a;`,
      `${id}sr += 0.5 * Math.log(${re} * ${re} + ${im} * ${im}); ${id}si += ${id}uw;`,
      '}',
      `const ${id}e = Math.exp(${id}sr / ${QUAD_DYN});`,
      `const ${id}R = ${id}e * Math.cos(${id}si / ${QUAD_DYN}), ${id}I = ${id}e * Math.sin(${id}si / ${QUAD_DYN});`,
    );
  }
  const val = { r: `${id}R`, i: `${id}I` };
  if (shared) { shared.pre.push(...lines); shared.avg.set(n.key, val); } else g.pre.push(...lines);
  return val;
}

function genFn(n, g) {
  if (AVERAGES.has(n.name)) return genAverage(n, g);
  const a = gen(n.args[0], g);
  const real = a.i === null;
  const r = a.r, i = I(a);
  switch (n.name) {
    case 'sin':
      if (real) return g.val(`Math.sin(${r})`, null);
      return g.val(`Math.sin(${r}) * Math.cosh(${i})`, `Math.cos(${r}) * Math.sinh(${i})`);
    case 'cos':
      if (real) return g.val(`Math.cos(${r})`, null);
      return g.val(`Math.cos(${r}) * Math.cosh(${i})`, `-Math.sin(${r}) * Math.sinh(${i})`);
    case 'tan': {
      if (real) return g.val(`Math.tan(${r})`, null);
      const d = g.val(`Math.cos(2 * ${r}) + Math.cosh(2 * ${i})`, null);
      return g.val(`Math.sin(2 * ${r}) / ${d.r}`, `Math.sinh(2 * ${i}) / ${d.r}`);
    }
    case 'exp': {
      if (real) return g.val(`Math.exp(${r})`, null);
      const e = g.val(`Math.exp(${r})`, null);
      return g.val(`${e.r} * Math.cos(${i})`, `${e.r} * Math.sin(${i})`);
    }
    case 'log':
      return g.val(`0.5 * Math.log(${r} * ${r} + ${i} * ${i})`, `Math.atan2(${i}, ${r})`);
    case 'sqrt': {
      if (real) return g.val(`(${r} >= 0 ? Math.sqrt(${r}) : 0)`, `(${r} >= 0 ? 0 : Math.sqrt(-${r}))`);
      const m = g.val(`Math.hypot(${r}, ${i})`, null);
      const im = g.val(`Math.sqrt(Math.max(0, (${m.r} - ${r}) / 2))`, null);
      return g.val(`Math.sqrt(Math.max(0, (${m.r} + ${r}) / 2))`, `(${i} < 0 ? -${im.r} : ${im.r})`);
    }
    case 'sinh':
      if (real) return g.val(`Math.sinh(${r})`, null);
      return g.val(`Math.sinh(${r}) * Math.cos(${i})`, `Math.cosh(${r}) * Math.sin(${i})`);
    case 'cosh':
      if (real) return g.val(`Math.cosh(${r})`, null);
      return g.val(`Math.cosh(${r}) * Math.cos(${i})`, `Math.sinh(${r}) * Math.sin(${i})`);
    case 'tanh': {
      if (real) return g.val(`Math.tanh(${r})`, null);
      const d = g.val(`Math.cosh(2 * ${r}) + Math.cos(2 * ${i})`, null);
      return g.val(`Math.sinh(2 * ${r}) / ${d.r}`, `Math.sin(2 * ${i}) / ${d.r}`);
    }
    case 'abs': return g.val(real ? `Math.abs(${r})` : `Math.hypot(${r}, ${i})`, null);
    case 'conj': return real ? a : g.val(r, `-${i}`);
    case 're': return { r, i: null };
    case 'im': return g.val(i, null);
    case 'arg': return g.val(`Math.atan2(${i}, ${r})`, null);
    case 'cis': {
      if (real) return g.val(`Math.cos(${r})`, `Math.sin(${r})`);
      const e = g.val(`Math.exp(-${i})`, null);
      return g.val(`${e.r} * Math.cos(${r})`, `${e.r} * Math.sin(${r})`);
    }
    case 'pow': {
      const b = gen(n.args[1], g);
      return genCpow(g, a, b);
    }
    case 'kepler': return genKepler(g, a, gen(n.args[1], g));
    case 'arnold': case 'mobius': case 'hooke': case 'pendulum': {
      const xv = gen(n.args[1], g);
      const h = g.ctx.hoist;
      let fn;
      if (h) {
        if (!h.byKey.has('__warpE__')) { h.names.push('WARPE'); h.arrays.push(warpE); h.byKey.set('__warpE__', true); }
        fn = 'WARPE';
      } else fn = `(${WARP_SRC})`;
      return g.val(`${fn}(${WARPS[n.name]}, ${r}, ${i}, ${xv.r})`, null);
    }
    case 'gmean1': case 'tgmean': case 'kgmean': {
      const b = gen(n.args[1], g), c = gen(n.args[2], g);
      const id = `${g.prefix}g${g.n++}`;
      g.lines.push(`const ${id} = (${CLOSED_MEAN_SRC})(${CLOSED_MEANS[n.name]}, ${r}, ${i}, ${b.r}, ${I(b)}, ${c.r}, ${I(c)});`);
      return g.val(`${id}[0]`, `${id}[1]`);
    }
  }
  throw new ExprError(`Internal: unknown function ${n.name}`);
}

/** kepler(e, M): Newton's method on E - e sin E = M, emitted inline (real or complex). */
function genKepler(g, e, m) {
  const id = `${g.prefix}k${g.n++}`;
  const start = `${m.r} + 0.85 * ${e.r} * (Math.sin(${m.r}) < 0 ? -1 : 1)`;
  if (e.i === null && m.i === null) {
    // Halley's method (cubic convergence): after a step of size < 1e-7 the error is ~C·1e-21
    const halley = (its) => `for (let it = 0; it < ${its}; it++) { const sn = ${e.r} * Math.sin(${id}), cs = ${e.r} * Math.cos(${id}); const F = ${id} - sn - ${m.r}, D = 1 - cs; const d = F / (D - 0.5 * F * sn / D); ${id} -= d; if (!(Math.abs(d) > 1e-7)) { ${id}ok = true; break; } }`;
    const warm = g.ctx.warm && g.ctx.hoist;
    if (warm) {
      // warm start from the previous call's solution at the same sample point (the next
      // pixel has almost the same e): usually one or two steps; fall back to a cold start
      const W = `W${g.ctx.hoist.arrays.length}`;
      g.ctx.hoist.names.push(W);
      g.ctx.hoist.arrays.push(new Float64Array(g.ctx.warm.N).fill(NaN));
      g.lines.push(
        `let ${id} = ${W}[n], ${id}ok = false;`,
        `if (${id} === ${id}) { ${halley(6)} }`,
        `if (!${id}ok) { ${id} = ${start}; ${halley(40)} }`,
        `${W}[n] = ${id};`,
      );
    } else {
      g.lines.push(`let ${id} = ${start}, ${id}ok = false;`, halley(40));
    }
    return g.val(id, null);
  }
  const er = e.r, ei = I(e), mr = m.r, mi = I(m);
  g.lines.push(
    `let ${id}r = ${start}, ${id}i = ${mi};`,
    `for (let it = 0; it < 80; it++) {`,
    `  const ch = Math.cosh(${id}i), sh = Math.sinh(${id}i), sn = Math.sin(${id}r), cs = Math.cos(${id}r);`,
    `  const sr = sn * ch, si = cs * sh, cr = cs * ch, ci = -sn * sh;`,
    `  const gr = ${id}r - (${er} * sr - ${ei} * si) - ${mr}, gi = ${id}i - (${er} * si + ${ei} * sr) - ${mi};`,
    `  const hr = 1 - (${er} * cr - ${ei} * ci), hi = -(${er} * ci + ${ei} * cr), hh = hr * hr + hi * hi;`,
    `  const dr = (gr * hr + gi * hi) / hh, di = (gi * hr - gr * hi) / hh;`,
    `  ${id}r -= dr; ${id}i -= di;`,
    `  if (dr * dr + di * di < 1e-30 * (1 + ${id}r * ${id}r + ${id}i * ${id}i)) break;`,
    `}`,
  );
  return g.val(`${id}r`, `${id}i`);
}

// ---------------------------------------------------------------- compilers

/** Node is free of the given dynamic names. */
const isStatic = (n, dyn) => { for (const v of n.vars) if (dyn[v]) return false; return true; };

/** fn(x, out): evaluates an expression whose only free variable is x (others from env). */
export function compileFixed(ast, env) {
  const ctx = {
    leaf(n) {
      if (n.k === 'var') {
        if (n.name === 'x') return { r: 'x', i: null };
        const v = env[n.name];
        if (!v) throw new ExprError(`No value for ${n.name}`);
        return litVal(v);
      }
      if (!n.vars.has('x') && n.k !== 'num') return litVal(evaluate(n, env));
      return null;
    },
    constVal(n) { return n.vars.has('x') ? null : evaluate(n, env); },
  };
  const g = new Gen(ctx);
  const res = gen(ast, g);
  // eslint-disable-next-line no-new-func
  return new Function('x', 'out', `${g.lines.join('\n')}\nout[0] = ${res.r};\nout[1] = ${I(res)};`);
}

/** Prologue shared by several compileSampled calls in one generated function. */
export function newShared() { return { avg: new Map(), pre: [] }; }

/** Shared store of precomputed (hoisted) arrays, keyed by subtree. */
export function newHoist() { return { names: [], arrays: [], byKey: new Map() }; }

/**
 * Loop-invariant code motion over sample points xs.
 * @param asts  expressions to evaluate together (e.g. [F, dF/df])
 * @param xs    Float64Array of base points; the generated code reads index `n`
 * @param dyn   {name: {r, i}} JS expressions for names that change per evaluation
 *              (f -> 'zr','zi'; plane coordinates -> 'u','v' or literals)
 * @param env   {name: [re, im]} values of every other name (parameters, T)
 * @param hoist shared hoist store (optional)
 * @returns {code, res: [{r, i}], names, arrays}
 */
export function compileSampled(asts, xs, dyn, env, hoist = newHoist(), prefix = 't', shared = null) {
  const N = xs.length;
  // per-call invariants: subtrees with plane coordinates but neither x nor f
  // (e.g. cis(r1) when r1 is an axis) are computed once, before the loop
  const preCtx = {
    dyn, env, hoist, shared,
    leaf(n) {
      if (n.k === 'var') {
        if (dyn[n.name]) return dyn[n.name];
        const v = env[n.name];
        if (!v) throw new ExprError(`No value for ${n.name}`);
        return litVal(v);
      }
      if (isStatic(n, dyn) && n.k !== 'num') return litVal(evaluate(n, env));
      return null;
    },
    constVal(n) { return isStatic(n, dyn) && !n.vars.has('x') ? evaluate(n, env) : null; },
  };
  const preGen = new Gen(preCtx, `${prefix}p`);
  const ctx = {
    dyn, env, hoist, shared,
    warm: { N }, // per-sample state (warm starts for kepler), indexed by `n`
    leaf(n) {
      if (n.k === 'var' && dyn[n.name]) return dyn[n.name];
      if (!isStatic(n, dyn)) {
        if (n.k !== 'var' && n.k !== 'num' && !n.vars.has('x') && !n.vars.has('f')) return gen(n, preGen);
        return null;
      }
      if (!n.vars.has('x')) return n.k === 'num' ? null : litVal(evaluate(n, env));
      const key = n.key;
      let h = hoist.byKey.get(key);
      if (!h) {
        const f = compileFixed(n, env);
        const re = new Float64Array(N), im = new Float64Array(N);
        const out = [0, 0];
        let anyIm = false;
        for (let k = 0; k < N; k++) {
          f(xs[k], out);
          re[k] = out[0];
          im[k] = out[1];
          if (out[1] !== 0) anyIm = true;
        }
        const nameR = `H${hoist.arrays.length}`;
        hoist.names.push(nameR); hoist.arrays.push(re);
        let nameI = null;
        if (anyIm) { nameI = `H${hoist.arrays.length}`; hoist.names.push(nameI); hoist.arrays.push(im); }
        h = { r: `${nameR}[n]`, i: nameI ? `${nameI}[n]` : null };
        hoist.byKey.set(key, h);
      }
      return h;
    },
    constVal(n) { return isStatic(n, dyn) && !n.vars.has('x') ? evaluate(n, env) : null; },
  };
  const g = new Gen(ctx, prefix);
  const res = asts.map((a) => {
    const v = gen(a, g);
    return { r: v.r, i: I(v) };
  });
  // `pre`: statements to run once per call, before the loop (averages over x of
  // expressions that depend on the plane coordinates)
  const pre = [...(shared ? [] : g.pre), ...(shared ? [] : preGen.pre), ...preGen.lines].join('\n');
  return { code: g.lines.join('\n'), pre, res, names: hoist.names, arrays: hoist.arrays, hoisted: hoist.arrays.length };
}

/** Build a function from generated code with the hoisted arrays bound as closure variables. */
export function bindHoisted(hoist, body) {
  // eslint-disable-next-line no-new-func
  return new Function(...hoist.names, body)(...hoist.arrays);
}
