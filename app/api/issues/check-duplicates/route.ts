import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
    apiError,
    apiSuccess,
    requireAuth,
    validateBody,
    parseJsonBody,
} from "@/lib/api-helpers";
import { haversineKm } from "@/lib/geo";
import { textSimilarity } from "@/lib/ollama";

const checkSchema = z.object({
    title: z.string().min(1).max(200),
    description: z.string().min(1).max(2000),
    category: z.string(),
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
});

export async function POST(req: NextRequest) {
    const { session, error } = await requireAuth();
    if (error) return error;

    const userId = session!.user.id;

    const body = await parseJsonBody(req);
    const { data, error: ve } = validateBody(checkSchema, body);
    if (ve) return ve;

    // Search within 1km radius for potential duplicates
    const radiusKm = 1;
    const latDelta = radiusKm / 111;
    const lngDelta = radiusKm / (111 * Math.cos((data.lat * Math.PI) / 180));

    const nearbyIssues = await prisma.issue.findMany({
        where: {
            lat: { gte: data.lat - latDelta, lte: data.lat + latDelta },
            lng: { gte: data.lng - lngDelta, lte: data.lng + lngDelta },
            status: { notIn: ["CLOSED", "RESOLVED"] },
            isFlagged: false,
        },
        select: {
            id: true,
            title: true,
            description: true,
            category: true,
            lat: true,
            lng: true,
            imageUrls: true,
            upvotes: true,
            status: true,
            createdAt: true,
            reporterId: true,
            reporter: {
                select: {
                    name: true,
                    image: true,
                },
            },
        },
        take: 20,
        orderBy: { createdAt: "desc" },
    });

    // Score each nearby issue
    const scored = nearbyIssues
        .map((issue) => {
            const distanceM =
                haversineKm(data.lat, data.lng, issue.lat, issue.lng) * 1000;
            const titleSim = textSimilarity(data.title, issue.title);
            const descSim = textSimilarity(data.description, issue.description);
            const categoryMatch = data.category === issue.category;
            const isOwnReport = issue.reporterId === userId;

            // Weighted composite score:
            // - Title similarity is most important (same problem = similar title)
            // - Category match is a strong signal
            // - Description helps but is often worded differently
            // - Closer distance → more likely duplicate
            const distanceFactor = Math.max(0, 1 - distanceM / 1000); // 1 at 0m, 0 at 1km
            const score =
                titleSim * 0.45 +
                descSim * 0.2 +
                (categoryMatch ? 0.15 : 0) +
                distanceFactor * 0.2;

            return {
                id: issue.id,
                title: issue.title,
                description: issue.description,
                category: issue.category,
                imageUrl: issue.imageUrls[0] ?? null,
                upvotes: issue.upvotes,
                status: issue.status,
                distanceM: Math.round(distanceM),
                createdAt: issue.createdAt.toISOString(),
                reporterName: issue.reporter.name,
                reporterImage: issue.reporter.image,
                isOwnReport,
                score,
                titleSimilarity: titleSim,
                descriptionSimilarity: descSim,
                categoryMatch,
            };
        })
        .filter((i) => i.distanceM <= 1000) // strictly within 1km
        .filter((i) => i.score >= 0.35) // minimum relevance threshold
        // Sort: own reports first (at same score tier), then by score
        .sort((a, b) => {
            if (a.isOwnReport !== b.isOwnReport) return a.isOwnReport ? -1 : 1;
            return b.score - a.score;
        })
        .slice(0, 3); // top 3 matches

    return apiSuccess({
        duplicates: scored,
        hasDuplicates: scored.length > 0 && scored[0].score >= 0.45,
        bestMatch: scored.length > 0 ? scored[0] : null,
    });
}
