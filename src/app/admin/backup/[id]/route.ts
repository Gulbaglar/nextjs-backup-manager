import { promises as fs, createReadStream } from "fs";
import { Readable } from "stream";
import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth";
import { getBackupZipPath } from "@/lib/backup";

// A (protected) layout does NOT wrap a sibling route.ts, so the session check has to happen here
// explicitly. Range support lets large downloads resume instead of restarting from zero.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireAdminSession();
  const { id } = await params;
  const zip = await getBackupZipPath(id);
  if (!zip) return new NextResponse("Not found", { status: 404 });

  const size = (await fs.stat(zip)).size;
  const baseHeaders: Record<string, string> = {
    "Content-Type": "application/zip",
    "Content-Disposition": `attachment; filename="backup-${id}.zip"`,
    "Cache-Control": "no-store",
    "Accept-Ranges": "bytes",
  };

  const range = req.headers.get("range");
  const match = range?.match(/^bytes=(\d*)-(\d*)$/);
  if (match) {
    const start = match[1] ? parseInt(match[1], 10) : 0;
    const end = match[2] ? parseInt(match[2], 10) : size - 1;
    if (Number.isNaN(start) || Number.isNaN(end) || start > end || end >= size) {
      return new NextResponse("Range Not Satisfiable", { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    }
    const stream = Readable.toWeb(createReadStream(zip, { start, end })) as ReadableStream;
    return new NextResponse(stream, {
      status: 206,
      headers: { ...baseHeaders, "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": String(end - start + 1) },
    });
  }

  const stream = Readable.toWeb(createReadStream(zip)) as ReadableStream;
  return new NextResponse(stream, { headers: { ...baseHeaders, "Content-Length": String(size) } });
}
