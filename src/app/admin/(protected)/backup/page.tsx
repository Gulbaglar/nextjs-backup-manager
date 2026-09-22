import { listBackups, getBackupSettings } from "@/lib/backup";
import {
  createBackupAction,
  deleteBackupAction,
  restoreBackupAction,
  uploadBackupAction,
  toggleBackupProtectAction,
  setAutoBackupEnabledAction,
} from "../../actions";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const MODE_LABEL: Record<string, string> = {
  full: "Full (content + account + uploads)",
  content: "Content + account only",
  media: "Uploads only",
};

export default async function AdminBackupPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; warn?: string }>;
}) {
  const backups = await listBackups();
  const settings = await getBackupSettings();
  const { ok, warn } = await searchParams;

  return (
    <div>
      <h1 className="text-2xl text-foreground">Backup</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Bundles the demo&apos;s content, admin account and uploaded images into a single file.{" "}
        <strong className="text-foreground">Your code is not in here</strong> — that&apos;s safe in
        git already, this only protects what a redeploy can&apos;t recreate. Every backup carries a
        per-file SHA-256 checksum list and a plain-text manual-restore guide.
      </p>

      <form
        action={setAutoBackupEnabledAction}
        className="mt-6 flex items-center justify-between gap-4 rounded-xl border border-border-soft bg-surface p-5"
      >
        <div>
          <h2 className="text-lg text-foreground">Automatic backups</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            When on, a full backup is taken silently whenever the last auto backup is more than 7
            days old (or none exists) and you open an admin page. The newest 10 auto backups are
            kept; protected ones don&apos;t count toward that and are never auto-deleted.
          </p>
        </div>
        <label className="flex shrink-0 items-center gap-2 text-sm text-foreground">
          <input type="checkbox" name="autoEnabled" defaultChecked={settings.autoEnabled} className="size-4" />
          On
        </label>
        <button type="submit" className="tactile shrink-0 rounded-lg border border-border-soft bg-surface-2 px-4 py-2 text-sm font-medium text-foreground">
          Save
        </button>
      </form>

      {ok && <p className="mt-4 rounded-lg border border-accent/40 bg-surface px-4 py-2 text-sm text-accent">Done.</p>}
      {warn && (
        <p className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {warn}
        </p>
      )}

      <div className="mt-6 flex flex-wrap items-end gap-3">
        <form action={createBackupAction} className="flex items-end gap-2">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-muted-foreground">Backup type</span>
            <select
              name="mode"
              defaultValue="full"
              className="rounded-lg border border-border-soft bg-background px-3 py-2 text-foreground outline-none focus:border-accent"
            >
              <option value="full">Full backup</option>
              <option value="content">Content + account only (small, fast)</option>
              <option value="media">Uploads only</option>
            </select>
          </label>
          <button type="submit" className="tactile rounded-lg border border-border-soft bg-surface-2 px-5 py-2.5 text-sm font-medium text-foreground">
            Back up now
          </button>
        </form>

        <form action={uploadBackupAction} className="flex items-end gap-2">
          <input
            name="file"
            type="file"
            accept=".zip,application/zip"
            required
            className="rounded-lg border border-border-soft bg-background px-3 py-2 text-sm text-foreground outline-none file:mr-3 file:rounded-md file:border-0 file:bg-surface-2 file:px-3 file:py-1.5 file:text-foreground"
          />
          <button type="submit" className="tactile rounded-lg border border-border-soft bg-surface px-4 py-2 text-sm text-foreground">
            Import a backup file
          </button>
        </form>
      </div>

      <h2 className="mt-10 text-lg text-foreground">Backups ({backups.length})</h2>

      {backups.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">No backups yet.</p>
      ) : (
        <div className="mt-4 flex flex-col gap-3">
          {backups.map((b) => (
            <div key={b.id} className="flex flex-col gap-3 rounded-xl border border-border-soft bg-surface p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="flex flex-wrap items-center gap-2 text-sm text-foreground">
                    {new Date(b.createdAt).toLocaleString()}
                    <span className="rounded-full border border-border-soft px-2 py-0.5 text-[0.65rem] uppercase text-muted-foreground">
                      {b.origin}
                    </span>
                    {b.protected && (
                      <span className="rounded-full border border-accent/40 px-2 py-0.5 text-[0.65rem] uppercase text-accent">
                        protected
                      </span>
                    )}
                  </p>
                  <p className="mt-1 font-mono text-xs text-muted-foreground">
                    {MODE_LABEL[b.mode] ?? b.mode} · {formatSize(b.sizeBytes)} · {b.fileCount} file(s) ·
                    sha256:{b.sha256.slice(0, 12)}…
                  </p>
                  {b.note && <p className="mt-1 text-xs text-accent">{b.note}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-4">
                  <a href={`/admin/backup/${b.id}`} className="text-sm text-accent hover:underline">
                    Download
                  </a>
                  <ProtectForm id={b.id} isProtected={b.protected} />
                  <RestoreForm id={b.id} />
                  <DeleteForm id={b.id} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ProtectForm({ id, isProtected }: { id: string; isProtected: boolean }) {
  return (
    <form action={toggleBackupProtectAction}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="protected" value={isProtected ? "" : "on"} />
      <button type="submit" className="text-xs text-muted-foreground hover:text-accent">
        {isProtected ? "Unprotect" : "Protect"}
      </button>
    </form>
  );
}

function RestoreForm({ id }: { id: string }) {
  const formId = `restore-${id}`;
  return (
    <details className="text-sm">
      <summary className="cursor-pointer text-muted-foreground hover:text-accent">Restore</summary>
      <form id={formId} action={restoreBackupAction} className="mt-2 flex flex-col gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3">
        <input type="hidden" name="id" value={id} />
        <p className="text-xs text-destructive">
          This overwrites the current content and (if this backup has one) admin account. A
          protected safety backup of the current state is taken automatically first.
        </p>
        <label className="flex items-center gap-2 text-xs text-foreground">
          <input type="checkbox" required className="size-3.5" />I understand, overwrite it.
        </label>
        <button type="submit" className="tactile w-fit rounded-lg border border-destructive/40 bg-destructive/20 px-3 py-1.5 text-xs font-medium text-destructive">
          Restore this backup
        </button>
      </form>
    </details>
  );
}

function DeleteForm({ id }: { id: string }) {
  return (
    <form action={deleteBackupAction}>
      <input type="hidden" name="id" value={id} />
      <button type="submit" className="text-xs text-muted-foreground hover:text-destructive">
        Delete
      </button>
    </form>
  );
}
