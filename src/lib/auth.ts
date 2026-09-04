import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "crypto";

const COOKIE_NAME = "bierapp_admin";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 Tage

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET ist nicht gesetzt");
  }
  return secret;
}

function sign(value: string): string {
  return createHmac("sha256", getSecret()).update(value).digest("hex");
}

function buildToken(): string {
  const payload = "admin";
  const signature = sign(payload);
  return `${payload}.${signature}`;
}

function verifyToken(token: string | undefined): boolean {
  if (!token) return false;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return false;
  const expected = sign(payload);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b) && payload === "admin";
}

export async function isAdmin(): Promise<boolean> {
  const store = await cookies();
  return verifyToken(store.get(COOKIE_NAME)?.value);
}

export async function createAdminSession() {
  const store = await cookies();
  store.set(COOKIE_NAME, buildToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function destroyAdminSession() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

// ---------- Design-Vorschau ("Kabine") ----------
// Rein optionales, unsigniertes Cookie fuer eine neue Optik in Erprobung -
// im Gegensatz zum Admin-Cookie oben keine sicherheitsrelevante Session,
// deshalb ohne HMAC. Wird an jeder Stelle, an der das Theme tatsaechlich
// angewendet wird, zusaetzlich mit isAdmin() kombiniert - selbst wenn
// dieses Cookie irgendwie ohne gueltige Admin-Session vorhanden waere,
// greift die neue Optik dann trotzdem nicht.
const DESIGN_PREVIEW_COOKIE = "bierapp_design_preview";
const DESIGN_PREVIEW_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export async function isDesignPreviewEnabled(): Promise<boolean> {
  const store = await cookies();
  return store.get(DESIGN_PREVIEW_COOKIE)?.value === "kabine";
}

export async function setDesignPreview(enabled: boolean) {
  const store = await cookies();
  if (enabled) {
    store.set(DESIGN_PREVIEW_COOKIE, "kabine", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: DESIGN_PREVIEW_MAX_AGE_SECONDS,
    });
  } else {
    store.delete(DESIGN_PREVIEW_COOKIE);
  }
}

export function checkPassword(input: string): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;
  const a = Buffer.from(input);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
