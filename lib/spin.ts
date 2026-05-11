import { PRIZES, type PrizeKey } from "./prizes";

export type SpinOutcome =
  | { outcome: "win"; prizeKey: Exclude<PrizeKey, "lose">; segmentIndex: number }
  | { outcome: "lose"; prizeKey: "lose"; segmentIndex: number };

export type SpinResult = SpinOutcome & {
  spinsLeftToday: number;
  spinsLeftTotal: number;
};

export function pickPrizeIndex(weights: readonly number[], rand: () => number = Math.random): number {
  const total = weights.reduce((s, w) => s + w, 0);
  let r = rand() * total;
  for (let i = 0; i < weights.length; i++) {
    if (r < weights[i]) return i;
    r -= weights[i];
  }
  return weights.length - 1;
}

export const LOSE_INDEX = PRIZES.findIndex((p) => p.key === "lose");

export function parseWeights(env: string | undefined): number[] {
  const fallback = [25, 10, 10, 5, 50];
  if (!env) return fallback;
  const parts = env.split(",").map((s) => Number(s.trim()));
  if (parts.length !== PRIZES.length || parts.some((n) => !Number.isFinite(n) || n < 0)) {
    return fallback;
  }
  return parts;
}
