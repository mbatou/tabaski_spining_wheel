/**
 * In-process store for spin state. This is a TEMPORARY backing for the
 * supervisor panel and the per-site spin logic — it is NOT durable and will
 * reset on every server restart / on Vercel cold starts.
 *
 * Chunk 2 swaps this module for an Upstash Redis–backed implementation that
 * exposes the same exported surface (read, toggleSite, adjustStock, recordSpin).
 *
 * Until then, this is fine for a single dev session and for clicking through
 * the supervisor panel UI to validate the flow with the campaign chief.
 */

import { PRIZES, type PrizeKey } from "./prizes";
import { SITES, type SiteSlug } from "./sites";

const PRIZE_STOCK_DEFAULTS: Record<Exclude<PrizeKey, "lose">, number> = {
  sac: 1500,
  tablier: 600,
  eventail: 600,
  gourde: 500,
};

function readEnvInt(name: string, fallback: number): number {
  const v = process.env[name];
  if (!v) return fallback;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback;
}

function initialStock(): Record<Exclude<PrizeKey, "lose">, number> {
  return {
    sac: readEnvInt("PRIZE_STOCK_SAC", PRIZE_STOCK_DEFAULTS.sac),
    tablier: readEnvInt("PRIZE_STOCK_TABLIER", PRIZE_STOCK_DEFAULTS.tablier),
    eventail: readEnvInt("PRIZE_STOCK_EVENTAIL", PRIZE_STOCK_DEFAULTS.eventail),
    gourde: readEnvInt("PRIZE_STOCK_GOURDE", PRIZE_STOCK_DEFAULTS.gourde),
  };
}

function initialSites(): Record<SiteSlug, { winsEnabled: boolean }> {
  return Object.fromEntries(SITES.map((s) => [s.slug, { winsEnabled: true }])) as Record<
    SiteSlug,
    { winsEnabled: boolean }
  >;
}

export type SpinTally = {
  attempts: number;
  wins: Record<Exclude<PrizeKey, "lose">, number>;
  losses: number;
};

function emptyTally(): SpinTally {
  return {
    attempts: 0,
    wins: { sac: 0, tablier: 0, eventail: 0, gourde: 0 },
    losses: 0,
  };
}

type StoreState = {
  stock: Record<Exclude<PrizeKey, "lose">, number>;
  sites: Record<SiteSlug, { winsEnabled: boolean }>;
  // tally key: `${siteSlug}:${yyyymmdd}`
  daily: Map<string, SpinTally>;
  // total tally per site over the whole campaign
  total: Map<SiteSlug, SpinTally>;
};

const g = globalThis as unknown as { __waveStore?: StoreState };

function getStore(): StoreState {
  if (!g.__waveStore) {
    g.__waveStore = {
      stock: initialStock(),
      sites: initialSites(),
      daily: new Map(),
      total: new Map(),
    };
  }
  return g.__waveStore;
}

export function dakarDateKey(now: Date = new Date()): string {
  // YYYYMMDD in Africa/Dakar (UTC+0, no DST)
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Dakar",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(now).replaceAll("-", "");
}

export type StoreSnapshot = {
  stock: Record<Exclude<PrizeKey, "lose">, number>;
  initialStock: Record<Exclude<PrizeKey, "lose">, number>;
  sites: { slug: SiteSlug; label: string; winsEnabled: boolean; today: SpinTally; total: SpinTally }[];
  totals: { attempts: number; wins: number; losses: number };
  dakarDate: string;
};

export function snapshot(): StoreSnapshot {
  const s = getStore();
  const today = dakarDateKey();
  const sitesView = SITES.map((site) => {
    const tally = s.daily.get(`${site.slug}:${today}`) ?? emptyTally();
    const total = s.total.get(site.slug) ?? emptyTally();
    return {
      slug: site.slug,
      label: site.label,
      winsEnabled: s.sites[site.slug].winsEnabled,
      today: tally,
      total,
    };
  });
  const totals = sitesView.reduce(
    (acc, v) => {
      acc.attempts += v.total.attempts;
      acc.wins +=
        v.total.wins.sac + v.total.wins.tablier + v.total.wins.eventail + v.total.wins.gourde;
      acc.losses += v.total.losses;
      return acc;
    },
    { attempts: 0, wins: 0, losses: 0 },
  );
  return {
    stock: { ...s.stock },
    initialStock: initialStock(),
    sites: sitesView,
    totals,
    dakarDate: today,
  };
}

export function setSiteWinsEnabled(slug: SiteSlug, enabled: boolean): void {
  const s = getStore();
  if (!s.sites[slug]) return;
  s.sites[slug].winsEnabled = enabled;
}

export function setStock(prize: Exclude<PrizeKey, "lose">, value: number): void {
  const s = getStore();
  s.stock[prize] = Math.max(0, Math.floor(value));
}

/**
 * Atomically resolve a spin. Returns the outcome to surface to the user.
 * Honours per-site wins-enabled flag and global stock.
 *
 * Precondition: `pickPrizeIndex` already chose `intendedPrize` from weights.
 */
export function recordSpin(args: {
  site: SiteSlug;
  intendedPrize: PrizeKey;
}): { resolved: PrizeKey; reason: "won" | "lose-segment" | "site-disabled" | "out-of-stock" } {
  const s = getStore();
  const today = dakarDateKey();
  const dailyKey = `${args.site}:${today}`;
  const dailyTally = s.daily.get(dailyKey) ?? emptyTally();
  const totalTally = s.total.get(args.site) ?? emptyTally();

  dailyTally.attempts += 1;
  totalTally.attempts += 1;

  const siteEnabled = s.sites[args.site]?.winsEnabled ?? false;

  let resolved: PrizeKey = args.intendedPrize;
  let reason: "won" | "lose-segment" | "site-disabled" | "out-of-stock" = "lose-segment";

  if (args.intendedPrize === "lose") {
    resolved = "lose";
    reason = "lose-segment";
    dailyTally.losses += 1;
    totalTally.losses += 1;
  } else if (!siteEnabled) {
    resolved = "lose";
    reason = "site-disabled";
    dailyTally.losses += 1;
    totalTally.losses += 1;
  } else if (s.stock[args.intendedPrize] <= 0) {
    resolved = "lose";
    reason = "out-of-stock";
    dailyTally.losses += 1;
    totalTally.losses += 1;
  } else {
    s.stock[args.intendedPrize] -= 1;
    dailyTally.wins[args.intendedPrize] += 1;
    totalTally.wins[args.intendedPrize] += 1;
    reason = "won";
  }

  s.daily.set(dailyKey, dailyTally);
  s.total.set(args.site, totalTally);
  return { resolved, reason };
}

// Re-export for tests
export const _internal = { getStore, emptyTally, PRIZES };
