import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
    apiError,
    apiSuccess,
    requireAuthUniversal,
    validateBody,
    parseJsonBody,
} from "@/lib/api-helpers";
import { notifyUpvoters } from "@/lib/notifications";
import {
    adjustTrustAndCheckBadges,
    checkNGOBadges,
    TRUST_DELTA,
} from "@/lib/trust";

const resolveSchema = z.object({
    resolutionProof: z.array(z.string()).min(1).max(3),
});

/** Upload resolution proof and trigger verification flow */
export async function POST(
    req: NextRequest,
    { params }: { params: { id: string } },
) {
    const { userId, error } = await requireAuthUniversal(req);
    if (error) return error;

    const body = await parseJsonBody(req);
    const { data, error: ve } = validateBody(resolveSchema, body);
    if (ve) return ve;

    const issue = await prisma.issue.findUnique({
        where: { id: params.id },
        include: { assignedNGO: true },
    });
    if (!issue) return apiError("Issue not found", 404);

    if (issue.status === "RESOLVED" || issue.status === "CLOSED") {
        return apiError("Issue is already resolved");
    }

    const updated = await prisma.$transaction(async (tx) => {
        const u = await tx.issue.update({
            where: { id: params.id },
            data: {
                status: "RESOLVED",
                resolvedAt: new Date(),
                resolutionProof: data.resolutionProof,
            },
        });

        if (issue.assignedNGOId) {
            await tx.nGO.update({
                where: { id: issue.assignedNGOId },
                data: {
                    resolvedCount: { increment: 1 },
                    unresolvedCount: { decrement: 1 },
                },
            });
        }

        return u;
    });

    // Record the submitter's own resolution vote as YES
    await prisma.resolutionVote.upsert({
        where: { userId_issueId: { userId, issueId: params.id } },
        create: { userId, issueId: params.id, vote: "YES" },
        update: { vote: "YES" },
    });

    await adjustTrustAndCheckBadges(
        issue.reporterId,
        TRUST_DELTA.REPORT_VERIFIED,
    );

    // Bonus for resolving before the deadline
    if (issue.deadline && new Date() < new Date(issue.deadline)) {
        await adjustTrustAndCheckBadges(userId, TRUST_DELTA.NGO_DEADLINE_MET);
    }

    if (issue.assignedNGOId) {
        await checkNGOBadges(issue.assignedNGOId);
    }

    // Notify upvoters + reporter (exclude the person who submitted the resolution)
    const resolver = await prisma.user.findUnique({
        where: { id: userId },
        select: { name: true },
    });
    const resolverName = resolver?.name ?? "Someone";

    await notifyUpvoters(
        params.id,
        "RESOLUTION_VERIFY_REQUEST",
        `${resolverName} says this issue is resolved`,
        `${resolverName} has submitted resolution proof for "${issue.title}". Has this issue been resolved?`,
        userId,
    );

    return apiSuccess({ issue: updated });
}
