import { createHmac, timingSafeEqual } from "node:crypto";
export function authRequired() {
  return (
    !!process.env.ANALYST_PASSWORD ||
    (!!process.env.VERCEL && !!process.env.DATABASE_URL)
  );
}
export function validateConfiguration() {
  if (
    authRequired() &&
    (!process.env.ANALYST_PASSWORD ||
      !process.env.SESSION_SECRET ||
      process.env.SESSION_SECRET.length < 32)
  )
    throw new Error(
      "Set ANALYST_PASSWORD and SESSION_SECRET (at least 32 characters) before using persistent mode on Vercel",
    );
}
export function equal(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
export function signSession() {
  validateConfiguration();
  const expiry = String(Date.now() + 8 * 3600000);
  return (
    expiry +
    "." +
    createHmac("sha256", process.env.SESSION_SECRET!)
      .update(expiry)
      .digest("hex")
  );
}
export function sessionValid(token: string | undefined) {
  if (!authRequired()) return true;
  validateConfiguration();
  if (!token) return false;
  const [expiry, sig] = token.split(".");
  if (!expiry || !sig || !/^\d+$/.test(expiry) || Number(expiry) < Date.now())
    return false;
  return equal(
    sig,
    createHmac("sha256", process.env.SESSION_SECRET!)
      .update(expiry)
      .digest("hex"),
  );
}
