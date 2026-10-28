import test from "node:test";
import assert from "node:assert/strict";
import { sessionValid, signSession } from "../src/lib/auth";
import { NextRequest } from "next/server";
import { POST, DELETE } from "../src/app/api/auth/route";
import { GET } from "../src/app/api/v1/[...path]/route";
test("signed sessions reject tampering and expired tokens", () => {
  const oldPassword = process.env.ANALYST_PASSWORD;
  const oldSecret = process.env.SESSION_SECRET;
  process.env.ANALYST_PASSWORD = "test-only-password";
  process.env.SESSION_SECRET = "test-only-secret-at-least-32-characters";
  try {
    const token = signSession();
    assert.equal(sessionValid(token), true);
    assert.equal(sessionValid(token + "x"), false);
    assert.equal(sessionValid("0." + token.split(".")[1]), false);
    assert.equal(sessionValid(undefined), false);
  } finally {
    if (oldPassword === undefined) delete process.env.ANALYST_PASSWORD;
    else process.env.ANALYST_PASSWORD = oldPassword;
    if (oldSecret === undefined) delete process.env.SESSION_SECRET;
    else process.env.SESSION_SECRET = oldSecret;
  }
});
test("API rejects unauthenticated access and login sets an HttpOnly signed session", async () => {
  const oldPassword = process.env.ANALYST_PASSWORD;
  const oldSecret = process.env.SESSION_SECRET;
  process.env.ANALYST_PASSWORD = "test-only-password";
  process.env.SESSION_SECRET = "test-only-secret-at-least-32-characters";
  try {
    const denied = await GET(
      new NextRequest("http://localhost:3000/api/v1/rules"),
      { params: Promise.resolve({ path: ["rules"] }) },
    );
    assert.equal(denied.status, 401);
    const wrong = await POST(
      new NextRequest("http://localhost:3000/api/auth", {
        method: "POST",
        body: JSON.stringify({ password: "wrong" }),
      }),
    );
    assert.equal(wrong.status, 401);
    const login = await POST(
      new NextRequest("http://localhost:3000/api/auth", {
        method: "POST",
        body: JSON.stringify({ password: "test-only-password" }),
      }),
    );
    assert.equal(login.status, 200);
    assert.ok(login.headers.get("set-cookie")?.includes("HttpOnly"));
    assert.ok(sessionValid(login.cookies.get("mfs_session")?.value));
    const foreign = await POST(
      new NextRequest("http://localhost:3000/api/auth", {
        method: "POST",
        headers: { origin: "https://foreign.example" },
        body: JSON.stringify({ password: "test-only-password" }),
      }),
    );
    assert.equal(foreign.status, 403);
    const logout = await DELETE();
    assert.ok(logout.headers.get("set-cookie")?.includes("Max-Age=0"));
  } finally {
    if (oldPassword === undefined) delete process.env.ANALYST_PASSWORD;
    else process.env.ANALYST_PASSWORD = oldPassword;
    if (oldSecret === undefined) delete process.env.SESSION_SECRET;
    else process.env.SESSION_SECRET = oldSecret;
  }
});
