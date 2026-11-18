import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
    apiError,
    apiSuccess,
    requireAdmin,
    validateBody,
    parseJsonBody,
} from "@/lib/api-helpers";

const updateSchema = z.object({
    role: z.enum(["CITIZEN", "NGO", "ADMIN"]).optional(),
    trustScore: z.number().int().min(0).max(200).optional(),
});

export async function PATCH(
    req: NextRequest,
    { params }: { params: { id: string } },
) {
    const { error } = await requireAdmin();
    if (error) return error;

    const body = await parseJsonBody(req);
    const { data, error: ve } = validateBody(updateSchema, body);
    if (ve) return ve;

    const user = await prisma.user.findUnique({ where: { id: params.id } });
    if (!user) return apiError("User not found", 404);

    await prisma.user.update({
        where: { id: params.id },
        data: {
            ...(data.role !== undefined && { role: data.role }),
            ...(data.trustScore !== undefined && {
                trustScore: data.trustScore,
            }),
        },
    });

    return apiSuccess({ success: true });
}
