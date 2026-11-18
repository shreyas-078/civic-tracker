import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
    apiError,
    apiSuccess,
    requireAuth,
    requireAuthUniversal,
    parseJsonBody,
    validateBody,
} from "@/lib/api-helpers";
import { checkDailyIssueLimit } from "@/lib/rate-limit";
import {
    adjustTrustAndCheckBadges,
    updateLeaderboard,
    awardBadge,
} from "@/lib/trust";
import { createNotification } from "@/lib/notifications";
import { haversineKm } from "@/lib/geo";
import { checkProfanity } from "@/lib/ollama";

// ─── GET /api/issues ──────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
    const { searchParams } = req.nextUrl;
    const lat = parseFloat(searchParams.get("lat") ?? "28.6139");
    const lng = parseFloat(searchParams.get("lng") ?? "77.2090");
    const radiusKm = Math.min(
        parseFloat(searchParams.get("radiusKm") ?? "5"),
        50,
    );
    const statusFilter = searchParams.get("status")?.split(",").filter(Boolean);
    const categoryFilter = searchParams
        .get("category")
        ?.split(",")
        .filter(Boolean);
    const personal = searchParams.get("personal") === "true";
    const global = searchParams.get("global") === "true";
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
    const limit = Math.min(200, parseInt(searchParams.get("limit") ?? "200"));
    const offset = (page - 1) * limit;

    try {
        // Use raw SQL for PostGIS spatial query
        const radiusMeters = radiusKm * 1000;

        // Build filters dynamically
        const statusWhere = statusFilter?.length
            ? { status: { in: statusFilter as any[] } }
            : {};
        const categoryWhere = categoryFilter?.length
            ? { category: { in: categoryFilter as any[] } }
            : {};

        // Bounding box pre-filter (faster than PostGIS-only for large datasets)
        const latDelta = radiusKm / 111;
        const lngDelta = radiusKm / (111 * Math.cos((lat * Math.PI) / 180));

        // When global=true, skip geo filter (used by landing page)
        const geoWhere = global
            ? {}
            : {
                  lat: { gte: lat - latDelta, lte: lat + latDelta },
                  lng: { gte: lng - lngDelta, lte: lng + lngDelta },
              };

        const issues = await prisma.issue.findMany({
            where: {
                isFlagged: false,
                status: { not: "CLOSED" },
                isPersonal: personal ? true : false,
                ...geoWhere,
                ...statusWhere,
                ...categoryWhere,
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
                bounty: true,
                priority: true,
                createdAt: true,
            },
            orderBy: [
                { priority: "desc" },
                { upvotes: "desc" },
                { createdAt: "desc" },
            ],
            take: limit,
            skip: offset,
        });

        return apiSuccess({ issues, total: issues.length, page });
    } catch (err) {
        console.error("GET /api/issues error:", err);
        return apiError("Failed to fetch issues", 500);
    }
}

// ─── POST /api/issues ─────────────────────────────────────────────────────────

const createIssueSchema = z.object({
    title: z.string().min(10).max(200),
    description: z.string().min(20).max(2000),
    category: z.enum([
        "ROAD",
        "WATER",
        "ELECTRICITY",
        "SANITATION",
        "PUBLIC_SPACE",
        "ENVIRONMENT",
        "LOST_FOUND",
        "OTHER",
    ]),
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    address: z.string().max(500).optional(),
    imageUrls: z.array(z.string()).min(0).max(5),
    isPersonal: z.boolean().default(false),
    bounty: z.number().int().min(0).max(100000).optional(),
    userLat: z.number().min(-90).max(90).optional(),
    userLng: z.number().min(-180).max(180).optional(),
    aiAnalysis: z
        .object({
            isDuplicate: z.boolean(),
            duplicateOfId: z.string().nullable(),
            priorityScore: z.number(),
            estimatedResolutionDays: z.number(),
            suggestedCategory: z.string(),
            moderationFlags: z.array(z.string()),
            imageModerationPassed: z.boolean().optional(),
            imageModerationReason: z.string().nullable().optional(),
        })
        .nullable()
        .optional(),
});

