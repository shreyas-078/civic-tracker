import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess } from "@/lib/api-helpers";
import { notifyUpvoters } from "@/lib/notifications";

const reportSchema = z.object({
    issueId: z.string().min(1),
    resolutionProof: z.array(z.string()).min(1).max(3),
});

/**
 * POST /api/resolution/report-nearby
 *
 * A mobile user reports that an issue has been resolved and provides proof photos.
 * This endpoint:
 *  1. Marks the issue as RESOLVED with proof.
 *  2. Finds all Expo push tokens within 2km of the issue.
 *  3. Sends push notifications asking nearby users to verify.
 *  4. Creates in-app RESOLUTION_NEARBY_CHECK notifications.
 */
export async function POST(req: NextRequest) {
    // Authenticate via mobile session token
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
        return apiError("Unauthorized", 401);
    }

    const sessionToken = authHeader.slice(7);
    const session = await prisma.session.findUnique({
        where: { sessionToken },
        select: { userId: true, expires: true },
    });

    if (!session || session.expires < new Date()) {
        return apiError("Session expired", 401);
    }

    let body;
    try {
        body = await req.json();
    } catch {
        return apiError("Invalid JSON body");
    }

    const parsed = reportSchema.safeParse(body);
    if (!parsed.success) {
        return apiError(parsed.error.issues[0]?.message ?? "Validation error");
    }

    const { issueId, resolutionProof } = parsed.data;
    const userId = session.userId;

    const issue = await prisma.issue.findUnique({
        where: { id: issueId },
        select: {
            id: true,
            title: true,
            lat: true,
            lng: true,
            status: true,
            reporterId: true,
            assignedNGOId: true,
        },
    });

    if (!issue) return apiError("Issue not found", 404);

    if (issue.status === "RESOLVED" || issue.status === "CLOSED") {
        return apiError("Issue is already resolved or closed");
    }

    // Mark issue as RESOLVED with proof
    await prisma.issue.update({
        where: { id: issueId },
        data: {
            status: "RESOLVED",
            resolvedAt: new Date(),
            resolutionProof,
        },
    });

    // Record the reporter's own vote as YES
    await prisma.resolutionVote.upsert({
        where: { userId_issueId: { userId, issueId } },
        create: { userId, issueId, vote: "YES" },
        update: { vote: "YES" },
    });

    // Notify all upvoters + reporter via push notification + in-app notification
    // (only people who upvoted this specific issue, not random nearby users)
    const resolver = await prisma.user.findUnique({
        where: { id: userId },
        select: { name: true },
    });
    const resolverName = resolver?.name ?? "Someone";

    await notifyUpvoters(
        issueId,
        "RESOLUTION_VERIFY_REQUEST",
        `${resolverName} says this issue is resolved`,
        `${resolverName} has submitted a resolution request for "${issue.title}". Has this issue been resolved?`,
        userId,
    );

    return apiSuccess({
        ok: true,
    });
}
