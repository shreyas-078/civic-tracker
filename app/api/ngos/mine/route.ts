import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthUniversal, apiSuccess, apiError } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
    const { userId, error } = await requireAuthUniversal(req);
    if (error) return error;

    const ngo = await prisma.nGO.findUnique({
        where: { userId },
        select: {
            id: true,
            name: true,
            status: true,
            categories: true,
            resolvedCount: true,
            unresolvedCount: true,
            createdAt: true,
        },
    });

    if (!ngo) return apiSuccess({ ngo: null });
    return apiSuccess({ ngo });
}
