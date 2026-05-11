import { NextResponse } from "next/server";
import { LOSE_INDEX, parseWeights, pickPrizeIndex, type SpinResult } from "@/lib/spin";
import { PRIZES } from "@/lib/prizes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * MOCKED endpoint for chunk 1 — picks a weighted-random outcome with no
 * persistence, no rate limits, no inventory. Real implementation lands in
 * chunk 2 (Redis + Lua + cookie identity).
 */
export async function POST(req: Request): Promise<NextResponse<SpinResult | { error: string }>> {
  const weights = parseWeights(process.env.SPIN_WEIGHTS);
  const idx = pickPrizeIndex(weights);
  const prize = PRIZES[idx];

  // Echo client-supplied "fake" counters from the request so the UI flow looks
  // realistic until chunk 2 wires server-side counters.
  let counters = { spinsLeftToday: 1, spinsLeftTotal: 7 };
  try {
    const body = await req.json();
    if (typeof body?.spinsLeftToday === "number" && typeof body?.spinsLeftTotal === "number") {
      counters = {
        spinsLeftToday: Math.max(0, body.spinsLeftToday - 1),
        spinsLeftTotal: Math.max(0, body.spinsLeftTotal - 1),
      };
    }
  } catch {
    /* no body — keep defaults */
  }

  if (prize.key === "lose") {
    return NextResponse.json({
      outcome: "lose",
      prizeKey: "lose",
      segmentIndex: LOSE_INDEX,
      ...counters,
    } satisfies SpinResult);
  }
  return NextResponse.json({
    outcome: "win",
    prizeKey: prize.key,
    segmentIndex: idx,
    ...counters,
  } satisfies SpinResult);
}
