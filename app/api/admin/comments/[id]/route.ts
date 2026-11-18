import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess, requireAdmin } from "@/lib/api-helpers";

export async function PATCH(
    req: NextRequest,
    { params }: { params: { id: string } },
) {
    const { error } = await requireAdmin();
    if (error) return error;

    await prisma.comment.update({
        where: { id: params.id },
        data: { isFlagged: false, flagCount: 0 },
    });

    return apiSuccess({ success: true });
}

export async function DELETE(
    req: NextRequest,
    { params }: { params: { id: string } },
) {
    const { error } = await requireAdmin();
    if (error) return error;

    await prisma.comment.update({
        where: { id: params.id },
        data: { isDeleted: true, content: "[Removed by moderator]" },
    });

    return apiSuccess({ success: true });
}
