import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
    apiError,
    apiSuccess,
    requireAuthUniversal,
    validateBody,
    parseJsonBody,
    getAuthSession,
} from "@/lib/api-helpers";
import { rateLimit } from "@/lib/rate-limit";
import { checkProfanity } from "@/lib/ollama";

// ─── GET comments ─────────────────────────────────────────────────────────────

export async function GET(
    req: NextRequest,
    { params }: { params: { id: string } },
) {
    const { searchParams } = req.nextUrl;
    const sort = searchParams.get("sort") ?? "hot";

    const orderBy =
        sort === "new"
            ? [{ createdAt: "desc" as const }]
            : sort === "top"
              ? [{ upvotes: "desc" as const }]
              : [{ upvotes: "desc" as const }, { createdAt: "asc" as const }]; // "hot"

    const comments = await prisma.comment.findMany({
        where: {
            issueId: params.id,
            parentId: null,
            isDeleted: false,
            isFlagged: false,
        },
        include: {
            author: {
                select: { id: true, name: true, image: true, trustScore: true },
            },
            replies: {
                where: { isDeleted: false, isFlagged: false },
                include: {
                    author: {
                        select: {
                            id: true,
                            name: true,
                            image: true,
                            trustScore: true,
                        },
                    },
                },
                orderBy: { createdAt: "asc" },
            },
        },
        orderBy,
    });

    return apiSuccess({ comments });
}

// ─── POST comment ─────────────────────────────────────────────────────────────

const commentSchema = z.object({
    content: z.string().min(1).max(2000),
    parentId: z.string().optional(),
});

export async function POST(
    req: NextRequest,
    { params }: { params: { id: string } },
) {
    const { userId, error } = await requireAuthUniversal(req);
    if (error) return error;

    // Rate limit: 20 comments per hour
    if (!rateLimit(`comments:${userId}`, 20, 60 * 60 * 1000)) {
        return apiError("Too many comments. Try again later.", 429);
    }

    const body = await parseJsonBody(req);
    const { data, error: ve } = validateBody(commentSchema, body);
    if (ve) return ve;

    const issue = await prisma.issue.findUnique({
        where: { id: params.id },
        select: { id: true, reporterId: true },
    });
    if (!issue) return apiError("Issue not found", 404);

    // Profanity check
    const textCheck = checkProfanity(data.content);
    if (!textCheck.passed) {
        return apiError(textCheck.reason ?? "Comment contains inappropriate language.", 400);
    }

    // Validate parent comment exists
    if (data.parentId) {
        const parent = await prisma.comment.findUnique({
            where: { id: data.parentId },
        });
        if (!parent || parent.parentId) {
            return apiError("Invalid parent comment (max 1 level of nesting)");
        }
    }

    const comment = await prisma.comment.create({
        data: {
            content: data.content,
            issueId: params.id,
            authorId: userId,
            parentId: data.parentId ?? null,
        },
        include: {
            author: {
                select: { id: true, name: true, image: true, trustScore: true },
            },
        },
    });

    // Notify issue reporter of comment (if not self)
    if (issue.reporterId !== userId) {
        await prisma.notification.create({
            data: {
                userId: issue.reporterId,
                issueId: params.id,
                type: "COMMENT_REPLY",
                title: "New comment on your issue",
                body: data.content.slice(0, 100),
                actionUrl: `/issues/${params.id}`,
            },
        });
    }

    return apiSuccess({ comment }, 201);
}
