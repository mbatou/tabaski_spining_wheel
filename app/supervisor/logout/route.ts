import { NextResponse } from "next/server";
import { clearAuthCookie } from "@/lib/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  clearAuthCookie();
  return NextResponse.redirect(new URL("/supervisor", req.url), { status: 303 });
}
