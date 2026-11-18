import { prisma } from "@/lib/prisma";
import { NotificationType } from "@prisma/client";
import { sendExpoPush } from "@/lib/expo-push";

/** Create an in-app notification */
export async function createNotification(params: {
    userId: string;
    issueId?: string;
    type: NotificationType;
    title: string;
    body: string;
    actionUrl?: string;
}) {
    return prisma.notification.create({
        data: {
            userId: params.userId,
            issueId: params.issueId,
            type: params.type,
            title: params.title,
            body: params.body,
            actionUrl: params.actionUrl,
        },
    });
}

/**
 * Notify all users who upvoted an issue AND the reporter (for resolution verification).
 * Creates in-app notifications AND sends Expo push notifications to their devices.
 */
export async function notifyUpvoters(
    issueId: string,
    type: NotificationType,
    title: string,
    body: string,
    excludeUserId?: string,
) {
    const upvoters = await prisma.vote.findMany({
        where: { issueId, value: 1 },
        select: { userId: true },
    });

    const issue = await prisma.issue.findUnique({
        where: { id: issueId },
        select: { title: true, reporterId: true },
    });

    if (!issue) return;

    // Collect all users to notify: upvoters + reporter (deduplicated)
    const allUserIds = new Set(upvoters.map((v) => v.userId));
    allUserIds.add(issue.reporterId);

    // Exclude the triggering user from in-app notifications (they already know)
    const inAppUserIds = [...allUserIds].filter((id) => id !== excludeUserId);

    if (inAppUserIds.length > 0) {
        // Create in-app notifications
        await prisma.notification.createMany({
            data: inAppUserIds.map((userId) => ({
                userId,
                issueId,
                type,
                title,
                body,
                actionUrl: `/issues/${issueId}`,
            })),
            skipDuplicates: true,
        });
    }

    // Send Expo push notifications to ALL relevant users (including the resolver)
    // so cross-device notifications work (e.g. reporter resolves from web, gets push on phone)
    const pushUserIds = [...allUserIds];
    console.log(
        `[notify] issueId=${issueId} pushUserIds=[${pushUserIds.join(",")}]`,
    );
    const tokens = await prisma.expoPushToken.findMany({
        where: { userId: { in: pushUserIds } },
        select: { token: true },
    });
    console.log(`[notify] found ${tokens.length} expo push tokens`);

    if (tokens.length > 0) {
        await sendExpoPush(
            tokens.map((t) => ({
                to: t.token,
                title,
                body,
                data: { issueId, type },
                channelId: "resolution",
                sound: "default" as const,
                priority: "high" as const,
            })),
        );
    }
}

/** Send Web Push notification to a user's subscriptions */
export async function sendWebPush(
    userId: string,
    payload: { title: string; body: string; url?: string },
) {
    const subscriptions = await prisma.pushSubscription.findMany({
        where: { userId },
    });

    if (subscriptions.length === 0) return;

    // Dynamic import to avoid server-side issues
    const webpush = await import("web-push");

    if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
        webpush.default.setVapidDetails(
            "mailto:admin@civictrack.dev",
            process.env.VAPID_PUBLIC_KEY,
            process.env.VAPID_PRIVATE_KEY,
        );
    }

    const results = await Promise.allSettled(
        subscriptions.map((sub) =>
            webpush.default.sendNotification(
                {
                    endpoint: sub.endpoint,
                    keys: { p256dh: sub.p256dh, auth: sub.auth },
                },
                JSON.stringify(payload),
            ),
        ),
    );

    // Remove stale subscriptions (410 Gone)
    const staleEndpoints = subscriptions
        .filter((_, i) => {
            const result = results[i];
            return (
                result.status === "rejected" &&
                result.reason?.statusCode === 410
            );
        })
        .map((s) => s.endpoint);

    if (staleEndpoints.length > 0) {
        await prisma.pushSubscription.deleteMany({
            where: { endpoint: { in: staleEndpoints } },
        });
    }
}
