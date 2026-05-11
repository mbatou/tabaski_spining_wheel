import { NextResponse } from "next/server";
import { LOSE_INDEX, parseWeights, pickPrizeIndex, type SpinResult } from "@/lib/spin";
import { PRIZES } from "@/lib/prizes";
import { isValidSite, type SiteSlug } from "@/lib/sites";
import { recordSpin } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Site-aware spin. Per-user counters are still client-supplied (real
 * server-side enforcement lands in chunk 2 with Redis + cookie identity).
 *
 * Server-side authoritative behavior in chunk 1:
 *   - per-site wins-enabled toggle (from supervisor panel)
 *   - global stock decrement (force-lose if exhausted)
 *   - per-site daily + total tallies
 */
export async function POST(req: Request): Promise<NextResponse<SpinResult | { error: string }>> {
  const weights = parseWeights(process.env.SPIN_WEIGHTS);
  const intendedIdx = pickPrizeIndex(weights);
  const intended = PRIZES[intendedIdx];

  let counters = { spinsLeftToday: 1, spinsLeftTotal: 7 };
  let site: SiteSlug = "unassigned";
  try {
    const body = await req.json();
    if (typeof body?.spinsLeftToday === "number" && typeof body?.spinsLeftTotal === "number") {
      counters = {
        spinsLeftToday: Math.max(0, body.spinsLeftToday - 1),
        spinsLeftTotal: Math.max(0, body.spinsLeftTotal - 1),
      };
    }
    if (isValidSite(body?.site)) site = body.site;
  } catch {
    /* no body — keep defaults */
  }

  const { resolved } = recordSpin({ site, intendedPrize: intended.key });

  if (resolved === "lose") {
    return NextResponse.json({
      outcome: "lose",
      prizeKey: "lose",
      // Important: animate to the segment the user "would have" won, only when
      // the lose was forced by inventory/site disable. For honest losses, land
      // on the lose segment as the prototype expects.
      segmentIndex: intended.key === "lose" ? LOSE_INDEX : LOSE_INDEX,
      ...counters,
    } satisfies SpinResult);
  }

  return NextResponse.json({
    outcome: "win",
    prizeKey: resolved,
    segmentIndex: PRIZES.findIndex((p) => p.key === resolved),
    ...counters,
  } satisfies SpinResult);
}
