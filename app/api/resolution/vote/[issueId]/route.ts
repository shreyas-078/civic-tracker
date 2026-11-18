import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess } from "@/lib/api-helpers";
import { adjustTrustAndCheckBadges, TRUST_DELTA } from "@/lib/trust";
import { createNotification } from "@/lib/notifications";

const voteSchema = z.object({
    vote: z.enum(["YES", "NO", "IDK"]),
});

/**
 * POST /api/resolution/vote/[issueId]
 *
 * Cast a resolution verification vote from a mobile device.
 * Uses the ResolutionVote model for cleaner resolution tracking.
 * Auto-closes if community consensus is reached.
 */
export async function POST(
    req: NextRequest,
    { params }: { params: { issueId: string } },
) {
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

    const parsed = voteSchema.safeParse(body);
    if (!parsed.success) {
        return apiError(parsed.error.issues[0]?.message ?? "Validation error");
    }

    const { issueId } = params;
    const userId = session.userId;
    const { vote } = parsed.data;

    const issue = await prisma.issue.findUnique({
        where: { id: issueId },
        select: {
            id: true,
            title: true,
            status: true,
            reporterId: true,
            assignedNGOId: true,
        },
    });

    if (!issue) return apiError("Issue not found", 404);

    if (issue.status !== "RESOLVED") {
        return apiError("Issue is not in RESOLVED state");
    }

    // Upsert the resolution vote
    await prisma.resolutionVote.upsert({
        where: { userId_issueId: { userId, issueId } },
        create: { userId, issueId, vote },
        update: { vote },
    });

    // Tally all resolution votes
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

    if (total >= quorum) {
        const yesPct = yesCount / total;
        const noPct = noCount / total;

        if (yesPct >= 0.6) {
            // Confirmed resolved → mark as CLOSED (archived / off the map)
            await prisma.issue.update({
                where: { id: issueId },
                data: { status: "CLOSED" },
            });

            await adjustTrustAndCheckBadges(
                issue.reporterId,
                TRUST_DELTA.REPORT_VERIFIED,
            );

            // Notify reporter
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
            // Not resolved → reopen
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

            // Penalize false resolution claim
            await adjustTrustAndCheckBadges(
                issue.reporterId,
                TRUST_DELTA.FALSE_REPORT,
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

    return apiSuccess({ vote, yesCount, noCount, total, outcome });
}
