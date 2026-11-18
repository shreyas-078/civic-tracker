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
import { adjustTrustAndCheckBadges, TRUST_DELTA } from "@/lib/trust";
import { createNotification } from "@/lib/notifications";

const verifySchema = z.object({
    vote: z.enum(["YES", "NO", "IDK"]),
});

export async function POST(
    req: NextRequest,
    { params }: { params: { id: string } },
) {
    const { session, error } = await requireAuth();
    if (error) return error;

    const body = await parseJsonBody(req);
    const { data, error: ve } = validateBody(verifySchema, body);
    if (ve) return ve;

    const userId = session!.user.id;
    const issueId = params.id;

    const issue = await prisma.issue.findUnique({
        where: { id: issueId },
        select: {
            id: true,
            title: true,
            status: true,
            reporterId: true,
            assignedNGOId: true,
            createdAt: true,
            resolvedAt: true,
        },
    });
    if (!issue) return apiError("Issue not found", 404);

    if (issue.status !== "RESOLVED") {
        return apiError("Issue is not in RESOLVED state");
    }

    // Use the dedicated ResolutionVote model (shared with mobile)
    await prisma.resolutionVote.upsert({
        where: { userId_issueId: { userId, issueId } },
        create: { userId, issueId, vote: data.vote },
        update: { vote: data.vote },
    });

    // Tally resolution votes
    const allVotes = await prisma.resolutionVote.findMany({
        where: { issueId },
    });

    const yesCount = allVotes.filter((v) => v.vote === "YES").length;
    const noCount = allVotes.filter((v) => v.vote === "NO").length;
    const total = yesCount + noCount;

    let outcome: "pending" | "confirmed" | "reopened" = "pending";

    // Count upvoters to determine majority threshold
    const upvoterCount = await prisma.vote.count({
        where: { issueId, value: 1 },
    });
    // Need >50% of upvoters to have voted, minimum 1 decisive vote
    const quorum = Math.max(1, Math.ceil(upvoterCount * 0.5));

    // Resolve the NGO user who submitted the resolution claim (if any)
    let resolverUserId: string | null = null;
    if (issue.assignedNGOId) {
        const ngo = await prisma.nGO.findUnique({
            where: { id: issue.assignedNGOId },
            select: { userId: true },
        });
        resolverUserId = ngo?.userId ?? null;
    }

    if (total >= quorum) {
        const yesPct = yesCount / total;
        const noPct = noCount / total;

        if (yesPct >= 0.6) {
            // Confirmed resolved → CLOSE the issue (archive / remove from map)
            await prisma.issue.update({
                where: { id: issueId },
                data: { status: "CLOSED" },
            });

            // Reward reporter for having their issue genuinely resolved
            await adjustTrustAndCheckBadges(
                issue.reporterId,
                TRUST_DELTA.REPORT_VERIFIED,
            );
            // Reward the resolver (NGO) for a successful resolution
            if (resolverUserId) {
                await adjustTrustAndCheckBadges(
                    resolverUserId,
                    TRUST_DELTA.RESOLUTION_CONFIRMED_RESOLVER,
                );
            }
            // Reward the current voter for voting in the majority
            await adjustTrustAndCheckBadges(
                userId,
                TRUST_DELTA.CORRECT_RESOLUTION_VOTE,
            );

            await createNotification({
                userId: issue.reporterId,
                issueId,
                type: "ISSUE_RESOLVED",
                title: "Issue confirmed resolved!",
                body: `Community verified that "${issue.title}" has been resolved. Thank you!`,
                actionUrl: `/issues/${issueId}`,
            });

            outcome = "confirmed";
        } else if (noPct >= 0.6) {
            // Majority says NOT resolved → reopen issue
            await prisma.issue.update({
                where: { id: issueId },
                data: {
                    status: issue.assignedNGOId ? "ASSIGNED" : "VERIFIED",
                    resolvedAt: null,
                    resolutionProof: [],
                },
            });

            // Clear resolution votes so the process can restart
            await prisma.resolutionVote.deleteMany({ where: { issueId } });

            // Penalise the RESOLVER for a false resolution claim — NOT the reporter
            if (resolverUserId) {
                await adjustTrustAndCheckBadges(
                    resolverUserId,
                    TRUST_DELTA.FALSE_RESOLUTION_CLAIM,
                );
            }
            // Reward the current voter for voting in the majority
            await adjustTrustAndCheckBadges(
                userId,
                TRUST_DELTA.CORRECT_RESOLUTION_VOTE,
            );

            await createNotification({
                userId: issue.reporterId,
                issueId,
                type: "ISSUE_ASSIGNED",
                title: "Issue reopened",
                body: `Community verified that "${issue.title}" is not yet resolved.`,
                actionUrl: `/issues/${issueId}`,
            });

            outcome = "reopened";
        }
    }

    return apiSuccess({ vote: data.vote, yesCount, noCount, total, outcome });
}
