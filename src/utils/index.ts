export const clamp = (val: number, min: number, max: number) => Math.max(Math.min(val, max), min);
export const clampLow = (val: number, min: number) => Math.max(val, min);
export const normalize = (val: number, min: number, max: number) => (val - min) / (max - min);
export const denormalize = (norm: number, min: number, max: number) => norm * (max - min) + min;
export const rand = (min: number, max: number) => {
  const buf = new Uint32Array(1);
  window.crypto.getRandomValues(buf);
  return denormalize(buf[0] / (0xffffffff + 1), min, max);
};
export const randRadial = (x: number, y: number, r: number) => {
  const R = r * Math.sqrt(rand(0, 1));
  const theta = rand(0, 1) * 2 * Math.PI;

  return { x: x + R * Math.cos(theta), y: y + R * Math.sin(theta) };
};
export const choose = <T>(vals: T[]): T => vals[Math.round(rand(0, vals.length - 1))];
const S4 = () => (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1);
export const luid = () => `${S4()}${S4()}`;
export const chance = (probability: number) => clamp(probability, 0, 1) > rand(0, 1);

export function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function xmur3(str: string) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    (h = Math.imul(h ^ str.charCodeAt(i), 3432918353)), (h = (h << 13) | (h >>> 19));
  }
  return function () {
    (h = Math.imul(h ^ (h >>> 16), 2246822507)), (h = Math.imul(h ^ (h >>> 13), 3266489909));
    return (h ^= h >>> 16) >>> 0;
  };
}
