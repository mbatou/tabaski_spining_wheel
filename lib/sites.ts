export type SiteSlug = "market-1" | "market-2" | "market-3" | "market-4" | "roaming-truck";

export type SiteMeta = {
  slug: SiteSlug;
  label: string;
  short: string;
  /** When true, the site is a placeholder that can't yet match a spin (e.g. the roaming truck before its location is published). */
  pending?: boolean;
};

export const SITES: readonly SiteMeta[] = [
  { slug: "market-1",      label: "Rond-point Case Bi",  short: "RCB" },
  { slug: "market-2",      label: "Marché HLM",          short: "HLM" },
  { slug: "market-3",      label: "Marché 3",            short: "M3" },
  { slug: "market-4",      label: "Marché 4",            short: "M4" },
  { slug: "roaming-truck", label: "Camion itinérant",    short: "RT", pending: true },
];

export const SITE_SLUGS: readonly SiteSlug[] = SITES.map((s) => s.slug);

export const DEFAULT_SITE_RADIUS_M = 100;

export function isValidSite(slug: unknown): slug is SiteSlug {
  return typeof slug === "string" && (SITE_SLUGS as readonly string[]).includes(slug);
}

export function siteLabel(slug: SiteSlug): string {
  return SITES.find((s) => s.slug === slug)?.label ?? slug;
}

export function isPendingSite(slug: SiteSlug): boolean {
  return SITES.find((s) => s.slug === slug)?.pending === true;
}
