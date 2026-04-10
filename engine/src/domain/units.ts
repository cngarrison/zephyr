// Unit conversion utilities — all convert TO SI (metric) units.
export const Units = {
  fToC: (f: number): number => (f - 32) * 5 / 9,
  inHgToHpa: (inHg: number): number => inHg * 33.8639,
  mphToMs: (mph: number): number => mph * 0.44704,
  inToMm: (inches: number): number => inches * 25.4,
  inHrToMmHr: (inHr: number): number => inHr * 25.4,
} as const;
