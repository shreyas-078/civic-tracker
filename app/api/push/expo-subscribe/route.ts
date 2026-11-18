import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess } from "@/lib/api-helpers";

const subscribeSchema = z.object({
    token: z.string().min(1),
    lat: z.number().optional(),
    lng: z.number().optional(),
});

/**
 * Register or update an Expo Push Token for the authenticated user.
 * Optionally stores the device's last-known location for proximity checks.
 */
export async function POST(req: NextRequest) {
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

    const parsed = subscribeSchema.safeParse(body);
    if (!parsed.success) {
        return apiError(parsed.error.issues[0]?.message ?? "Validation error");
    }

    const { token, lat, lng } = parsed.data;

    await prisma.expoPushToken.upsert({
        where: { token },
        create: {
            userId: session.userId,
            token,
            lat: lat ?? null,
            lng: lng ?? null,
        },
        update: {
            userId: session.userId,
            lat: lat ?? undefined,
            lng: lng ?? undefined,
        },
    });

    return apiSuccess({ ok: true });
}
