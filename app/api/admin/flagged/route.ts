import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiSuccess, requireAdmin } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  const { error } = await requireAdmin(req);
  if (error) return error;

  const issues = await prisma.issue.findMany({
    where: { isFlagged: true },
    select: {
      id: true,
      title: true,
      category: true,
      status: true,
      flagCount: true,
      createdAt: true,
      reporterId: true,
    },
    orderBy: { flagCount: "desc" },
    take: 50,
  });

  return apiSuccess({ issues });
}
