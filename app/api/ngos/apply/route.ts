import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
    apiError,
    apiSuccess,
    requireAuth,
    validateBody,
    parseJsonBody,
} from "@/lib/api-helpers";

const applySchema = z.object({
    name: z.string().min(3).max(200),
    description: z.string().min(20).max(5000),
    website: z.string().url().optional(),
    phone: z.string().max(20).optional(),
    proofUrl: z.string().url().optional(),
    categories: z
        .array(
            z.enum([
                "ROAD",
                "WATER",
                "ELECTRICITY",
                "SANITATION",
                "PUBLIC_SPACE",
                "ENVIRONMENT",
                "LOST_FOUND",
                "OTHER",
            ]),
        )
        .min(1),
});

export async function POST(req: NextRequest) {
    const { session, error } = await requireAuth();
    if (error) return error;

    const body = await parseJsonBody(req);
    const { data, error: ve } = validateBody(applySchema, body);
    if (ve) return ve;

    const userId = session!.user.id;

    // Check for existing NGO application
    const existing = await prisma.nGO.findUnique({ where: { userId } });
    if (existing) {
        return apiError("You already have an NGO application");
    }

    const ngo = await prisma.$transaction(async (tx) => {
        const n = await tx.nGO.create({
            data: {
                name: data.name,
                description: data.description,
                website: data.website,
                phone: data.phone,
                proofUrl: data.proofUrl,
                categories: data.categories,
                userId,
            },
        });

        return n;
    });

    return apiSuccess(
        { ngo, message: "Application submitted! Pending admin review." },
        201,
    );
}
