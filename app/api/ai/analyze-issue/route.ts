import { NextRequest } from "next/server";
import { z } from "zod";
import {
    analyzeIssue,
    healthCheck,
    textSimilarity,
    estimateResolutionDays,
} from "@/lib/ollama";
import type { NearbyIssueContext } from "@/lib/ollama";
import { prisma } from "@/lib/prisma";
import {
    apiError,
    apiSuccess,
    requireAuthUniversal,
    validateBody,
    parseJsonBody,
} from "@/lib/api-helpers";
import { haversineKm } from "@/lib/geo";
import { ModerationSettings } from "@/lib/moderation-settings";

const analyzeSchema = z.object({
    title: z.string().min(1).max(200),
    imageUrls: z.array(z.string().url()).max(5),
    description: z.string().min(10).max(2000),
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
});

export async function POST(req: NextRequest) {
    const { userId, error } = await requireAuthUniversal(req);
    if (error) return error;

    const body = await parseJsonBody(req);
    const { data, error: ve } = validateBody(analyzeSchema, body);
    if (ve) return ve;

    // Fetch nearby issues within 500m for duplicate context (include imageUrls)
    const latDelta = 0.5 / 111;
    const lngDelta = 0.5 / (111 * Math.cos((data.lat * Math.PI) / 180));

    const nearbyRaw = await prisma.issue.findMany({
        where: {
            lat: { gte: data.lat - latDelta, lte: data.lat + latDelta },
            lng: { gte: data.lng - lngDelta, lte: data.lng + lngDelta },
            status: { notIn: ["CLOSED", "RESOLVED"] },
        },
        select: {
            id: true,
            title: true,
            description: true,
            lat: true,
            lng: true,
            imageUrls: true,
        },
        take: 15,
        orderBy: { createdAt: "desc" },
    });

    const nearbyIssues: NearbyIssueContext[] = nearbyRaw
        .map((i) => ({
            id: i.id,
            title: i.title,
            description: i.description,
            distanceM: haversineKm(data.lat, data.lng, i.lat, i.lng) * 1000,
            imageUrls: i.imageUrls,
            titleSimilarity: textSimilarity(data.title, i.title),
            descriptionSimilarity: textSimilarity(
                data.description,
                i.description,
            ),
        }))
        .filter((i) => i.distanceM <= 500)
        .sort((a, b) => a.distanceM - b.distanceM);

    // ─── Deterministic duplicate check (catches obvious duplicates without AI) ──
    const deterministicDuplicate = nearbyIssues.find(
        (i) =>
            (i.titleSimilarity >= 0.6 && i.distanceM <= 200) ||
            (i.titleSimilarity >= 0.5 &&
                i.descriptionSimilarity >= 0.4 &&
                i.distanceM <= 300) ||
            i.titleSimilarity >= 0.7 ||
            (i.descriptionSimilarity >= 0.7 && i.distanceM <= 150),
    );

    // Heuristic estimation (used as fallback or to validate AI output)
    const heuristic = estimateResolutionDays({
        title: data.title,
        description: data.description,
        category: data.title, // will be refined by AI if available
        imageCount: data.imageUrls.length,
    });

    // Check Ollama health
    const health = await healthCheck();
    if (!health.ok) {
        console.warn(
            "Ollama unavailable, using heuristic analysis:",
            health.error,
        );

        // Use deterministic check as fallback when AI is unavailable
        if (deterministicDuplicate) {
            return apiSuccess({
                isDuplicate: true,
                duplicateOfId: deterministicDuplicate.id,
                priorityScore: 5,
                estimatedResolutionDays: heuristic.estimatedDays,
                estimationConfidence: heuristic.confidence,
                estimationReasoning: heuristic.reasoning,
                suggestedCategory: "Other",
                moderationFlags: [],
                aiAvailable: false,
            });
        }

        return apiSuccess({
            isDuplicate: false,
            duplicateOfId: null,
            priorityScore: 5,
            estimatedResolutionDays: heuristic.estimatedDays,
            estimationConfidence: heuristic.confidence,
            estimationReasoning: heuristic.reasoning,
            suggestedCategory: "Other",
            moderationFlags: [],
            aiAvailable: false,
        });
    }

    const checkImageRelevance =
        data.imageUrls.length > 0 &&
        ModerationSettings.isImageModerationEnabled();

    const result = await analyzeIssue({
        title: data.title,
        imageUrls: data.imageUrls,
        description: data.description,
        nearbyIssues,
        checkImageRelevance,
    });

    // If AI didn't catch it but deterministic check found a strong match, override
    if (!result.isDuplicate && deterministicDuplicate) {
        result.isDuplicate = true;
        result.duplicateOfId = deterministicDuplicate.id;
    }

    return apiSuccess({ ...result, aiAvailable: true });
}
