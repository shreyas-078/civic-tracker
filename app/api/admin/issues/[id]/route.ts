import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess, requireAdmin } from "@/lib/api-helpers";

export async function DELETE(
    req: NextRequest,
    { params }: { params: { id: string } },
) {
    const { error } = await requireAdmin();
    if (error) return error;

    const issue = await prisma.issue.findUnique({ where: { id: params.id } });
    if (!issue) return apiError("Issue not found", 404);

    await prisma.issue.update({
        where: { id: params.id },
        data: { status: "CLOSED" },
    });

    return apiSuccess({ success: true });
}
