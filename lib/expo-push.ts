import { prisma } from "@/lib/prisma";
import { haversineKm } from "@/lib/geo";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

interface ExpoPushMessage {
    to: string;
    title: string;
    body: string;
    data?: Record<string, unknown>;
    channelId?: string;
    sound?: "default" | null;
    priority?: "default" | "normal" | "high";
}

/**
 * Send Expo push notifications in batches.
 * Automatically removes invalid tokens (DeviceNotRegistered).
 */
export async function sendExpoPush(messages: ExpoPushMessage[]) {
    if (messages.length === 0) return;

    // Expo Push API accepts batches of up to 100
    const batches: ExpoPushMessage[][] = [];
    for (let i = 0; i < messages.length; i += 100) {
        batches.push(messages.slice(i, i + 100));
    }

    const invalidTokens: string[] = [];

    for (const batch of batches) {
        try {
            const res = await fetch(EXPO_PUSH_URL, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Accept: "application/json",
                },
                body: JSON.stringify(batch),
            });

            if (res.ok) {
                const json = await res.json();
                const tickets = json.data as Array<{
                    status: string;
                    details?: { error?: string };
                    message?: string;
                    id?: string;
                }>;
                tickets.forEach((ticket, idx) => {
                    if (ticket.status === "error") {
                        console.error(
                            `[expo-push] ticket error for ${batch[idx].to}:`,
                            ticket.details?.error,
                            ticket.message,
                        );
                        if (ticket.details?.error === "DeviceNotRegistered") {
                            invalidTokens.push(batch[idx].to);
                        }
                    }
                });
            } else {
                console.error(
                    `[expo-push] API responded ${res.status}:`,
                    await res.text().catch(() => "(no body)"),
                );
            }
        } catch (err) {
            console.error("[expo-push] network error:", err);
        }
    }

    // Clean up stale tokens
    if (invalidTokens.length > 0) {
        await prisma.expoPushToken.deleteMany({
            where: { token: { in: invalidTokens } },
        });
    }
}

/**
 * Find all Expo push tokens within `radiusKm` of a given point.
 * Excludes the specified user (the one reporting the resolution).
 */
export async function findNearbyTokens(
    lat: number,
    lng: number,
    radiusKm: number,
    excludeUserId?: string,
) {
    // Pre-filter with a bounding box (rough) then refine with haversine
    const latDelta = radiusKm / 111.32;
    const lngDelta = radiusKm / (111.32 * Math.cos((lat * Math.PI) / 180));

    const tokens = await prisma.expoPushToken.findMany({
        where: {
            lat: { gte: lat - latDelta, lte: lat + latDelta },
            lng: { gte: lng - lngDelta, lte: lng + lngDelta },
            ...(excludeUserId ? { userId: { not: excludeUserId } } : {}),
        },
        select: { token: true, userId: true, lat: true, lng: true },
    });

    return tokens.filter((t) => {
        if (t.lat == null || t.lng == null) return false;
        return haversineKm(lat, lng, t.lat, t.lng) <= radiusKm;
    });
}
