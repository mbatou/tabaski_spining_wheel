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
import { PRIZES } from "./prizes";
import { DEFAULT_SITE_RADIUS_M, SITES, type SiteSlug } from "./sites";
import type { SiteCoords } from "./geo";
import { parseWeights, pickPrizeIndex } from "./spin";

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
    "market-2": {
      lat: 14.710236,
      lng: -17.44636,
      radiusM: DEFAULT_SITE_RADIUS_M,
      updatedAt: seededAt,
    },
    "market-3": {
      lat: 14.756742,
      lng: -17.396727,
      radiusM: DEFAULT_SITE_RADIUS_M,
      updatedAt: seededAt,
    },
    "market-4": {
      lat: 14.730488,
      lng: -17.462093,
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

// ─────────────────────────── Campaign report ───────────────────────────

const CAMPAIGN_START_DEFAULT = "2026-05-11";
const CAMPAIGN_END_DEFAULT = "2026-05-25";

function parseEnvDate(name: string, fallback: string): string {
  const v = process.env[name];
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return fallback;
  return v;
}

function isoToDateKey(iso: string): string {
  return iso.replaceAll("-", "");
}

function dateKeyToIso(key: string): string {
  return `${key.slice(0, 4)}-${key.slice(4, 6)}-${key.slice(6, 8)}`;
}

function* iterateDakarDays(startIso: string, endIso: string): Generator<string> {
  const [sy, sm, sd] = startIso.split("-").map(Number);
  const [ey, em, ed] = endIso.split("-").map(Number);
  // Use UTC math to avoid the local-TZ offset bug — Africa/Dakar is UTC+0,
  // so calendar days line up exactly with UTC days.
  let cur = Date.UTC(sy, sm - 1, sd);
  const end = Date.UTC(ey, em - 1, ed);
  while (cur <= end) {
    const d = new Date(cur);
    const iso = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
    yield iso;
    cur += 86_400_000;
  }
}

export type DailyBreakdown = {
  date: string; // ISO yyyy-mm-dd
  totals: { attempts: number; wins: number; losses: number };
  prizes: Record<Exclude<PrizeKey, "lose">, number>;
  siteBreakdown: { slug: SiteSlug; label: string; attempts: number; wins: number; losses: number }[];
};

export type SiteReportRow = {
  slug: SiteSlug;
  label: string;
  pending: boolean;
  winsEnabled: boolean;
  attempts: number;
  wins: number;
  losses: number;
  prizes: Record<Exclude<PrizeKey, "lose">, number>;
  winRate: number;
};

export type CampaignReport = {
  generatedAt: number;
  campaignStart: string;
  campaignEnd: string;
  status: "live" | "ended" | "not-started";
  persistent: boolean;
  summary: {
    totalAttempts: number;
    totalWins: number;
    totalLosses: number;
    winRate: number;
    activeDays: number;
    siteCount: number;
  };
  stock: Record<
    Exclude<PrizeKey, "lose">,
    { initial: number; remaining: number; distributed: number; pct: number }
  >;
  sites: SiteReportRow[];
  daily: DailyBreakdown[];
};

export function reportSnapshot(): CampaignReport {
  const s = getStore();
  const start = parseEnvDate("CAMPAIGN_START", CAMPAIGN_START_DEFAULT);
  const end = parseEnvDate("CAMPAIGN_END", CAMPAIGN_END_DEFAULT);
  const todayIso = dateKeyToIso(dakarDateKey());

  const status: "live" | "ended" | "not-started" =
    todayIso < start ? "not-started" : todayIso > end ? "ended" : "live";

  const stockNow = { ...s.stock };
  const stockInit = initialStock();
  const stock = (Object.keys(stockInit) as Exclude<PrizeKey, "lose">[]).reduce(
    (acc, k) => {
      const initial = stockInit[k];
      const remaining = stockNow[k];
      const distributed = Math.max(0, initial - remaining);
      acc[k] = { initial, remaining, distributed, pct: initial === 0 ? 0 : distributed / initial };
      return acc;
    },
    {} as CampaignReport["stock"],
  );

  // Iterate every day of the campaign so the timeline includes zero-activity days.
  // Cap the upper bound at min(today, campaignEnd). Site rows are derived from
  // these per-day tallies so summary, sites and daily always reconcile.
  const upper = todayIso < end ? todayIso : end;
  const dailyDates = todayIso < start ? [] : [...iterateDakarDays(start, upper)];

  const sitesAcc: Record<SiteSlug, SpinTally> = Object.fromEntries(
    SITES.map((s) => [s.slug, emptyTally()]),
  ) as Record<SiteSlug, SpinTally>;

  const daily: DailyBreakdown[] = dailyDates.map((iso) => {
    const key = isoToDateKey(iso);
    const dayTotals = { attempts: 0, wins: 0, losses: 0 };
    const dayPrizes = { sac: 0, tablier: 0, eventail: 0, gourde: 0 } as Record<
      Exclude<PrizeKey, "lose">,
      number
    >;
    const siteRows: DailyBreakdown["siteBreakdown"] = [];
    for (const site of SITES) {
      const tally = s.daily.get(`${site.slug}:${key}`) ?? emptyTally();
      const wins = tally.wins.sac + tally.wins.tablier + tally.wins.eventail + tally.wins.gourde;
      dayTotals.attempts += tally.attempts;
      dayTotals.wins += wins;
      dayTotals.losses += tally.losses;
      dayPrizes.sac += tally.wins.sac;
      dayPrizes.tablier += tally.wins.tablier;
      dayPrizes.eventail += tally.wins.eventail;
      dayPrizes.gourde += tally.wins.gourde;
      siteRows.push({
        slug: site.slug,
        label: site.label,
        attempts: tally.attempts,
        wins,
        losses: tally.losses,
      });
      // Roll the site accumulator forward.
      const acc = sitesAcc[site.slug];
      acc.attempts += tally.attempts;
      acc.losses += tally.losses;
      acc.wins.sac += tally.wins.sac;
      acc.wins.tablier += tally.wins.tablier;
      acc.wins.eventail += tally.wins.eventail;
      acc.wins.gourde += tally.wins.gourde;
    }
    return { date: iso, totals: dayTotals, prizes: dayPrizes, siteBreakdown: siteRows };
  });

  const sites: SiteReportRow[] = SITES.map((site) => {
    const t = sitesAcc[site.slug];
    const winsTotal = t.wins.sac + t.wins.tablier + t.wins.eventail + t.wins.gourde;
    return {
      slug: site.slug,
      label: site.label,
      pending: site.pending === true,
      winsEnabled: s.sites[site.slug].winsEnabled,
      attempts: t.attempts,
      wins: winsTotal,
      losses: t.losses,
      prizes: { ...t.wins },
      winRate: t.attempts === 0 ? 0 : winsTotal / t.attempts,
    };
  });

  const totalAttempts = sites.reduce((a, x) => a + x.attempts, 0);
  const totalWins = sites.reduce((a, x) => a + x.wins, 0);
  const totalLosses = sites.reduce((a, x) => a + x.losses, 0);
  const activeDays = daily.filter((d) => d.totals.attempts > 0).length;

  return {
    generatedAt: Date.now(),
    campaignStart: start,
    campaignEnd: end,
    status,
    persistent: Boolean(process.env.UPSTASH_REDIS_REST_URL),
    summary: {
      totalAttempts,
      totalWins,
      totalLosses,
      winRate: totalAttempts === 0 ? 0 : totalWins / totalAttempts,
      activeDays,
      siteCount: sites.filter((s) => !s.pending).length,
    },
    stock,
    sites,
    daily,
  };
}

// ─────────────────────────── Demo data seeding ───────────────────────────

/**
 * Deterministic PRNG (mulberry32). Same seed → same numbers → consistent
 * demo data across reloads, which matters when ATL presents the report.
 */
function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type SeedResult = {
  spinsGenerated: number;
  daysCovered: number;
  campaignStart: string;
  campaignEnd: string;
};

/**
 * Wipe the in-process store and replace it with a realistic distribution of
 * spins across the campaign window. The shape mimics what we'd expect on the
 * ground: light first few days while word spreads, a peak around Tabaski day,
 * a slow wind-down after. Per-site share is weighted toward the busier
 * downtown sites (Case Bi, HLM) with Pikine and Rufisque a bit smaller.
 *
 * Deterministic for a given (start, end) so re-running the seed yields the
 * same numbers — important for repeat presentations.
 */
export function seedDemoData(args?: { start?: string; end?: string }): SeedResult {
  const s = getStore();
  const start = args?.start ?? parseEnvDate("CAMPAIGN_START", CAMPAIGN_START_DEFAULT);
  const end = args?.end ?? parseEnvDate("CAMPAIGN_END", CAMPAIGN_END_DEFAULT);

  // Reset everything we touch
  s.daily.clear();
  s.total.clear();
  s.stock = initialStock();

  const weights = parseWeights(process.env.SPIN_WEIGHTS);

  // Per-day relative weight — slow ramp, peak ~ days 8–11, then wind-down
  const dayCurve = [
    0.30, 0.45, 0.60, 0.80,
    0.95, 1.10, 1.20, 1.35,
    1.45, 1.50, 1.40, 1.20,
    1.00, 0.80, 0.55,
  ];
  // Per-site share (must sum ≈ 1.0; pending sites get 0)
  const siteShare: Record<SiteSlug, number> = {
    "market-1": 0.34, // Rond-point Case Bi — busiest
    "market-2": 0.26, // Marché HLM
    "market-3": 0.24, // Marché Pikine
    "market-4": 0.16, // Marché Djouti Ba Rufisque
    "roaming-truck": 0,
  };

  // Target total ~ 4 800 spins across the campaign — leaves comfortable headroom
  // on the 3 200-piece prize stock with the 50% lose weight.
  const targetTotal = 4_800;
  const days = [...iterateDakarDays(start, end)];
  const curveSum = dayCurve.slice(0, days.length).reduce((a, b) => a + b, 0);
  const scale = curveSum === 0 ? 0 : targetTotal / curveSum;

  // Seed the PRNG with a hash of the date range so the numbers are stable.
  const seedSeed = (start + end).split("").reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619), 0x811c9dc5);
  const rand = makeRng(seedSeed);

  let totalSpins = 0;
  days.forEach((iso, idx) => {
    const dayKey = isoToDateKey(iso);
    const dayTotal = Math.round((dayCurve[idx] ?? 0.5) * scale);

    for (const site of SITES) {
      if (site.pending) continue;
      const share = siteShare[site.slug] ?? 0;
      if (share === 0) continue;
      // Add some daily jitter ±15 % so sites don't move in perfect lockstep
      const jitter = 1 + (rand() - 0.5) * 0.3;
      const siteSpins = Math.max(0, Math.round(dayTotal * share * jitter));

      const tally = emptyTally();
      const total = s.total.get(site.slug) ?? emptyTally();

      for (let i = 0; i < siteSpins; i++) {
        const intendedIdx = pickPrizeIndex(weights, rand);
        const intended = PRIZES[intendedIdx];

        tally.attempts += 1;
        total.attempts += 1;

        if (intended.key === "lose") {
          tally.losses += 1;
          total.losses += 1;
        } else {
          const remaining = s.stock[intended.key];
          if (remaining <= 0) {
            tally.losses += 1;
            total.losses += 1;
          } else {
            s.stock[intended.key] = remaining - 1;
            tally.wins[intended.key] += 1;
            total.wins[intended.key] += 1;
          }
        }
        totalSpins += 1;
      }

      s.daily.set(`${site.slug}:${dayKey}`, tally);
      s.total.set(site.slug, total);
    }
  });

  return {
    spinsGenerated: totalSpins,
    daysCovered: days.length,
    campaignStart: start,
    campaignEnd: end,
  };
}

/**
 * Reset the in-process store to its initial empty state. Used to clear demo
 * data before resuming real activity.
 */
export function resetStore(): void {
  const s = getStore();
  s.daily.clear();
  s.total.clear();
  s.stock = initialStock();
  // Site coords + winsEnabled are deliberately preserved — those are
  // configuration, not campaign data.
}
