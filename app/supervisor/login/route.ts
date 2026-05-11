import { NextResponse } from "next/server";
import { checkPassword, setAuthCookie } from "@/lib/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const formData = await req.formData();
  const password = String(formData.get("password") ?? "");
  if (!checkPassword(password)) {
    const url = new URL("/supervisor?error=1", req.url);
    return NextResponse.redirect(url, { status: 303 });
  }
  setAuthCookie();
  const url = new URL("/supervisor", req.url);
  return NextResponse.redirect(url, { status: 303 });
}