export async function POST(req: NextRequest) {
    const { userId, error } = await requireAuthUniversal(req);
    if (error) return error;

    const body = await parseJsonBody(req);
    if (!body) return apiError("Invalid JSON body");

    const { data, error: validationError } = validateBody(
        createIssueSchema,
        body,
    );
    if (validationError) return validationError;

    // Rate limit: 5 issues per day
    if (!data.isPersonal) {
        const withinLimit = await checkDailyIssueLimit(userId);
        if (!withinLimit) {
            return apiError(
                "Daily report limit reached (5 per day). Try again tomorrow.",
                429,
            );
        }
    }

    // Server-side 2km geofence check
    if (data.userLat != null && data.userLng != null) {
        const distKm = haversineKm(
            data.userLat,
            data.userLng,
            data.lat,
            data.lng,
        );
        if (distKm > 2) {
            return apiError(
                "Report location must be within 2km of your current location.",
                400,
            );
        }
    }

    // ── Text moderation: instant regex check (never times out) ─────────────────
    const textCheck = checkProfanity(`${data.title} ${data.description}`);
    if (!textCheck.passed) {
        return apiError(
            textCheck.reason ??
                "Your report contains inappropriate language. Please keep it professional.",
            422,
        );
    }

    // ── Image moderation: trust the analyze-step result sent by the client ─────
    // Image moderation via LLaVA is performed in /api/ai/analyze-issue (one call).
    // We enforce the result here — if the client reports imageModerationPassed=false
    // we block. A client that strips the flag bypasses image check but still hits
    // text moderation above. LLaVA also sets moderationFlags which are auto-flagged.
    const aiAnalysisMod = data.aiAnalysis as any;
    if (aiAnalysisMod?.imageModerationPassed === false) {
        return apiError(
            aiAnalysisMod.imageModerationReason
                ? `Image rejected: ${aiAnalysisMod.imageModerationReason}`
                : "One or more images do not appear to be related to the described issue.",
            422,
        );
    }

    const { aiAnalysis } = data;

    // Handle duplicate detection from AI
    if (aiAnalysis?.isDuplicate && aiAnalysis.duplicateOfId) {
        // Verify the duplicate exists
        const original = await prisma.issue.findUnique({
            where: { id: aiAnalysis.duplicateOfId },
        });

        if (original) {
            // Merge upvote on original + credit reporter
            await prisma.$transaction([
                prisma.issue.update({
                    where: { id: original.id },
                    data: { upvotes: { increment: 1 } },
                }),
            ]);

            await adjustTrustAndCheckBadges(userId, 2); // credit for spotting same issue

            await createNotification({
                userId,
                issueId: original.id,
                type: "DUPLICATE_DETECTED",
                title: "Duplicate Issue Found",
                body: `Your report matches an existing issue: "${original.title}". We've merged your upvote!`,
                actionUrl: `/issues/${original.id}`,
            });

            return apiSuccess({
                isDuplicate: true,
                redirectTo: `/issues/${original.id}`,
                originalId: original.id,
            });
        }
    }

    // Auto-flag if AI detected moderation issues
    const shouldFlag =
        aiAnalysis?.moderationFlags?.some((f) =>
            ["political", "offensive", "spam"].includes(f),
        ) ?? false;

    // Calculate deadline
    const deadlineDays = aiAnalysis?.estimatedResolutionDays ?? 7;
    const deadline = new Date(Date.now() + deadlineDays * 24 * 60 * 60 * 1000);

    // Personal issues expire in 30 days
    const expiresAt = data.isPersonal
        ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        : null;

    const issue = await prisma.$transaction(async (tx) => {
        const created = await tx.issue.create({
            data: {
                title: data.title,
                description: data.description,
                category: data.category,
                status: "REPORTED",
                lat: data.lat,
                lng: data.lng,
                address: data.address,
                imageUrls: data.imageUrls,
                isPersonal: data.isPersonal,
                bounty: data.bounty,
                reporterId: userId,
                priority: aiAnalysis?.priorityScore ?? 5,
                aiAnalysis: aiAnalysis ?? undefined,
                isFlagged: shouldFlag,
                flagCount: shouldFlag ? 1 : 0,
                deadline,
                expiresAt: expiresAt ?? undefined,
            },
        });

        // Increment user's totalReports
        await tx.user.update({
            where: { id: userId },
            data: { totalReports: { increment: 1 } },
        });

        return created;
    });

    // Award FIRST_REPORT badge if this is their 1st report
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { totalReports: true },
    });
    if (user?.totalReports === 1) {
        await awardBadge(userId, "FIRST_REPORT");
    }

    await updateLeaderboard(userId, aiAnalysis?.priorityScore ?? 1);

    return apiSuccess({ id: issue.id, redirectTo: `/issues/${issue.id}` }, 201);
}
