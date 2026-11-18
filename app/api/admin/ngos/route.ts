import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiSuccess, requireAdmin } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  const { error } = await requireAdmin(req);
  if (error) return error;

  const ngos = await prisma.nGO.findMany({
    where: { status: "PENDING" },
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return apiSuccess({ ngos });
}
