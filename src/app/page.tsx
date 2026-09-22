import Link from "next/link";
import { getSiteContent } from "@/lib/store";
import { listUploadedImages } from "@/lib/upload";

// Reads from disk on every request — must stay dynamic, or edits made in /admin won't show up
// here until the next build. See README's "Bringing it into your own site" section.
export const dynamic = "force-dynamic";

export default async function Home() {
  const content = await getSiteContent();
  const images = await listUploadedImages();

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-24 text-center">
      <p className="font-mono text-xs uppercase tracking-[0.3em] text-accent">Demo site</p>
      <h1 className="mt-4 text-4xl text-foreground">{content.siteName}</h1>
      <p className="mt-4 max-w-md text-muted-foreground">{content.tagline}</p>
      <Link href="/admin/backup" className="mt-8 text-sm text-accent underline">
        Go to /admin/backup
      </Link>

      {images.length > 0 && (
        <div className="mt-12 grid grid-cols-3 gap-4">
          {images.slice(0, 6).map((src) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={src} src={src} alt="" className="size-24 rounded-lg border border-border-soft object-cover" />
          ))}
        </div>
      )}
    </div>
  );
}
