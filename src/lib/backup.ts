import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";
import AdmZip from "adm-zip";

// A single-file backup of your site's content (data/ + public/uploads). This module does not
// back up your code — that already lives in git — only the data/account/media that a rebuild or
// redeploy cannot recreate.
const ROOT = process.cwd();
const BACKUP_DIR = path.join(ROOT, "data", "backups");
const DATA_DIR = path.join(ROOT, "data");
const UPLOADS_DIR = path.join(ROOT, "public", "uploads");

const ID_RE = /^[0-9]{8}-[0-9]{6}-[a-f0-9]{6}$/;
const SETTINGS_FILE = path.join(DATA_DIR, "backup-settings.json");

// full: content + account + uploads · content: just data/ (small, fast) ·
// media: just public/uploads (no content/account).
export type BackupMode = "full" | "content" | "media";
export type BackupOrigin = "manual" | "auto";

export type BackupMeta = {
  id: string;
  createdAt: string;
  mode: BackupMode;
  origin: BackupOrigin;
  sizeBytes: number;
  sha256: string; // whole-zip integrity
  fileCount: number;
  includesAdmin: boolean;
  protected: boolean; // protected backups are exempt from auto-pruning
  note?: string;
};

// How many AUTO backups are kept (protected or manual backups are never counted or auto-deleted).
const AUTO_RETENTION_COUNT = 10;
// If the last auto backup is older than this (days), the next admin page load takes a new one.
const AUTO_INTERVAL_DAYS = 7;

function newId(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  return `${stamp}-${crypto.randomBytes(3).toString("hex")}`;
}

async function ensureDirs() {
  await fs.mkdir(BACKUP_DIR, { recursive: true });
}

function sha256Buf(buf: Buffer): string {
  return crypto.createHash("sha256").update(buf).digest("hex");
}
async function sha256File(file: string): Promise<string> {
  return sha256Buf(await fs.readFile(file));
}

async function listFilesRecursive(dir: string, base = dir): Promise<string[]> {
  let entries: import("fs").Dirent[];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw e;
  }
  const out: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await listFilesRecursive(full, base)));
    else out.push(path.relative(base, full));
  }
  return out;
}

function metaPath(id: string) {
  return path.join(BACKUP_DIR, `${id}.json`);
}
function zipPath(id: string) {
  return path.join(BACKUP_DIR, `${id}.zip`);
}

async function writeMeta(meta: BackupMeta) {
  const tmp = metaPath(meta.id) + `.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(meta, null, 2), "utf-8");
  await fs.rename(tmp, metaPath(meta.id));
}

export type BackupSettings = { autoEnabled: boolean };

export async function getBackupSettings(): Promise<BackupSettings> {
  try {
    const raw = JSON.parse(await fs.readFile(SETTINGS_FILE, "utf-8"));
    return { autoEnabled: raw.autoEnabled !== false };
  } catch {
    return { autoEnabled: true }; // default: on
  }
}

export async function setAutoBackupEnabled(enabled: boolean): Promise<void> {
  await ensureDirs();
  const tmp = SETTINGS_FILE + `.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify({ autoEnabled: enabled }, null, 2), "utf-8");
  await fs.rename(tmp, SETTINGS_FILE);
}

