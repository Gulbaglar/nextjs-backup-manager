import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";
import { defaultSiteContent, type SiteContent } from "./content-data";

const DATA_DIR = path.join(process.cwd(), "data");
const CONTENT_FILE = path.join(DATA_DIR, "content.json");

async function writeJsonAtomic(file: string, data: unknown) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const tmp = `${file}.${process.pid}.${crypto.randomBytes(4).toString("hex")}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), "utf-8");
  await fs.rename(tmp, file);
}

export async function getSiteContent(): Promise<SiteContent> {
  const defaults = structuredClone(defaultSiteContent);
  try {
    const raw = await fs.readFile(CONTENT_FILE, "utf-8");
    return { ...defaults, ...JSON.parse(raw) };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    return defaults; // first run: don't write, just return defaults
  }
}

export async function saveSiteContent(content: SiteContent): Promise<void> {
  await writeJsonAtomic(CONTENT_FILE, content);
}
