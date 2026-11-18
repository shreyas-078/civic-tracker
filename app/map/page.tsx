import { prisma } from "@/lib/prisma";
import { MapClient } from "@/components/Map/MapClient";
import type { IssuePinData } from "@/types";

export const revalidate = 30;

export default async function MapPage() {
  const rawIssues = await prisma.issue.findMany({
    where: {
      status: { not: "CLOSED" },
      isFlagged: false,
    },
    select: {
      id: true,
      lat: true,
      lng: true,
      status: true,
      category: true,
      title: true,
      upvotes: true,
      isPersonal: true,
    },
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  const issues: IssuePinData[] = rawIssues.map((i) => ({
    id: i.id,
    lat: i.lat,
    lng: i.lng,
    status: i.status as IssuePinData["status"],
    category: i.category as IssuePinData["category"],
    title: i.title,
    upvotes: i.upvotes,
    isPersonal: i.isPersonal,
  }));

  return <MapClient initialIssues={issues} />;
}
