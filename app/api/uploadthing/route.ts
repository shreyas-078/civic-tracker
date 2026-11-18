import { NextResponse } from "next/server";

// UploadThing replaced with local uploads — see /api/upload
export function GET()  { return NextResponse.json({ error: "Not used" }, { status: 404 }); }
export function POST() { return NextResponse.json({ error: "Not used" }, { status: 404 }); }
