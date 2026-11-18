import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { ZodSchema } from "zod";
import { prisma } from "@/lib/prisma";

export function apiError(message: string, status = 400) {
    return NextResponse.json({ error: message }, { status });
}

export function apiSuccess<T>(data: T, status = 200) {
    return NextResponse.json(data, { status });
}

export async function getAuthSession() {
    return auth();
}

export async function requireAuth() {
    const session = await auth();
    if (!session?.user?.id) {
        return { session: null, error: apiError("Unauthorized", 401) };
    }
    return { session, error: null };
}

/**
 * Authenticate a request from either NextAuth session (web) or Bearer token (mobile).
 * Returns the userId or an error response. Rejects blacklisted users.
 */
export async function requireAuthUniversal(req: NextRequest) {
    // Try mobile Bearer token first
    const authHeader = req.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
        const sessionToken = authHeader.slice(7);
        const dbSession = await prisma.session.findUnique({
            where: { sessionToken },
            select: { userId: true, expires: true },
        });
        if (dbSession && dbSession.expires > new Date()) {
            // Check blacklist
            const user = await prisma.user.findUnique({
                where: { id: dbSession.userId },
                select: { isBlacklisted: true },
            });
            if (user?.isBlacklisted) {
                return {
                    userId: null,
                    error: apiError(
                        "Your account has been suspended due to low trust score. Contact support.",
                        403,
                    ),
                };
            }
            return { userId: dbSession.userId, error: null };
        }
        return { userId: null, error: apiError("Session expired", 401) };
    }

    // Fallback to NextAuth session (web)
    const session = await auth();
    if (!session?.user?.id) {
        return { userId: null, error: apiError("Unauthorized", 401) };
    }
    // Check blacklist
    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { isBlacklisted: true },
    });
    if (user?.isBlacklisted) {
        return {
            userId: null,
            error: apiError(
                "Your account has been suspended due to low trust score. Contact support.",
                403,
            ),
        };
    }
    return { userId: session.user.id, error: null };
}

/**
 * Like requireAuthUniversal but returns null userId instead of error for anonymous users.
 */
export async function optionalAuthUniversal(req: NextRequest) {
    const authHeader = req.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
        const sessionToken = authHeader.slice(7);
        const dbSession = await prisma.session.findUnique({
            where: { sessionToken },
            select: { userId: true, expires: true },
        });
        if (dbSession && dbSession.expires > new Date()) {
            return { userId: dbSession.userId };
        }
        return { userId: null };
    }
    const session = await auth();
    return { userId: session?.user?.id ?? null };
}

export async function requireAdmin(req?: NextRequest) {
    // Mobile: Bearer token path
    if (req) {
        const authHeader = req.headers.get("Authorization");
        if (authHeader?.startsWith("Bearer ")) {
            const sessionToken = authHeader.slice(7);
            const dbSession = await prisma.session.findUnique({
                where: { sessionToken },
                select: { userId: true, expires: true },
            });
            if (!dbSession || dbSession.expires <= new Date()) {
                return { userId: null, error: apiError("Session expired", 401) };
            }
            const user = await prisma.user.findUnique({
                where: { id: dbSession.userId },
                select: { role: true },
            });
            if (user?.role !== "ADMIN") {
                return { userId: null, error: apiError("Forbidden", 403) };
            }
            return { userId: dbSession.userId, error: null };
        }
    }
    // Web: NextAuth session path
    const session = await auth();
    if (!session?.user?.id) {
        return { userId: null, error: apiError("Unauthorized", 401) };
    }
    if ((session.user as any).role !== "ADMIN") {
        return { userId: null, error: apiError("Forbidden", 403) };
    }
    return { userId: session.user.id, error: null };
}

export function validateBody<T>(
    schema: ZodSchema<T>,
    body: unknown,
): { data: T; error: null } | { data: null; error: NextResponse } {
    const result = schema.safeParse(body);
    if (!result.success) {
        return {
            data: null,
            error: apiError(
                result.error.issues[0]?.message ?? "Validation error",
            ),
        };
    }
    return { data: result.data, error: null };
}

export async function parseJsonBody(req: NextRequest) {
    try {
        return await req.json();
    } catch {
        return null;
    }
}
