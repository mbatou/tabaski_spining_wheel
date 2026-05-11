import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const COOKIE_NAME = "wave_sup";
const COOKIE_MAX_AGE_SEC = 60 * 60 * 12; // 12 hours

function secret(): string {
  return process.env.COOKIE_SECRET || "dev-only-secret-change-me";
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("hex");
}

export function checkPassword(input: string): boolean {
  const expected = process.env.SUPERVISOR_PASSWORD;
  if (!expected) return false;
  const a = Buffer.from(input);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function makeSessionToken(): string {
  // Cookie value is HMAC over a fixed payload — anyone with COOKIE_SECRET could
  // forge it, but the secret never leaves the server. Good enough for the
  // single-shared-password model agreed with ATL.
  return sign("supervisor:authenticated");
}

export function isAuthenticated(): boolean {
  const cookie = cookies().get(COOKIE_NAME)?.value;
  if (!cookie) return false;
  const expected = makeSessionToken();
  if (cookie.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(cookie), Buffer.from(expected));
}

export function setAuthCookie(): void {
  cookies().set({
    name: COOKIE_NAME,
    value: makeSessionToken(),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: COOKIE_MAX_AGE_SEC,
  });
}

export function clearAuthCookie(): void {
  cookies().delete(COOKIE_NAME);
}
