import Link from "next/link";
import { listBackups } from "@/lib/backup";

export default async function AdminDashboardPage() {
  const backups = await listBackups();
  return (
    <div>
      <h1 className="text-2xl text-foreground">Dashboard</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        A minimal demo: edit some settings, upload an image, then see the Backup Manager capture
        both.
      </p>
      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Link href="/admin/settings" className="tactile rounded-xl border border-border-soft bg-surface p-6">
          <h2 className="text-lg text-foreground">Settings</h2>
          <p className="mt-1 text-sm text-muted-foreground">Demo site content (data/content.json).</p>
        </Link>
        <Link href="/admin/media" className="tactile rounded-xl border border-border-soft bg-surface p-6">
          <h2 className="text-lg text-foreground">Media</h2>
          <p className="mt-1 text-sm text-muted-foreground">Uploaded images (public/uploads).</p>
        </Link>
        <Link href="/admin/backup" className="tactile rounded-xl border border-border-soft bg-surface p-6">
          <h2 className="text-lg text-foreground">Backup</h2>
          <p className="mt-1 text-sm text-muted-foreground">{backups.length} backup(s) so far.</p>
        </Link>
      </div>
    </div>
  );
}
