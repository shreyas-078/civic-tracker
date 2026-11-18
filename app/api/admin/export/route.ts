import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { searchParams } = req.nextUrl;
  const format = searchParams.get("format") ?? "csv";

  const issues = await prisma.issue.findMany({
    where: { status: { not: "CLOSED" } },
    select: {
      id: true,
      title: true,
      description: true,
      category: true,
      status: true,
      lat: true,
      lng: true,
      address: true,
      upvotes: true,
      priority: true,
      createdAt: true,
      resolvedAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  if (format === "geojson") {
    const geojson = {
      type: "FeatureCollection",
      features: issues.map((i) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [i.lng, i.lat] },
        properties: {
          id: i.id,
          title: i.title,
          category: i.category,
          status: i.status,
          upvotes: i.upvotes,
          priority: i.priority,
          address: i.address,
          createdAt: i.createdAt.toISOString(),
          resolvedAt: i.resolvedAt?.toISOString() ?? null,
        },
      })),
    };

    return new NextResponse(JSON.stringify(geojson, null, 2), {
      headers: {
        "Content-Type": "application/geo+json",
        "Content-Disposition": `attachment; filename="civic-issues-${Date.now()}.geojson"`,
      },
    });
  }

  // CSV
  const header = "id,title,category,status,lat,lng,address,upvotes,priority,createdAt,resolvedAt\n";
  const rows = issues.map((i) =>
    [
      i.id,
      `"${i.title.replace(/"/g, '""')}"`,
      i.category,
      i.status,
      i.lat,
      i.lng,
      `"${(i.address ?? "").replace(/"/g, '""')}"`,
      i.upvotes,
      i.priority,
      i.createdAt.toISOString(),
      i.resolvedAt?.toISOString() ?? "",
    ].join(",")
  );
  const csv = header + rows.join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="civic-issues-${Date.now()}.csv"`,
    },
  });
}
