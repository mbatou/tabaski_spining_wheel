import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/admin";
import { isValidSite } from "@/lib/sites";
import { setSiteWinsEnabled, snapshot } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
  const slug = (body as { site?: unknown })?.site;
  const enabled = (body as { winsEnabled?: unknown })?.winsEnabled;
  if (!isValidSite(slug) || typeof enabled !== "boolean") {
    return NextResponse.json({ error: "bad-input" }, { status: 400 });
  }
  setSiteWinsEnabled(slug, enabled);
  return NextResponse.json(snapshot());
}
