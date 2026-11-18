import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiSuccess, requireAdmin } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
    const { error } = await requireAdmin(req);
    if (error) return error;

    const { searchParams } = req.nextUrl;
    const search = searchParams.get("search") ?? "";
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
    const limit = Math.min(50, parseInt(searchParams.get("limit") ?? "20"));
    const skip = (page - 1) * limit;

    const where = search
        ? {
              OR: [
                  { name: { contains: search, mode: "insensitive" as const } },
                  { email: { contains: search, mode: "insensitive" as const } },
              ],
          }
        : {};

    const [users, total] = await Promise.all([
        prisma.user.findMany({
            where,
            select: {
                id: true,
                name: true,
                email: true,
                image: true,
                role: true,
                trustScore: true,
                totalReports: true,
                createdAt: true,
            },
            orderBy: { createdAt: "desc" },
            skip,
            take: limit,
        }),
        prisma.user.count({ where }),
    ]);

    return apiSuccess({ users, total, page, limit });
}
