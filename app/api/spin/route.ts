import { NextResponse } from "next/server";
import {
  LOSE_INDEX,
  parseWeights,
  pickPrizeIndex,
  type SpinResponse,
} from "@/lib/spin";
import { PRIZES } from "@/lib/prizes";
import { findSiteForLocation, isValidLatLng, nearestEnabledSites, type SiteWithCoords } from "@/lib/geo";
import { recordSpin, snapshot } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Geo-gated spin endpoint.
 *
 *   - Requires { lat, lng, accuracy } in the body.
 *   - Matches the user to the closest configured site within its radius.
 *   - If no match → returns the 3 nearest enabled sites for the UI to suggest.
 *   - If matched but wins disabled → returns site-disabled.
 *   - Otherwise → runs the weighted draw, decrements global stock if a prize
 *     bucket is non-empty, returns the spin payload to the client.
 *
 * Per-user spin caps (2/day, 8 total) are still client-supplied in chunk 1.
 * Chunk 2 swaps that for a signed cookie + Redis counters.
 */
export async function POST(req: Request): Promise<NextResponse<SpinResponse>> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json<SpinResponse>({ status: "no-location" }, { status: 400 });
  }

  const lat = (body as { lat?: unknown })?.lat;
  const lng = (body as { lng?: unknown })?.lng;
  if (!isValidLatLng(lat, lng)) {
    return NextResponse.json<SpinResponse>({ status: "no-location" }, { status: 400 });
  }
  const userCoords = { lat: lat as number, lng: lng as number };

  // accuracy is logged but not gated on for v1
  const _accuracy = (body as { accuracy?: unknown })?.accuracy;

  // Configured sites (only those with coords + not pending)
  const snap = snapshot();
  const sitesWithCoords: SiteWithCoords[] = snap.sites
    .filter((s) => !s.pending && s.coords !== null)
    .map((s) => ({
      slug: s.slug,
      label: s.label,
      winsEnabled: s.winsEnabled,
      coords: s.coords!,
    }));

  const match = findSiteForLocation(sitesWithCoords, userCoords);
  if (!match) {
    return NextResponse.json<SpinResponse>({
      status: "out-of-range",
      nearestSites: nearestEnabledSites(sitesWithCoords, userCoords, 3),
    });
  }

  if (!match.winsEnabled) {
    return NextResponse.json<SpinResponse>({
      status: "site-disabled",
      siteLabel: match.label,
    });
  }

  // Counters (client-supplied until chunk 2)
  let counters = { spinsLeftToday: 1, spinsLeftTotal: 7 };
  const cToday = (body as { spinsLeftToday?: unknown })?.spinsLeftToday;
  const cTotal = (body as { spinsLeftTotal?: unknown })?.spinsLeftTotal;
  if (typeof cToday === "number" && typeof cTotal === "number") {
    counters = {
      spinsLeftToday: Math.max(0, cToday - 1),
      spinsLeftTotal: Math.max(0, cTotal - 1),
    };
  }

  // Weighted draw + atomic resolve via the store
  const weights = parseWeights(process.env.SPIN_WEIGHTS);
  const intendedIdx = pickPrizeIndex(weights);
  const intended = PRIZES[intendedIdx];
  const { resolved } = recordSpin({ site: match.slug, intendedPrize: intended.key });

  if (resolved === "lose") {
    return NextResponse.json<SpinResponse>({
      status: "ok",
      spin: {
        outcome: "lose",
        prizeKey: "lose",
        segmentIndex: LOSE_INDEX,
        ...counters,
        site: { slug: match.slug, label: match.label },
      },
    });
  }

  return NextResponse.json<SpinResponse>({
    status: "ok",
    spin: {
      outcome: "win",
      prizeKey: resolved,
      segmentIndex: PRIZES.findIndex((p) => p.key === resolved),
      ...counters,
      site: { slug: match.slug, label: match.label },
    },
  });
}
