// In-place iterative radix-2 complex FFT on split re/im Float64Arrays.
// Plans (bit reversal + twiddles) are cached per size.
//
// Convention: forward  X_k = sum_n x_n e^{-2 pi i k n / N}
//             inverse  x_n = (1/N) sum_k X_k e^{+2 pi i k n / N}

const plans = new Map();

function plan(n) {
  let p = plans.get(n);
  if (p) return p;
  if (n & (n - 1)) throw new Error(`FFT size must be a power of two, got ${n}`);
  const bits = Math.log2(n) | 0;
  const rev = new Uint32Array(n);
  for (let i = 0; i < n; i++) {
    let r = 0;
    for (let b = 0; b < bits; b++) r |= ((i >> b) & 1) << (bits - 1 - b);
    rev[i] = r;
  }
  const cos = new Float64Array(n / 2), sin = new Float64Array(n / 2);
  for (let i = 0; i < n / 2; i++) {
    cos[i] = Math.cos((2 * Math.PI * i) / n);
    sin[i] = Math.sin((2 * Math.PI * i) / n);
  }
  p = { rev, cos, sin };
  plans.set(n, p);
  return p;
}

export function fft(re, im, inverse = false) {
  const n = re.length;
  if (n <= 1) return;
  const { rev, cos, sin } = plan(n);
  for (let i = 0; i < n; i++) {
    const j = rev[i];
    if (j > i) {
      let t = re[i]; re[i] = re[j]; re[j] = t;
      t = im[i]; im[i] = im[j]; im[j] = t;
    }
  }
  const sgn = inverse ? 1 : -1;
  for (let size = 2; size <= n; size <<= 1) {
    const half = size >> 1;
    const step = n / size;
    for (let start = 0; start < n; start += size) {
      for (let k = 0, t = 0; k < half; k++, t += step) {
        const wr = cos[t], wi = sgn * sin[t];
        const a = start + k, b = a + half;
        const xr = re[b] * wr - im[b] * wi;
        const xi = re[b] * wi + im[b] * wr;
        re[b] = re[a] - xr; im[b] = im[a] - xi;
        re[a] += xr; im[a] += xi;
      }
    }
  }
  if (inverse) {
    const s = 1 / n;
    for (let i = 0; i < n; i++) { re[i] *= s; im[i] *= s; }
  }
}

/** Signed integer frequency of FFT bin m for a length-n transform. */
export const freqIndex = (m, n) => (m < n / 2 ? m : m - n);

export const nextPow2 = (x) => 2 ** Math.ceil(Math.log2(Math.max(2, x)));