export async function createBackup(
  opts: { mode?: BackupMode; origin?: BackupOrigin; note?: string; protect?: boolean } = {}
): Promise<BackupMeta> {
  await ensureDirs();
  const mode = opts.mode ?? "full";
  const id = newId();
  const zip = new AdmZip();
  const checksums: Record<string, string> = {};
  let fileCount = 0;
  let includesAdmin = false;

  if (mode === "full" || mode === "content") {
    for (const name of ["content.json", "admin.json"]) {
      const full = path.join(DATA_DIR, name);
      try {
        const buf = await fs.readFile(full);
        const entryName = `data/${name}`;
        zip.addFile(entryName, buf);
        checksums[entryName] = sha256Buf(buf);
        fileCount++;
        if (name === "admin.json") includesAdmin = true;
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
      }
    }
  }

  if (mode === "full" || mode === "media") {
    const uploadFiles = await listFilesRecursive(UPLOADS_DIR);
    for (const rel of uploadFiles) {
      const buf = await fs.readFile(path.join(UPLOADS_DIR, rel));
      const entryName = `uploads/${rel.split(path.sep).join("/")}`;
      zip.addFile(entryName, buf);
      checksums[entryName] = sha256Buf(buf);
      fileCount++;
    }
  }

  const manifest = { id, createdAt: new Date().toISOString(), mode, fileCount, note: opts.note ?? null };
  zip.addFile("manifest.json", Buffer.from(JSON.stringify(manifest, null, 2), "utf-8"));
  zip.addFile("checksums.json", Buffer.from(JSON.stringify(checksums, null, 2), "utf-8"));
  zip.addFile("README-RESTORE.txt", Buffer.from(readmeText(mode), "utf-8"));

  const tmpZip = zipPath(id) + `.${process.pid}.tmp`;
  zip.writeZip(tmpZip);
  await fs.rename(tmpZip, zipPath(id));

  const stat = await fs.stat(zipPath(id));
  const meta: BackupMeta = {
    id,
    createdAt: manifest.createdAt,
    mode,
    origin: opts.origin ?? "manual",
    sizeBytes: stat.size,
    sha256: await sha256File(zipPath(id)),
    fileCount,
    includesAdmin,
    protected: opts.protect ?? false,
    note: opts.note,
  };
  await writeMeta(meta);

  if (meta.origin === "auto") await pruneAutoBackups();
  return meta;
}

function readmeText(mode: BackupMode): string {
  return [
    "BACKUP — MANUAL RESTORE NOTES",
    "==============================",
    "",
    "This backup can be restored automatically from the admin Backup page (Restore button).",
    "If you have no access to the admin panel at all (disaster recovery), you can restore it by hand:",
    "",
    mode !== "media" ? "1. Copy data/content.json and data/admin.json from this archive's data/ folder to your" : "",
    mode !== "media" ? "   server's data/ folder (this overwrites the current files)." : "",
    mode !== "content" ? "2. Copy everything under uploads/ into your server's public/uploads/ folder." : "",
    "3. Restart your Node.js app.",
    "",
    "You can also verify integrity by hand: hash every file with SHA-256 (e.g. `sha256sum <file>` or,",
    "on Windows, `Get-FileHash <file> -Algorithm SHA256`) and compare against checksums.json.",
    "",
    `Backup mode: ${mode} — see manifest.json in this archive for the creation timestamp.`,
  ]
    .filter(Boolean)
    .join("\n");
}

