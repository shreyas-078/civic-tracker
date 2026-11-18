import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess } from "@/lib/api-helpers";
import { haversineKm } from "@/lib/geo";

export async function GET(req: NextRequest) {
    const { searchParams } = req.nextUrl;
    const lat = parseFloat(searchParams.get("lat") ?? "28.6139");
    const lng = parseFloat(searchParams.get("lng") ?? "77.2090");
    const radiusKm = Math.min(
        parseFloat(searchParams.get("radius") ?? "500"),
        500,
    );
    const type = searchParams.get("type") ?? "reporters"; // "reporters" | "ngos"

    if (type === "ngos") {
        const ngos = await prisma.nGO.findMany({
            where: { status: "APPROVED" },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        image: true,
                        trustScore: true,
                        badges: true,
                    },
                },
            },
            orderBy: [{ resolvedCount: "desc" }],
            take: 10,
        });

        const entries = ngos.map((ngo, i) => ({
            rank: i + 1,
            id: ngo.id,
            name: ngo.name,
            resolvedCount: ngo.resolvedCount,
            categories: ngo.categories,
            badges: ngo.user.badges.map((b) => b.type),
        }));

        return apiSuccess({ entries, type: "ngos" });
    }

    // Reporter leaderboard — all citizen/admin users, even those with no reports yet
    const [users, issuesByUser] = await Promise.all([
        prisma.user.findMany({
            where: { role: { in: ["CITIZEN", "ADMIN"] } },
            select: {
                id: true,
                name: true,
                image: true,
                trustScore: true,
                totalReports: true,
                resolvedCount: true,
                badges: { select: { type: true } },
            },
        }),
        prisma.issue.groupBy({
            by: ["reporterId"],
            where: { status: { not: "CLOSED" } },
            _count: { id: true },
        }),
    ]);

    // Combine and rank
    const entries = users
        .map((u) => {
            const issueCount =
                issuesByUser.find((i) => i.reporterId === u.id)?._count.id ?? 0;
            const score = issueCount * 3 + u.trustScore + u.resolvedCount * 5;
            return {
                userId: u.id,
                name: u.name,
                image: u.image,
                score,
                totalReports: u.totalReports,
                resolvedCount: u.resolvedCount,
                trustScore: u.trustScore,
                areaReports: issueCount,
                badges: u.badges.map((b) => b.type),
            };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, 50)
        .map((e, i) => ({ ...e, rank: i + 1 }));

    return apiSuccess({ entries, type: "reporters" });
}
