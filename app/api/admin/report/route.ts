import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/admin";
import { reportSnapshot } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!isAuthenticated()) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json(reportSnapshot());
}