export async function listBackups(): Promise<BackupMeta[]> {
  await ensureDirs();
  const entries = await fs.readdir(BACKUP_DIR);
  const metas: BackupMeta[] = [];
  for (const entry of entries) {
    if (!entry.endsWith(".json")) continue;
    try {
      const raw = await fs.readFile(path.join(BACKUP_DIR, entry), "utf-8");
      metas.push(JSON.parse(raw) as BackupMeta);
    } catch {
      // Skip a corrupt/unreadable meta file rather than breaking the whole list.
    }
  }
  return metas.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getBackupZipPath(id: string): Promise<string | null> {
  if (!ID_RE.test(id)) return null;
  const p = zipPath(id);
  try {
    await fs.access(p);
    return p;
  } catch {
    return null;
  }
}

export async function deleteBackup(id: string): Promise<void> {
  if (!ID_RE.test(id)) return;
  await fs.unlink(zipPath(id)).catch(() => {});
  await fs.unlink(metaPath(id)).catch(() => {});
}

export async function setBackupProtected(id: string, value: boolean): Promise<void> {
  if (!ID_RE.test(id)) return;
  const backups = await listBackups();
  const meta = backups.find((b) => b.id === id);
  if (!meta) return;
  meta.protected = value;
  await writeMeta(meta);
}

// Keeps the newest AUTO_RETENTION_COUNT non-protected auto backups, deletes the rest. Never
// touches manual or protected backups.
async function pruneAutoBackups(): Promise<void> {
  const autos = (await listBackups()).filter((b) => b.origin === "auto" && !b.protected);
  for (const stale of autos.slice(AUTO_RETENTION_COUNT)) {
    await deleteBackup(stale.id);
  }
}

// Call this once per admin request (e.g. from a protected layout). There is no real cron here —
// this is "opportunistic" scheduling: if the last auto backup is stale (or none exists), it
// silently takes one. Cheap when nothing needs to happen, since listBackups() just reads sidecar
// JSON files.
export async function maybeAutoBackup(): Promise<void> {
  try {
    const settings = await getBackupSettings();
    if (!settings.autoEnabled) return;
    const backups = await listBackups();
    const lastAuto = backups.find((b) => b.origin === "auto");
    const staleMs = AUTO_INTERVAL_DAYS * 24 * 60 * 60 * 1000;
    if (lastAuto && Date.now() - new Date(lastAuto.createdAt).getTime() < staleMs) return;
    await createBackup({ mode: "full", origin: "auto", note: `Automatic (every ${AUTO_INTERVAL_DAYS} days)` });
  } catch {
    // Auto-backup must never break the admin panel — fail silently, manual backup is always there.
  }
}

export async function verifyBackup(id: string): Promise<{ ok: boolean; expected?: string; actual?: string }> {
  if (!ID_RE.test(id)) return { ok: false };
  try {
    const raw = await fs.readFile(metaPath(id), "utf-8");
    const meta = JSON.parse(raw) as BackupMeta;
    const actual = await sha256File(zipPath(id));
    return { ok: actual === meta.sha256, expected: meta.sha256, actual };
  } catch {
    return { ok: false };
  }
}

// Registers a .zip you already have (e.g. downloaded from another environment) as a backup.
export async function importBackupFile(buffer: Buffer): Promise<BackupMeta> {
  await ensureDirs();
  const id = newId();
  const zip = new AdmZip(buffer);
  const entries = zip.getEntries();
  if (!entries.some((e) => e.entryName === "manifest.json")) {
    throw new Error("This does not look like a valid backup file (no manifest.json).");
  }
  let mode: BackupMode = "full";
  try {
    const manifest = JSON.parse(entries.find((e) => e.entryName === "manifest.json")!.getData().toString("utf-8"));
    if (manifest.mode === "content" || manifest.mode === "media" || manifest.mode === "full") mode = manifest.mode;
  } catch {
    // Unreadable manifest -> assume "full"; restore behaves correctly either way based on actual entries.
  }

  const tmpZip = zipPath(id) + `.${process.pid}.tmp`;
  await fs.writeFile(tmpZip, buffer);
  await fs.rename(tmpZip, zipPath(id));

  const meta: BackupMeta = {
    id,
    createdAt: new Date().toISOString(),
    mode,
    origin: "manual",
    sizeBytes: buffer.length,
    sha256: sha256Buf(buffer),
    fileCount: entries.length - 1,
    includesAdmin: entries.some((e) => e.entryName === "data/admin.json"),
    protected: false,
    note: "Imported from a file",
  };
  await writeMeta(meta);
  return meta;
}

export type RestoreResult = { ok: true; restoredAdmin: boolean; safetyBackupId: string } | { ok: false; error: string };

// Restore: verify integrity first, then take a PROTECTED safety backup of the current state (so a
// bad or unwanted restore can always be undone), then read the archive into memory, validate it,
// and only then swap the real files in with atomic renames. Any failure before the final writes
// leaves the live files completely untouched. A "content"-mode backup never touches uploads; a
// "media"-mode backup never touches data/ — get this wrong and a "content" backup restore would
// silently wipe every uploaded file.
export async function restoreBackup(id: string): Promise<RestoreResult> {
  const verified = await verifyBackup(id);
  if (!verified.ok) {
    return { ok: false, error: "This backup failed its integrity check (corrupt or modified). Restore cancelled." };
  }

  const safety = await createBackup({ mode: "full", origin: "auto", note: "Automatic safety backup taken before a restore", protect: true });

  try {
    const buf = await fs.readFile(zipPath(id));
    const zip = new AdmZip(buf);
    const entries = zip.getEntries();

    const checksumsEntry = entries.find((e) => e.entryName === "checksums.json");
    if (checksumsEntry) {
      const checksums = JSON.parse(checksumsEntry.getData().toString("utf-8")) as Record<string, string>;
      for (const [entryName, expected] of Object.entries(checksums)) {
        const entry = entries.find((e) => e.entryName === entryName);
        if (!entry || sha256Buf(entry.getData()) !== expected) {
          throw new Error(`Corrupt file inside the backup: ${entryName}`);
        }
      }
    }

    let backupMode: BackupMode = "full";
    const manifestEntry = entries.find((e) => e.entryName === "manifest.json");
    if (manifestEntry) {
      try {
        const m = JSON.parse(manifestEntry.getData().toString("utf-8"));
        if (m.mode === "content" || m.mode === "media" || m.mode === "full") backupMode = m.mode;
      } catch {
        // Corrupt manifest -> default to "full"; the steps below still follow the archive's actual contents.
      }
    }

    const contentEntry = entries.find((e) => e.entryName === "data/content.json");
    const adminEntry = entries.find((e) => e.entryName === "data/admin.json");
    let restoredAdmin = false;

    if (contentEntry) {
      const contentJson = contentEntry.getData().toString("utf-8");
      JSON.parse(contentJson); // must at least be valid JSON
      const tmpContent = path.join(DATA_DIR, `content.json.${process.pid}.restore.tmp`);
      await fs.writeFile(tmpContent, contentJson, "utf-8");
      await fs.rename(tmpContent, path.join(DATA_DIR, "content.json"));
    }

    if (adminEntry) {
      const tmpAdmin = path.join(DATA_DIR, `admin.json.${process.pid}.restore.tmp`);
      await fs.writeFile(tmpAdmin, adminEntry.getData());
      await fs.rename(tmpAdmin, path.join(DATA_DIR, "admin.json"));
      restoredAdmin = true;
    }

    // uploads: only touched when the backup is NOT "content" mode (a content-only backup has no
    // uploads/ entries at all — touching this would wipe every current upload).
    if (backupMode !== "content") {
      const uploadEntries = entries.filter((e) => e.entryName.startsWith("uploads/") && !e.isDirectory);
      const keep = new Set(uploadEntries.map((e) => e.entryName.slice("uploads/".length)));
      const existing = await listFilesRecursive(UPLOADS_DIR);
      for (const rel of existing) {
        if (!keep.has(rel.split(path.sep).join("/"))) {
          await fs.unlink(path.join(UPLOADS_DIR, rel)).catch(() => {});
        }
      }
      for (const entry of uploadEntries) {
        const rel = entry.entryName.slice("uploads/".length);
        const dest = path.join(UPLOADS_DIR, rel);
        await fs.mkdir(path.dirname(dest), { recursive: true });
        await fs.writeFile(dest, entry.getData());
      }
    }

    return { ok: true, restoredAdmin, safetyBackupId: safety.id };
  } catch (e) {
    return {
      ok: false,
      error: `Restore failed partway through, some files may have changed: ${e instanceof Error ? e.message : "unknown error"}. You can restore from the safety backup taken just before this attempt (${safety.id}).`,
    };
  }
}
