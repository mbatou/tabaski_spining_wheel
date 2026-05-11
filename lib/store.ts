/**
 * In-process store for spin state. This is a TEMPORARY backing for the
 * supervisor panel and the per-site spin logic — it is NOT durable and will
 * reset on every server restart / on Vercel cold starts.
 *
 * Chunk 2 swaps this module for an Upstash Redis–backed implementation that
 * exposes the same exported surface (snapshot, setSiteWinsEnabled, setStock,
 * setSiteCoords, clearSiteCoords, recordSpin).
 */

import type { PrizeKey } from "./prizes";
import { DEFAULT_SITE_RADIUS_M, SITES, type SiteSlug } from "./sites";
import type { SiteCoords } from "./geo";

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

function initialSites(): Record<SiteSlug, { winsEnabled: boolean; coords: SiteCoords | null }> {
  const seededAt = Date.now();
  // Seeded coordinates for sites known at build time. Supervisors can override
  // any of these from /supervisor (the in-process store accepts updates; chunk
  // 2 will persist them through Upstash Redis so panel edits survive restarts).
  const seeds: Partial<Record<SiteSlug, SiteCoords>> = {
    "market-1": {
      lat: 14.7565966,
      lng: -17.429081,
      radiusM: DEFAULT_SITE_RADIUS_M,
      updatedAt: seededAt,
    },
  };
  return Object.fromEntries(
    SITES.map((s) => [s.slug, { winsEnabled: true, coords: seeds[s.slug] ?? null }]),
  ) as Record<SiteSlug, { winsEnabled: boolean; coords: SiteCoords | null }>;
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
  sites: Record<SiteSlug, { winsEnabled: boolean; coords: SiteCoords | null }>;
  daily: Map<string, SpinTally>; // key: `${siteSlug}:${yyyymmdd}`
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
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Dakar",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(now)
    .replaceAll("-", "");
}

export type SiteSnapshot = {
  slug: SiteSlug;
  label: string;
  pending: boolean;
  winsEnabled: boolean;
  coords: SiteCoords | null;
  today: SpinTally;
  total: SpinTally;
};

export type StoreSnapshot = {
  stock: Record<Exclude<PrizeKey, "lose">, number>;
  initialStock: Record<Exclude<PrizeKey, "lose">, number>;
  sites: SiteSnapshot[];
  totals: { attempts: number; wins: number; losses: number };
  dakarDate: string;
};

export function snapshot(): StoreSnapshot {
  const s = getStore();
  const today = dakarDateKey();
  const sitesView: SiteSnapshot[] = SITES.map((site) => {
    const tally = s.daily.get(`${site.slug}:${today}`) ?? emptyTally();
    const total = s.total.get(site.slug) ?? emptyTally();
    return {
      slug: site.slug,
      label: site.label,
      pending: site.pending === true,
      winsEnabled: s.sites[site.slug].winsEnabled,
      coords: s.sites[site.slug].coords,
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

export function setSiteCoords(slug: SiteSlug, lat: number, lng: number, radiusM = DEFAULT_SITE_RADIUS_M): void {
  const s = getStore();
  if (!s.sites[slug]) return;
  s.sites[slug].coords = { lat, lng, radiusM, updatedAt: Date.now() };
}

export function clearSiteCoords(slug: SiteSlug): void {
  const s = getStore();
  if (!s.sites[slug]) return;
  s.sites[slug].coords = null;
}

export function setStock(prize: Exclude<PrizeKey, "lose">, value: number): void {
  const s = getStore();
  s.stock[prize] = Math.max(0, Math.floor(value));
}

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
