import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/admin";
import { setStock, snapshot } from "@/lib/store";
import type { PrizeKey } from "@/lib/prizes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_PRIZES: Exclude<PrizeKey, "lose">[] = ["sac", "tablier", "eventail", "gourde"];

export async function POST(req: Request) {
  if (!isAuthenticated()) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid-json" }, { status: 400 });
  }
  const prize = (body as { prize?: unknown })?.prize;
  const value = (body as { value?: unknown })?.value;
  if (!VALID_PRIZES.includes(prize as Exclude<PrizeKey, "lose">) || typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return NextResponse.json({ error: "bad-input" }, { status: 400 });
  }
  setStock(prize as Exclude<PrizeKey, "lose">, value);
  return NextResponse.json(snapshot());
}
