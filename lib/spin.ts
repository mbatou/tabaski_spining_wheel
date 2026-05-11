import { PRIZES, type PrizeKey } from "./prizes";
import type { SiteSlug } from "./sites";

export type SpinPayload = {
  outcome: "win" | "lose";
  prizeKey: PrizeKey;
  segmentIndex: number;
  spinsLeftToday: number;
  spinsLeftTotal: number;
  site: { slug: SiteSlug; label: string };
};

export type NearestSiteSuggestion = {
  slug: SiteSlug;
  label: string;
  lat: number;
  lng: number;
  distanceM: number;
};

export type SpinResponse =
  | { status: "ok"; spin: SpinPayload }
  | { status: "out-of-range"; nearestSites: NearestSiteSuggestion[] }
  | { status: "site-disabled"; siteLabel: string }
  | { status: "no-location" };

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
