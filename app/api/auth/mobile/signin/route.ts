import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess } from "@/lib/api-helpers";
import * as bcrypt from "bcryptjs";
import * as crypto from "crypto";

const signinSchema = z.object({
    email: z.string().email(),
    password: z.string().min(1),
});

/**
 * Mobile sign-in endpoint.
 * Returns a bearer token for subsequent API calls.
 */
export async function POST(req: NextRequest) {
    let body;
    try {
        body = await req.json();
    } catch {
        return apiError("Invalid JSON body");
    }

    const parsed = signinSchema.safeParse(body);
    if (!parsed.success) {
        return apiError(parsed.error.issues[0]?.message ?? "Validation error");
    }

    const { email, password } = parsed.data;

    const user = await prisma.user.findUnique({
        where: { email },
        select: {
            id: true,
            name: true,
            email: true,
            image: true,
            password: true,
            role: true,
            trustScore: true,
        },
    });

    if (!user || !user.password) {
        return apiError("Invalid email or password", 401);
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
        return apiError("Invalid email or password", 401);
    }

    // Generate a simple session token
    const token = crypto.randomBytes(32).toString("hex");

    // Store as a session in the database
    const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
    await prisma.session.create({
        data: {
            sessionToken: token,
            userId: user.id,
            expires,
        },
    });

    return apiSuccess({
        token,
        user: {
            id: user.id,
            name: user.name,
            email: user.email,
            image: user.image,
            role: user.role,
            trustScore: user.trustScore,
        },
    });
}
