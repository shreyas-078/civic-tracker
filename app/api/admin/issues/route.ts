import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess, requireAdmin } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
    const { error } = await requireAdmin(req);
    if (error) return error;

    try {
        const issues = await prisma.issue.findMany({
            where: { status: { not: "CLOSED" } },
            select: {
                id: true,
                title: true,
                status: true,
                category: true,
                priority: true,
                upvotes: true,
                isFlagged: true,
                isPersonal: true,
                createdAt: true,
                reporter: {
                    select: { name: true, email: true },
                },
            },
            orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
            take: 100,
        });

        return apiSuccess({ issues });
    } catch (err) {
        console.error("GET /api/admin/issues error:", err);
        return apiError("Failed to fetch issues", 500);
    }
}
