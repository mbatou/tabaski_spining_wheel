import { NextResponse } from "next/server";
import { findSiteForLocation, isValidLatLng, nearestEnabledSites, type SiteWithCoords } from "@/lib/geo";
import type { NearestSiteSuggestion } from "@/lib/spin";
import { snapshot } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export type LocationCheck =
  | { status: "ok"; site: { slug: string; label: string }; distanceM: number }
  | { status: "out-of-range"; nearestSites: NearestSiteSuggestion[] }
  | { status: "site-disabled"; siteLabel: string }
  | { status: "no-location" };

/**
 * Non-mutating location check. Returns whether the user is in range of an
 * active site, without consuming a spin attempt or touching any counters.
 */
export async function POST(req: Request): Promise<NextResponse<LocationCheck>> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json<LocationCheck>({ status: "no-location" }, { status: 400 });
  }
  const lat = (body as { lat?: unknown })?.lat;
  const lng = (body as { lng?: unknown })?.lng;
  if (!isValidLatLng(lat, lng)) {
    return NextResponse.json<LocationCheck>({ status: "no-location" }, { status: 400 });
  }
  const user = { lat: lat as number, lng: lng as number };

  const snap = snapshot();
  const sitesWithCoords: SiteWithCoords[] = snap.sites
    .filter((s) => !s.pending && s.coords !== null)
    .map((s) => ({
      slug: s.slug,
      label: s.label,
      winsEnabled: s.winsEnabled,
      coords: s.coords!,
    }));

  const match = findSiteForLocation(sitesWithCoords, user);
  if (!match) {
    return NextResponse.json<LocationCheck>({
      status: "out-of-range",
      nearestSites: nearestEnabledSites(sitesWithCoords, user, 3),
    });
  }
  if (!match.winsEnabled) {
    return NextResponse.json<LocationCheck>({ status: "site-disabled", siteLabel: match.label });
  }
  return NextResponse.json<LocationCheck>({
    status: "ok",
    site: { slug: match.slug, label: match.label },
    distanceM: Math.round(match.distanceM),
  });
}
