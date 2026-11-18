import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";

const UPLOAD_DIR = join(process.cwd(), "public", "uploads");
const MAX_SIZE = 8 * 1024 * 1024; // 8 MB
const MAX_FILES = 5;
const ALLOWED = new Set([
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "image/gif",
    "application/pdf",
]);

export async function POST(req: NextRequest) {
    try {
        await mkdir(UPLOAD_DIR, { recursive: true });

        const origin = req.nextUrl.origin;
        const form = await req.formData();
        const files = form.getAll("files") as File[];

        if (files.length === 0) return NextResponse.json({ urls: [] });
        if (files.length > MAX_FILES)
            return NextResponse.json(
                { error: `Max ${MAX_FILES} files` },
                { status: 400 },
            );

        const urls: string[] = [];

        for (const file of files) {
            if (!(file instanceof File)) continue;
            if (!ALLOWED.has(file.type))
                return NextResponse.json(
                    { error: `${file.name}: unsupported type` },
                    { status: 400 },
                );
            if (file.size > MAX_SIZE)
                return NextResponse.json(
                    { error: `${file.name} exceeds 8 MB` },
                    { status: 400 },
                );

            const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
            const filename = `${randomUUID()}.${ext}`;
            const buffer = Buffer.from(await file.arrayBuffer());

            await writeFile(join(UPLOAD_DIR, filename), buffer);
            urls.push(`${origin}/uploads/${filename}`);
        }

        return NextResponse.json({ urls });
    } catch {
        return NextResponse.json({ error: "Upload failed" }, { status: 500 });
    }
}
