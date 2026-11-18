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
import { adjustTrustAndCheckBadges, TRUST_DELTA } from "@/lib/trust";

const voteSchema = z.object({
    value: z.union([z.literal(1), z.literal(-1), z.literal(0)]),
});

export async function POST(
    req: NextRequest,
    { params }: { params: { id: string } },
) {
    try {
        const { userId, error } = await requireAuthUniversal(req);
        if (error) return error;

        const body = await parseJsonBody(req);
        const { data, error: ve } = validateBody(voteSchema, body);
        if (ve) return ve;
        const issueId = params.id;

        const issue = await prisma.issue.findUnique({
            where: { id: issueId },
            select: {
                id: true,
                reporterId: true,
                upvotes: true,
                downvotes: true,
            },
        });
        if (!issue) return apiError("Issue not found", 404);
        if (issue.reporterId === userId)
            return apiError("Cannot vote on your own issue");

        const existingVote = await prisma.vote.findUnique({
            where: { userId_issueId: { userId, issueId } },
        });

        await prisma.$transaction(async (tx) => {
            const prevValue = existingVote?.value ?? 0;
            const newValue = data.value;

            if (newValue === 0) {
                // Remove vote
                if (existingVote) {
                    await tx.vote.delete({
                        where: { userId_issueId: { userId, issueId } },
                    });
                    if (prevValue === 1) {
                        await tx.issue.update({
                            where: { id: issueId },
                            data: { upvotes: { decrement: 1 } },
                        });
                    } else if (prevValue === -1) {
                        await tx.issue.update({
                            where: { id: issueId },
                            data: { downvotes: { decrement: 1 } },
                        });
                    }
                }
            } else {
                await tx.vote.upsert({
                    where: { userId_issueId: { userId, issueId } },
                    create: { userId, issueId, value: newValue },
                    update: { value: newValue },
                });

                // Adjust counts
                if (prevValue === 1 && newValue !== 1) {
                    await tx.issue.update({
                        where: { id: issueId },
                        data: { upvotes: { decrement: 1 } },
                    });
                }
                if (prevValue === -1 && newValue !== -1) {
                    await tx.issue.update({
                        where: { id: issueId },
                        data: { downvotes: { decrement: 1 } },
                    });
                }
                if (newValue === 1 && prevValue !== 1) {
                    await tx.issue.update({
                        where: { id: issueId },
                        data: { upvotes: { increment: 1 } },
                    });
                }
                if (newValue === -1 && prevValue !== -1) {
                    await tx.issue.update({
                        where: { id: issueId },
                        data: { downvotes: { increment: 1 } },
                    });
                }
            }
        });

        // Update reporter trust if upvoting
        if (data.value === 1 && existingVote?.value !== 1) {
            await adjustTrustAndCheckBadges(
                issue.reporterId,
                TRUST_DELTA.UPVOTE_RECEIVED,
            );
        } else if (data.value !== 1 && existingVote?.value === 1) {
            await adjustTrustAndCheckBadges(
                issue.reporterId,
                -TRUST_DELTA.UPVOTE_RECEIVED,
            );
        }

        // Auto-verify: promote REPORTED → VERIFIED once upvotes reach threshold
        const VERIFY_THRESHOLD = 1;
        const refreshed = await prisma.issue.findUnique({
            where: { id: issueId },
            select: { upvotes: true, status: true },
        });

        if (
            refreshed &&
            refreshed.status === "REPORTED" &&
            refreshed.upvotes >= VERIFY_THRESHOLD
        ) {
            await prisma.issue.update({
                where: { id: issueId },
                data: { status: "VERIFIED", verifiedAt: new Date() },
            });
        }

        // Get updated counts for response
        const updatedIssue = await prisma.issue.findUnique({
            where: { id: issueId },
            select: { upvotes: true, status: true },
        });

        return apiSuccess({
            upvotes: updatedIssue?.upvotes ?? 0,
            status: updatedIssue?.status,
            userVote: data.value === 0 ? null : data.value,
        });
    } catch (err) {
        console.error("Vote error:", err);
        return apiError("Failed to process vote", 500);
    }
}
