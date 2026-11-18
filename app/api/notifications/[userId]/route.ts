import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess, requireAuthUniversal } from "@/lib/api-helpers";

export async function GET(
    req: NextRequest,
    { params }: { params: { userId: string } },
) {
    const { userId, error } = await requireAuthUniversal(req);
    if (error) return error;

    // Users can only fetch their own notifications
    if (userId !== params.userId) {
        return apiError("Forbidden", 403);
    }

    const { searchParams } = req.nextUrl;
    const unreadOnly = searchParams.get("unread") === "true";
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
    const limit = 20;

    const [notifications, unreadCount] = await Promise.all([
        prisma.notification.findMany({
            where: {
                userId: params.userId,
                ...(unreadOnly ? { isRead: false } : {}),
            },
            include: {
                issue: { select: { id: true, title: true } },
            },
            orderBy: { createdAt: "desc" },
            take: limit,
            skip: (page - 1) * limit,
        }),
        prisma.notification.count({
            where: { userId: params.userId, isRead: false },
        }),
    ]);

    return apiSuccess({ notifications, unreadCount, page });
}

export async function PATCH(
    req: NextRequest,
    { params }: { params: { userId: string } },
) {
    const { userId, error } = await requireAuthUniversal(req);
    if (error) return error;

    if (userId !== params.userId) {
        return apiError("Forbidden", 403);
    }

    // Mark all as read
    await prisma.notification.updateMany({
        where: { userId: params.userId, isRead: false },
        data: { isRead: true },
    });

    return apiSuccess({ success: true });
}
