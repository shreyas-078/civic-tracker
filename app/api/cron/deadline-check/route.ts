import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiSuccess } from "@/lib/api-helpers";
import { createNotification, notifyUpvoters } from "@/lib/notifications";
import { findNearbyTokens, sendExpoPush } from "@/lib/expo-push";
import {
    adjustTrustAndCheckBadges,
    TRUST_DELTA,
    BLACKLIST_THRESHOLD,
    blacklistUser,
} from "@/lib/trust";

// Protect with a secret header
function isAuthorized(req: NextRequest): boolean {
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) return true; // dev mode
    return authHeader === `Bearer ${cronSecret}`;
}

export async function GET(req: NextRequest) {
    if (!isAuthorized(req)) {
        return new Response("Unauthorized", { status: 401 });
    }

    const now = new Date();

    // 1. Find overdue issues (deadline passed, not resolved, not already notified)
    const overdueIssues = await prisma.issue.findMany({
        where: {
            deadline: { lt: now },
            status: { notIn: ["RESOLVED", "CLOSED"] },
            isFlagged: false,
            overdueNotified: false,
        },
        select: {
            id: true,
            title: true,
            lat: true,
            lng: true,
            reporterId: true,
            assignedNGOId: true,
            assignedNGO: { select: { id: true, userId: true } },
        },
        take: 100,
    });

    let notified = 0;
    let nearbyNotified = 0;
    let ngosPenalized = 0;

    for (const issue of overdueIssues) {
        // Mark as notified so we don't re-process
        await prisma.issue.update({
            where: { id: issue.id },
            data: { overdueNotified: true },
        });

        // Penalize NGO trust score if they claimed but didn't deliver
        if (issue.assignedNGO?.userId) {
            await adjustTrustAndCheckBadges(
                issue.assignedNGO.userId,
                TRUST_DELTA.NGO_DEADLINE_MISSED,
            );
            ngosPenalized++;
        }
        // Notify reporter
        await createNotification({
            userId: issue.reporterId,
            issueId: issue.id,
            type: "DEADLINE_WARNING",
            title: "Issue deadline passed",
            body: `Your report "${issue.title}" was due to be resolved but hasn't been. Can you provide an update?`,
            actionUrl: `/issues/${issue.id}`,
        });

        // Notify assigned NGO
        if (issue.assignedNGO?.userId) {
            await createNotification({
                userId: issue.assignedNGO.userId,
                issueId: issue.id,
                type: "DEADLINE_WARNING",
                title: "Issue resolution overdue",
                body: `The issue "${issue.title}" you claimed is past its resolution deadline. Please update the status.`,
                actionUrl: `/issues/${issue.id}`,
            });
        }

        // Send Expo push notifications to nearby devices asking about the issue
        const nearbyTokens = await findNearbyTokens(issue.lat, issue.lng, 2);
        if (nearbyTokens.length > 0) {
            await sendExpoPush(
                nearbyTokens.map((t) => ({
                    to: t.token,
                    title: "Is this issue still unresolved?",
                    body: `"${issue.title}" is past its deadline. Can you check if it's been fixed?`,
                    data: {
                        issueId: issue.id,
                        type: "RESOLUTION_DEADLINE_CHECK",
                    },
                    channelId: "resolution",
                    sound: "default" as const,
                    priority: "high" as const,
                })),
            );

            const uniqueUserIds = [
                ...new Set(nearbyTokens.map((t) => t.userId)),
            ];
            await prisma.notification.createMany({
                data: uniqueUserIds.map((uid) => ({
                    userId: uid,
                    issueId: issue.id,
                    type: "RESOLUTION_DEADLINE_CHECK" as const,
                    title: "Check a nearby issue",
                    body: `"${issue.title}" is past its deadline. Is it still unresolved?`,
                    actionUrl: `/issues/${issue.id}`,
                })),
                skipDuplicates: true,
            });

            nearbyNotified += nearbyTokens.length;
        }

        // Also notify all upvoters + reporter: "Is this issue resolved?"
        // This sends both in-app + Expo push notifications
        await notifyUpvoters(
            issue.id,
            "RESOLUTION_DEADLINE_CHECK",
            "Is this issue resolved?",
            `The deadline for "${issue.title}" has passed. Has this issue been resolved?`,
        );

        notified++;
    }

    // 2. Auto-expire personal issues older than 30 days
    const expiredCount = await prisma.issue.updateMany({
        where: {
            isPersonal: true,
            expiresAt: { lt: now },
            status: { notIn: ["RESOLVED", "CLOSED"] },
        },
        data: { status: "CLOSED" },
    });

    // 3. Auto-blacklist NGOs with poor performance
    const poorNGOs = await prisma.nGO.findMany({
        where: {
            status: "APPROVED",
            unresolvedCount: { gt: 10 },
        },
        select: {
            id: true,
            userId: true,
            name: true,
            resolvedCount: true,
            unresolvedCount: true,
        },
    });

    let blacklisted = 0;
    for (const ngo of poorNGOs) {
        const total = ngo.resolvedCount + ngo.unresolvedCount;
        const resolutionRate = total > 0 ? ngo.resolvedCount / total : 0;

        if (resolutionRate < 0.3) {
            await prisma.nGO.update({
                where: { id: ngo.id },
                data: {
                    status: "BLACKLISTED",
                    blacklistNote:
                        "Auto-flagged: >10 unresolved issues and <30% resolution rate",
                },
            });

            // Also blacklist the user account
            await prisma.user.update({
                where: { id: ngo.userId },
                data: { isBlacklisted: true },
            });

            await createNotification({
                userId: ngo.userId,
                type: "NGO_APPLICATION_UPDATE",
                title: "NGO Account Suspended",
                body: `Your NGO "${ngo.name}" has been suspended due to a high number of unresolved issues. Please contact support.`,
            });

            blacklisted++;
        }
    }

    // 4. Auto-blacklist any users whose trust score dropped below threshold
    const lowTrustUsers = await prisma.user.findMany({
        where: {
            trustScore: { lte: BLACKLIST_THRESHOLD },
            isBlacklisted: false,
        },
        select: { id: true },
        take: 100,
    });

    let usersBlacklisted = 0;
    for (const u of lowTrustUsers) {
        await blacklistUser(u.id);
        usersBlacklisted++;
    }

    return apiSuccess({
        notified,
        nearbyNotified,
        ngosPenalized,
        expired: expiredCount.count,
        blacklisted,
        usersBlacklisted,
        timestamp: now.toISOString(),
    });
}
