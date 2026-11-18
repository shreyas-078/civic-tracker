import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess } from "@/lib/api-helpers";

/**
 * Validate a mobile session token and return the user.
 */
export async function GET(req: NextRequest) {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
        return apiError("Missing or invalid Authorization header", 401);
    }

    const token = authHeader.slice(7);

    const session = await prisma.session.findUnique({
        where: { sessionToken: token },
        include: {
            user: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                    image: true,
                    role: true,
                    trustScore: true,
                },
            },
        },
    });

    if (!session || session.expires < new Date()) {
        if (session) {
            await prisma.session.delete({ where: { sessionToken: token } });
        }
        return apiError("Session expired", 401);
    }

    return apiSuccess({ user: session.user });
}
