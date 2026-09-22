import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";

const DATA_DIR = path.join(process.cwd(), "data");
const ADMIN_FILE = path.join(DATA_DIR, "admin.json");

export type AdminStore = {
  username: string | null;
  passwordHash: string | null;
  sessionSecret: string;
  failedAttempts: number;
  lockUntil: number | null;
};

function freshStore(): AdminStore {
  return {
    username: null,
    passwordHash: null,
    sessionSecret: crypto.randomBytes(32).toString("hex"),
    failedAttempts: 0,
    lockUntil: null,
  };
}

export async function getAdminStore(): Promise<AdminStore> {
  try {
    const raw = await fs.readFile(ADMIN_FILE, "utf-8");
    return { ...freshStore(), ...JSON.parse(raw) };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    return freshStore(); // not persisted until the first real save (setup)
  }
}

export async function saveAdminStore(store: AdminStore): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const tmp = `${ADMIN_FILE}.${process.pid}.${crypto.randomBytes(4).toString("hex")}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(store, null, 2), "utf-8");
  await fs.rename(tmp, ADMIN_FILE);
}

export async function isSetupComplete(): Promise<boolean> {
  const store = await getAdminStore();
  return !!(store.username && store.passwordHash);
}
