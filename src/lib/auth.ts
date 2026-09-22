import crypto from "crypto";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getAdminStore, isSetupComplete, saveAdminStore } from "./admin-store";

export const SESSION_COOKIE = "cm_admin_session";
const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes

function sign(secret: string, issuedAt: number): string {
  return crypto.createHmac("sha256", secret).update(`admin:${issuedAt}`).digest("hex");
}

export async function createSessionCookieValue(): Promise<string> {
  const store = await getAdminStore();
  const issuedAt = Date.now();
  return `${issuedAt}.${sign(store.sessionSecret, issuedAt)}`;
}

export async function verifySessionCookieValue(value: string | undefined): Promise<boolean> {
  if (!value) return false;
  const [issuedAtStr, sig] = value.split(".");
  const issuedAt = Number(issuedAtStr);
  if (!issuedAt || !sig) return false;
  if (Date.now() - issuedAt > SESSION_MAX_AGE_MS) return false;

  const store = await getAdminStore();
  const expected = sign(store.sessionSecret, issuedAt);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export async function setupAdmin(username: string, password: string): Promise<void> {
  const store = await getAdminStore();
  store.username = username.trim();
  store.passwordHash = await bcrypt.hash(password, 12);
  store.failedAttempts = 0;
  store.lockUntil = null;
  await saveAdminStore(store);
}

export async function verifyLogin(
  username: string,
  password: string
): Promise<{ ok: boolean; error?: string }> {
  const store = await getAdminStore();

  if (store.lockUntil && Date.now() < store.lockUntil) {
    const minutesLeft = Math.ceil((store.lockUntil - Date.now()) / 60000);
    return { ok: false, error: `Too many failed attempts. Try again in ${minutesLeft} minute(s).` };
  }

  if (!store.username || !store.passwordHash || username.trim() !== store.username) {
    await registerFailedAttempt(store);
    return { ok: false, error: "Incorrect username or password." };
  }

  const valid = await bcrypt.compare(password, store.passwordHash);
  if (!valid) {
    await registerFailedAttempt(store);
    return { ok: false, error: "Incorrect username or password." };
  }

  store.failedAttempts = 0;
  store.lockUntil = null;
  await saveAdminStore(store);
  return { ok: true };
}

// Call at the top of every protected admin page. Redirects to /admin/setup if no account exists
// yet, or to /admin/login if the session cookie is missing/expired/invalid.
export async function requireAdminSession(): Promise<void> {
  if (!(await isSetupComplete())) {
    redirect("/admin/setup");
  }
  const store = await cookies();
  const value = store.get(SESSION_COOKIE)?.value;
  if (!(await verifySessionCookieValue(value))) {
    redirect("/admin/login");
  }
}

async function registerFailedAttempt(store: Awaited<ReturnType<typeof getAdminStore>>): Promise<void> {
  store.failedAttempts += 1;
  if (store.failedAttempts >= MAX_FAILED_ATTEMPTS) {
    store.lockUntil = Date.now() + LOCKOUT_MS;
    store.failedAttempts = 0;
  }
  await saveAdminStore(store);
}
