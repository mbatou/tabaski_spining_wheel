import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/admin";
import { isValidSite, DEFAULT_SITE_RADIUS_M } from "@/lib/sites";
import { clearSiteCoords, setSiteCoords, snapshot } from "@/lib/store";
import { isValidLatLng } from "@/lib/geo";

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
  const lat = (body as { lat?: unknown })?.lat;
  const lng = (body as { lng?: unknown })?.lng;
  const radius = (body as { radiusM?: unknown })?.radiusM;
  if (!isValidSite(slug) || !isValidLatLng(lat, lng)) {
    return NextResponse.json({ error: "bad-input" }, { status: 400 });
  }
  const r = typeof radius === "number" && Number.isFinite(radius) && radius >= 20 && radius <= 2000
    ? Math.round(radius)
    : DEFAULT_SITE_RADIUS_M;
  setSiteCoords(slug, lat as number, lng as number, r);
  return NextResponse.json(snapshot());
}

export async function DELETE(req: Request) {
  if (!isAuthenticated()) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("site");
  if (!isValidSite(slug)) {
    return NextResponse.json({ error: "bad-input" }, { status: 400 });
  }
  clearSiteCoords(slug);
  return NextResponse.json(snapshot());
}
