import { promises as fs } from "fs";
import path from "path";

// `next start` (production) does not serve files added to public/ after the build finished —
// uploads happen at runtime, so they need to be served from disk explicitly. (`next dev` doesn't
// have this problem, which is exactly why it's easy to miss until you deploy.)
const TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

export async function GET(_req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path: segments } = await params;
  const root = path.join(process.cwd(), "public", "uploads");
  const file = path.join(root, ...segments);

  const type = TYPES[path.extname(file).toLowerCase()];
  if (!type || !file.startsWith(root + path.sep)) {
    return new Response("Not found", { status: 404 });
  }

  try {
    const data = await fs.readFile(file);
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": type,
        "Cache-Control": "public, max-age=31536000, immutable", // filenames are unique (timestamp + random)
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
