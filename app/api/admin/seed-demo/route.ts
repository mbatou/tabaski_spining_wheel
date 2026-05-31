import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/admin";
import { resetStore, seedDemoData } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!isAuthenticated()) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  let body: { start?: string; end?: string } | undefined;
  try {
    body = await req.json();
  } catch {
    body = undefined;
  }
  const result = seedDemoData(body);
  return NextResponse.json(result);
}

export async function DELETE() {
  if (!isAuthenticated()) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  resetStore();
  return NextResponse.json({ ok: true });
}
