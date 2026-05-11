import type { SiteSlug } from "./sites";

export type Coords = { lat: number; lng: number };
export type SiteCoords = Coords & { radiusM: number; updatedAt: number };

const EARTH_R_M = 6_371_008.8; // mean Earth radius in metres (IUGG)

export function haversineMeters(a: Coords, b: Coords): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const x =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_R_M * Math.asin(Math.min(1, Math.sqrt(x)));
}

export type SiteWithCoords = {
  slug: SiteSlug;
  label: string;
  winsEnabled: boolean;
  coords: SiteCoords;
};

export type SiteMatch = {
  slug: SiteSlug;
  label: string;
  winsEnabled: boolean;
  distanceM: number;
};

/**
 * Find the closest configured site within its radius. Returns null if the user
 * is outside every configured geofence. Pending or unconfigured sites are
 * ignored.
 */
export function findSiteForLocation(
  sites: readonly SiteWithCoords[],
  user: Coords,
): SiteMatch | null {
  let best: SiteMatch | null = null;
  for (const s of sites) {
    const d = haversineMeters(user, { lat: s.coords.lat, lng: s.coords.lng });
    if (d <= s.coords.radiusM && (best === null || d < best.distanceM)) {
      best = { slug: s.slug, label: s.label, winsEnabled: s.winsEnabled, distanceM: d };
    }
  }
  return best;
}

/**
 * Return the N closest configured sites that have wins enabled, sorted by
 * distance. Used to suggest where to go when a user is out of range.
 */
export function nearestEnabledSites(
  sites: readonly SiteWithCoords[],
  user: Coords,
  limit = 3,
): { slug: SiteSlug; label: string; lat: number; lng: number; distanceM: number }[] {
  return sites
    .filter((s) => s.winsEnabled)
    .map((s) => ({
      slug: s.slug,
      label: s.label,
      lat: s.coords.lat,
      lng: s.coords.lng,
      distanceM: haversineMeters(user, { lat: s.coords.lat, lng: s.coords.lng }),
    }))
    .sort((a, b) => a.distanceM - b.distanceM)
    .slice(0, limit);
}

export function isValidCoord(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

export function isValidLatLng(lat: unknown, lng: unknown): lat is number {
  return (
    isValidCoord(lat) && isValidCoord(lng) && (lat as number) >= -90 && (lat as number) <= 90 && (lng as number) >= -180 && (lng as number) <= 180
  );
}
