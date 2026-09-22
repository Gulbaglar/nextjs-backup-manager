import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";

// Deliberately minimal for the demo — no image processing dependency (no sharp). A real site
// would typically re-encode/resize uploads; that's orthogonal to what this module demonstrates
// (backing up whatever ends up in public/uploads), so it's left out to keep the example small.
export const MAX_UPLOAD_MB = 10;
const MAX_BYTES = MAX_UPLOAD_MB * 1024 * 1024;
const ALLOWED: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

export async function saveUploadedImage(file: File): Promise<string> {
  if (file.size > MAX_BYTES) throw new Error(`File must be smaller than ${MAX_UPLOAD_MB} MB.`);
  const ext = ALLOWED[file.type];
  if (!ext) throw new Error("Only JPG, PNG or WebP images are accepted.");

  const dir = path.join(process.cwd(), "public", "uploads");
  await fs.mkdir(dir, { recursive: true });
  const name = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}.${ext}`;
  await fs.writeFile(path.join(dir, name), Buffer.from(await file.arrayBuffer()));
  return `/uploads/${name}`;
}

export async function listUploadedImages(): Promise<string[]> {
  const dir = path.join(process.cwd(), "public", "uploads");
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    return entries
      .filter((e) => e.isFile())
      .map((e) => `/uploads/${e.name}`)
      .sort()
      .reverse();
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw e;
  }
}

export async function deleteUploadedImage(publicPath: string): Promise<void> {
  if (!publicPath.startsWith("/uploads/") || publicPath.includes("..")) return;
  await fs.unlink(path.join(process.cwd(), "public", publicPath)).catch(() => {});
}
