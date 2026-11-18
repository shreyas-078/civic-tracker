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
import { createNotification, notifyUpvoters } from "@/lib/notifications";
import {
    adjustTrustAndCheckBadges,
    checkNGOBadges,
    TRUST_DELTA,
} from "@/lib/trust";

const statusSchema = z.object({
    status: z.enum(["VERIFIED", "ASSIGNED", "RESOLVED", "CLOSED"]),
    ngoId: z.string().optional(),
    resolutionProof: z.array(z.string().url()).optional(),
});

export async function PATCH(
    req: NextRequest,
    { params }: { params: { id: string } },
) {
    // Support both web sessions (NextAuth) and mobile Bearer tokens
    const { userId, error } = await requireAuthUniversal(req);
    if (error) return error;

    const body = await parseJsonBody(req);
    const { data, error: ve } = validateBody(statusSchema, body);
    if (ve) return ve;

    // Fetch user role from DB — works for both web and mobile auth
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { role: true },
    });
    if (!user) return apiError("User not found", 404);
    const userRole = user.role;

    const issue = await prisma.issue.findUnique({
        where: { id: params.id },
        include: { assignedNGO: true },
    });
    if (!issue) return apiError("Issue not found", 404);

    // ── Transition guards ──────────────────────────────────────────────────────

    // Admin verify is no longer needed — issues are auto-verified on creation.
    // Keep accepting the transition for backwards compatibility but make it a no-op.
    if (data.status === "VERIFIED") {
        if (issue.status === "VERIFIED") {
            return apiSuccess({ issue }); // already verified
        }
        const updated = await prisma.issue.update({
            where: { id: params.id },
            data: { status: "VERIFIED", verifiedAt: new Date() },
        });
        return apiSuccess({ issue: updated });
    }

    if (data.status === "ASSIGNED") {
        if (userRole !== "NGO" && userRole !== "ADMIN") {
            return apiError("Only NGOs can claim issues", 403);
        }
        // Allow claiming from both REPORTED and VERIFIED (admin approval removed)
        if (issue.status !== "VERIFIED" && issue.status !== "REPORTED") {
            return apiError("Issue must be open before assigning");
        }

        // Find NGO for this user — include categories for validation
        const ngo = await prisma.nGO.findUnique({
            where: { userId },
            select: { id: true, status: true, categories: true },
        });

        if (!ngo || ngo.status !== "APPROVED") {
            return apiError("Your NGO is not approved");
        }

        // Enforce category restriction: NGO can only claim issues in their allowed categories
        if (
            userRole === "NGO" &&
            !ngo.categories.includes(issue.category as any)
        ) {
            return apiError(
                `Your NGO is not authorized to handle ${issue.category} issues. Your allowed categories are: ${ngo.categories.join(", ")}`,
                403,
            );
        }

        const updated = await prisma.$transaction(async (tx) => {
            const u = await tx.issue.update({
                where: { id: params.id },
                data: { status: "ASSIGNED", assignedNGOId: ngo.id },
            });
            await tx.nGO.update({
                where: { id: ngo.id },
                data: { unresolvedCount: { increment: 1 } },
            });
            return u;
        });

        await createNotification({
            userId: issue.reporterId,
            issueId: params.id,
            type: "ISSUE_ASSIGNED",
            title: "NGO claimed your issue",
            body: `Your issue "${issue.title}" has been claimed by an NGO and is being worked on.`,
            actionUrl: `/issues/${params.id}`,
        });

        // Push notification to reporter's mobile device
        const reporterTokens = await prisma.expoPushToken.findMany({
            where: { userId: issue.reporterId },
            select: { token: true },
        });
        if (reporterTokens.length > 0) {
            const { sendExpoPush } = await import("@/lib/expo-push");
            await sendExpoPush(
                reporterTokens.map((t) => ({
                    to: t.token,
                    title: "NGO claimed your issue",
                    body: `Your issue "${issue.title}" has been claimed by an NGO.`,
                    data: {
                        issueId: params.id,
                        type: "ISSUE_ASSIGNED",
                    },
                    sound: "default" as const,
                    priority: "high" as const,
                })),
            );
        }

        return apiSuccess({ issue: updated });
    }

    if (data.status === "RESOLVED") {
        if (!data.resolutionProof?.length) {
            return apiError("Resolution proof image required");
        }

        // Only the assigned NGO, admin, or the reporter can mark as resolved
        let canResolve = userRole === "ADMIN";

        if (userRole === "NGO") {
            const ngo = await prisma.nGO.findUnique({
                where: { userId },
                select: { id: true, status: true },
            });
            canResolve = !!(
                ngo &&
                ngo.status === "APPROVED" &&
                issue.assignedNGOId === ngo.id
            );
        }

        if (!canResolve) {
            return apiError(
                "Only the assigned NGO or an admin can mark this issue as resolved",
                403,
            );
        }

        const updated = await prisma.$transaction(async (tx) => {
            const u = await tx.issue.update({
                where: { id: params.id },
                data: {
                    status: "RESOLVED",
                    resolvedAt: new Date(),
                    resolutionProof: data.resolutionProof!,
                },
            });

            // Update NGO stats
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

        // Record the resolver's own resolution vote as YES
        await prisma.resolutionVote.upsert({
            where: { userId_issueId: { userId, issueId: params.id } },
            create: { userId, issueId: params.id, vote: "YES" },
            update: { vote: "YES" },
        });

        // Award trust to reporter for having their issue actioned
        await adjustTrustAndCheckBadges(
            issue.reporterId,
            TRUST_DELTA.REPORT_VERIFIED,
        );

        // Award trust to resolver for taking ownership of the issue
        await adjustTrustAndCheckBadges(userId, 3);

        // Bonus for fast resolution (within 48 hours of issue creation)
        const hoursSinceCreated =
            (Date.now() - issue.createdAt.getTime()) / (1000 * 60 * 60);
        if (hoursSinceCreated < 48) {
            await adjustTrustAndCheckBadges(
                userId,
                TRUST_DELTA.NGO_FAST_RESOLUTION,
            );
        }

        // Bonus for resolving before the deadline
        if (issue.deadline && new Date() < issue.deadline) {
            await adjustTrustAndCheckBadges(
                userId,
                TRUST_DELTA.NGO_DEADLINE_MET,
            );
        }

        // Check NGO badges
        if (issue.assignedNGOId) {
            await checkNGOBadges(issue.assignedNGOId);
        }

        // Notify upvoters + reporter to verify resolution (in-app + push)
        const resolver = await prisma.user.findUnique({
            where: { id: userId },
            select: { name: true },
        });
        const resolverName = resolver?.name ?? "Someone";

        await notifyUpvoters(
            params.id,
            "RESOLUTION_VERIFY_REQUEST",
            `${resolverName} says this issue is resolved`,
            `${resolverName} has submitted resolution proof for "${issue.title}". Has this issue actually been fixed?`,
            userId,
        );

        return apiSuccess({ issue: updated });
    }

    if (data.status === "CLOSED") {
        if (userRole !== "ADMIN")
            return apiError("Only admins can close issues", 403);

        const updated = await prisma.issue.update({
            where: { id: params.id },
            data: { status: "CLOSED" },
        });
        return apiSuccess({ issue: updated });
    }

    return apiError("Invalid status transition");
}
