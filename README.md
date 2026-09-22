# Next.js Backup Manager

**Full/content/media backups, per-file SHA-256 verification, safe restore with an automatic rollback point, and opportunistic auto-backups — for JSON-file-backed Next.js App Router sites.**

🇹🇷 Türkçe: [README.tr.md](README.tr.md)

> A backup is not successful until it has been **verified** and can be **restored**.

This is a small, self-contained reference implementation — not an npm package. Fork it, or copy `src/lib/backup.ts` and the `src/app/admin` pieces straight into your own Next.js App Router project. It ships as a runnable demo site (a tiny "settings + image upload" app) so there's something real to back up and restore before you wire it into your own site.

## Why this exists

I built the first version of this for my own portfolio site ([gulbaglar.com](https://gulbaglar.com)), which stores its content in a JSON file rather than a database — no automatic backup story comes for free with that setup. Once it worked well there, I pulled it out into its own repository so it's usable on any Next.js site with the same "content in JSON + uploads on disk" shape.

## Features

- **Three backup modes.** `full` (content + admin account + `public/uploads`), `content` (just the JSON/account data — small, fast), `media` (just uploads). Pick per backup.
- **Per-file integrity.** Every backup carries a `checksums.json` (SHA-256 of every file inside) in addition to a whole-archive hash. Restore verifies both — one corrupted file inside an otherwise-valid archive is caught and rejected, not silently applied.
- **Safe restore.** Verify → take an automatic **protected** safety backup of the current state → extract and sanity-check the archive in memory → only then swap the real files in with atomic renames. Any failure before the last step leaves your live files untouched.
- **Mode-aware restore.** Restoring a `content`-only backup never touches `public/uploads`; restoring a `media`-only backup never touches your JSON/account data. (An earlier draft of this got that backwards — see [Lessons](#lessons-from-building-this) below.)
- **Protect + retention.** Mark any backup **Protected** to exempt it from auto-cleanup. Auto backups beyond the newest 10 are pruned automatically; manual and protected backups never are.
- **Opportunistic auto-backup.** No real cron — a check runs on every admin page load, and takes a new backup only if the last automatic one is more than 7 days old (configurable in `src/lib/backup.ts`). Toggle it off entirely from the Backup page.
- **Resumable downloads.** The download endpoint and the demo's own upload-serving route both support HTTP Range (`206 Partial Content`), so a large backup or image download can pause and resume instead of restarting from zero.
- **Disaster-recovery notes bundled in every archive.** `README-RESTORE.txt` inside the `.zip` explains how to restore the content and uploads by hand, without this admin panel, if you ever need to.
- **Single admin, JSON-file storage.** Auth is a bcrypt-hashed password + an HMAC-signed session cookie, no external services.

## Quick start

```bash
git clone https://github.com/Gulbaglar/nextjs-backup-manager.git
cd nextjs-backup-manager
npm install
npm run dev
```

- `http://localhost:3000/admin/setup` — create your admin account (first visit only).
- `http://localhost:3000/admin/settings` — change the demo site's name/tagline.
- `http://localhost:3000/admin/media` — upload an image or two.
- `http://localhost:3000/admin/backup` — **Back up now** (try `full`), then change the settings again, then **Restore** the backup and watch it revert.

## Bringing it into your own site

1. Copy `src/lib/backup.ts`, `src/lib/admin-store.ts`, `src/lib/auth.ts`, `src/app/admin/backup/[id]/route.ts`, and the Backup page/actions under `src/app/admin/` into your project.
2. `src/lib/backup.ts` expects `data/content.json`, `data/admin.json` and `public/uploads/` to exist at those exact paths — either match that layout or adjust the constants at the top of the file.
3. Add `/data/` and `/public/uploads/` to your `.gitignore` — backups (and the content they protect) should never be committed.
4. If your uploads are served through a runtime route handler (see `src/app/uploads/[...path]/route.ts` in this repo — `next start` doesn't serve files added to `public/` after the build finished), make sure it also gets Range support if you serve video or large files.

## Lessons from building this

- **Mode-aware restore is not optional.** The first version of the mode split didn't gate the uploads-sync step on the backup's mode — restoring a `content`-only backup would delete every file in `public/uploads` to match the (empty) upload list inside that archive. Caught before release by actually restoring a `content` backup and diffing `public/uploads` before/after. If you're extending this, any new backup mode needs the same "what does this NOT touch" review, not just "what does it include."
- **Test the restore, not just the backup.** It's easy to verify that `createBackup()` produces a valid-looking zip and stop there. The bug above only showed up when a backup was actually *restored* and the result compared against what should not have changed.

## License

MIT — see [LICENSE](LICENSE).
