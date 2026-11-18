import { NextRequest } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import * as crypto from "crypto";
import { prisma } from "@/lib/prisma";
import {
    apiError,
    apiSuccess,
    parseJsonBody,
    validateBody,
} from "@/lib/api-helpers";

const signupSchema = z.object({
    name: z.string().min(2, "Name must be at least 2 characters").max(100),
    email: z.string().email("Invalid email address"),
    password: z
        .string()
        .min(8, "Password must be at least 8 characters")
        .max(128),
});

export async function POST(req: NextRequest) {
    const body = await parseJsonBody(req);
    if (!body) return apiError("Invalid JSON body");

    const { data, error } = validateBody(signupSchema, body);
    if (error) return error;

    const existing = await prisma.user.findUnique({
        where: { email: data.email },
        select: { id: true },
    });

    if (existing) {
        return apiError("An account with this email already exists", 409);
    }

    const hashedPassword = await bcrypt.hash(data.password, 12);

    const user = await prisma.user.create({
        data: {
            name: data.name,
            email: data.email,
            password: hashedPassword,
        },
    });

    // Check if request is from mobile (accepts token-based auth)
    const isMobile = req.headers.get("x-client") === "mobile";

    if (isMobile) {
        const token = crypto.randomBytes(32).toString("hex");
        const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        await prisma.session.create({
            data: { sessionToken: token, userId: user.id, expires },
        });
        return apiSuccess(
            {
                token,
                user: {
                    id: user.id,
                    name: data.name,
                    email: data.email,
                    image: null,
                    role: "CITIZEN",
                    trustScore: 50,
                },
            },
            201,
        );
    }

    return apiSuccess({ id: user.id }, 201);
}
