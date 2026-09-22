"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createSessionCookieValue, requireAdminSession, setupAdmin, verifyLogin, SESSION_COOKIE } from "@/lib/auth";
import { isSetupComplete } from "@/lib/admin-store";
import { getSiteContent, saveSiteContent } from "@/lib/store";
import { saveUploadedImage, deleteUploadedImage } from "@/lib/upload";
import {
  createBackup,
  deleteBackup,
  importBackupFile,
  restoreBackup,
  setBackupProtected,
  setAutoBackupEnabled,
  type BackupMode,
} from "@/lib/backup";

const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60 * 24 * 7,
};

// ---------- Auth ----------

export async function setupAction(formData: FormData) {
  if (await isSetupComplete()) redirect("/admin/login");

  const username = String(formData.get("username") || "").trim();
  const password = String(formData.get("password") || "");
  const confirm = String(formData.get("confirm") || "");

  if (username.length < 3) redirect(`/admin/setup?error=${encodeURIComponent("Username must be at least 3 characters.")}`);
  if (password.length < 8) redirect(`/admin/setup?error=${encodeURIComponent("Password must be at least 8 characters.")}`);
  if (password !== confirm) redirect(`/admin/setup?error=${encodeURIComponent("Passwords do not match.")}`);

  await setupAdmin(username, password);
  (await cookies()).set(SESSION_COOKIE, await createSessionCookieValue(), COOKIE_OPTS);
  redirect("/admin");
}

export async function loginAction(formData: FormData) {
  const username = String(formData.get("username") || "");
  const password = String(formData.get("password") || "");

  const result = await verifyLogin(username, password);
  if (!result.ok) redirect(`/admin/login?error=${encodeURIComponent(result.error || "Login failed.")}`);

  (await cookies()).set(SESSION_COOKIE, await createSessionCookieValue(), COOKIE_OPTS);
  redirect("/admin");
}

export async function logoutAction() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/admin/login");
}

// ---------- Demo content (so there's something meaningful to back up) ----------

export async function saveSettingsAction(formData: FormData) {
  await requireAdminSession();
  const content = await getSiteContent();
  content.siteName = String(formData.get("siteName") || "").trim() || content.siteName;
  content.tagline = String(formData.get("tagline") || "").trim();
  await saveSiteContent(content);
  redirect("/admin/settings?ok=1");
}

export async function uploadImageAction(formData: FormData) {
  await requireAdminSession();
  const file = formData.get("file");
  if (file instanceof File && file.size > 0) {
    try {
      await saveUploadedImage(file);
    } catch (e) {
      redirect(`/admin/media?warn=${encodeURIComponent(e instanceof Error ? e.message : "Upload failed.")}`);
    }
  }
  redirect("/admin/media?ok=1");
}

export async function deleteImageAction(formData: FormData) {
  await requireAdminSession();
  await deleteUploadedImage(String(formData.get("path") || ""));
  redirect("/admin/media");
}

// ---------- Backup Manager ----------

export async function createBackupAction(formData: FormData) {
  await requireAdminSession();
  const modeValue = String(formData.get("mode") || "full");
  const mode: BackupMode = modeValue === "content" || modeValue === "media" ? modeValue : "full";
  await createBackup({ mode, origin: "manual" });
  redirect("/admin/backup?ok=1");
}

export async function deleteBackupAction(formData: FormData) {
  await requireAdminSession();
  await deleteBackup(String(formData.get("id") || ""));
  redirect("/admin/backup");
}

export async function toggleBackupProtectAction(formData: FormData) {
  await requireAdminSession();
  await setBackupProtected(String(formData.get("id") || ""), formData.get("protected") === "on");
  redirect("/admin/backup");
}

export async function setAutoBackupEnabledAction(formData: FormData) {
  await requireAdminSession();
  await setAutoBackupEnabled(formData.get("autoEnabled") === "on");
  redirect("/admin/backup?ok=1");
}

export async function uploadBackupAction(formData: FormData) {
  await requireAdminSession();
  const file = formData.get("file");
  if (file instanceof File && file.size > 0) {
    try {
      await importBackupFile(Buffer.from(await file.arrayBuffer()));
    } catch (e) {
      redirect(`/admin/backup?warn=${encodeURIComponent(e instanceof Error ? e.message : "Could not read the backup file.")}`);
    }
  }
  redirect("/admin/backup?ok=1");
}

export async function restoreBackupAction(formData: FormData) {
  await requireAdminSession();
  const id = String(formData.get("id") || "");
  const result = await restoreBackup(id);
  if (!result.ok) redirect(`/admin/backup?warn=${encodeURIComponent(result.error)}`);
  if (result.restoredAdmin) {
    // The admin account itself may have been restored to a different one — sign out to be safe.
    (await cookies()).delete(SESSION_COOKIE);
    redirect("/admin/login?error=" + encodeURIComponent("Backup restored. Please sign in again."));
  }
  redirect("/admin/backup?ok=1");
}
