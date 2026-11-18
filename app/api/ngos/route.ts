import { prisma } from "@/lib/prisma";
import { apiSuccess } from "@/lib/api-helpers";

/** GET /api/ngos — Public list of approved NGOs */
export async function GET() {
    const ngos = await prisma.nGO.findMany({
        where: { status: "APPROVED" },
        include: {
            user: { select: { id: true, name: true, image: true } },
        },
        orderBy: { resolvedCount: "desc" },
    });

    return apiSuccess({ ngos });
}
