import { NextRequest, NextResponse } from "next/server";
import {
  authRequired,
  equal,
  signSession,
  validateConfiguration,
} from "@/lib/auth";
const attempts = new Map<string, { count: number; until: number }>();
export async function POST(req: NextRequest) {
  try {
    validateConfiguration();
    if (
      req.headers.get("origin") &&
      req.headers.get("origin") !== new URL(req.url).origin
    )
      return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
    const ip = req.headers.get("x-forwarded-for") ?? "local";
    const old = attempts.get(ip);
    if (old && old.until > Date.now() && old.count >= 10)
      return NextResponse.json(
        { error: "Too many attempts. Try again in 15 minutes." },
        { status: 429 },
      );
    const body = await req.json();
    if (
      !authRequired() ||
      (typeof body.password === "string" &&
        equal(body.password, process.env.ANALYST_PASSWORD!))
    ) {
      attempts.delete(ip);
      const response = NextResponse.json({ ok: true });
      if (authRequired())
        response.cookies.set("mfs_session", signSession(), {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "strict",
          path: "/",
          maxAge: 28800,
        });
      return response;
    }
    attempts.set(ip, {
      count: old && old.until > Date.now() ? old.count + 1 : 1,
      until: Date.now() + 900000,
    });
    return NextResponse.json(
      { error: "Incorrect analyst password" },
      { status: 401 },
    );
  } catch {
    return NextResponse.json(
      { error: "Authentication is not configured correctly" },
      { status: 503 },
    );
  }
}
export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set("mfs_session", "", {
    httpOnly: true,
    path: "/",
    maxAge: 0,
  });
  return response;
}
