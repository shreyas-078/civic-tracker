import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess } from "@/lib/api-helpers";

export async function GET(
    req: NextRequest,
    { params }: { params: { id: string } },
) {
    const user = await prisma.user.findUnique({
        where: { id: params.id },
        select: {
            id: true,
            name: true,
            email: true,
            image: true,
            role: true,
            trustScore: true,
            totalReports: true,
            createdAt: true,
            badges: {
                select: { type: true, awardedAt: true },
            },
            ngo: {
                select: {
                    id: true,
                    name: true,
                    status: true,
                    resolvedCount: true,
                },
            },
            issues: {
                where: {
                    isPersonal: false,
                    isFlagged: false,
                    status: { not: "CLOSED" },
                },
                select: {
                    id: true,
                    title: true,
                    category: true,
                    status: true,
                    upvotes: true,
                    createdAt: true,
                },
                orderBy: { createdAt: "desc" },
                take: 10,
            },
        },
    });

    if (!user) {
        return apiError("User not found", 404);
    }

    return apiSuccess({ user });
}
