import { listUploadedImages } from "@/lib/upload";
import { uploadImageAction, deleteImageAction } from "../../actions";

export default async function AdminMediaPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; warn?: string }>;
}) {
  const images = await listUploadedImages();
  const { ok, warn } = await searchParams;

  return (
    <div>
      <h1 className="text-2xl text-foreground">Media</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Uploaded images live in <code className="rounded bg-surface-2 px-1 py-0.5 text-xs">public/uploads</code> — a
        &quot;media&quot; backup captures exactly this folder.
      </p>

      {ok && <p className="mt-4 rounded-lg border border-accent/40 bg-surface px-4 py-2 text-sm text-accent">Done.</p>}
      {warn && (
        <p className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {warn}
        </p>
      )}

      <form action={uploadImageAction} className="mt-6 flex items-center gap-2">
        <input
          name="file"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          required
          className="rounded-lg border border-border-soft bg-background px-3 py-2 text-sm text-foreground outline-none file:mr-3 file:rounded-md file:border-0 file:bg-surface-2 file:px-3 file:py-1.5 file:text-foreground"
        />
        <button type="submit" className="tactile rounded-lg border border-border-soft bg-surface-2 px-4 py-2 text-sm font-medium text-foreground">
          Upload
        </button>
      </form>

      {images.length === 0 ? (
        <p className="mt-8 text-sm text-muted-foreground">No images yet.</p>
      ) : (
        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {images.map((src) => (
            <div key={src} className="flex flex-col gap-2 rounded-lg border border-border-soft bg-surface p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" className="aspect-square w-full rounded object-cover" />
              <form action={deleteImageAction}>
                <input type="hidden" name="path" value={src} />
                <button type="submit" className="text-xs text-muted-foreground hover:text-destructive">
                  Delete
                </button>
              </form>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
