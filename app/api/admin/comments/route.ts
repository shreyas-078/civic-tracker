import { prisma } from "@/lib/prisma";
import { apiSuccess, requireAdmin } from "@/lib/api-helpers";

export async function GET() {
    const { error } = await requireAdmin();
    if (error) return error;

    const comments = await prisma.comment.findMany({
        where: { isFlagged: true, isDeleted: false },
        include: {
            author: { select: { id: true, name: true, image: true } },
            issue: { select: { id: true, title: true } },
        },
        orderBy: { flagCount: "desc" },
        take: 50,
    });

    return apiSuccess({ comments });
}
