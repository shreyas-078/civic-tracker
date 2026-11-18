import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess, optionalAuthUniversal } from "@/lib/api-helpers";

export async function GET(
    req: NextRequest,
    { params }: { params: { id: string } },
) {
    const { id } = params;

    // Support both web (cookie) and mobile (Bearer token) auth — anonymous OK
    const { userId } = await optionalAuthUniversal(req);

    const issue = await prisma.issue.findUnique({
        where: { id },
        include: {
            reporter: {
                select: {
                    id: true,
                    name: true,
                    image: true,
                    trustScore: true,
                    role: true,
                },
            },
            assignedNGO: {
                select: { id: true, name: true },
            },
            _count: {
                select: { comments: true, votes: true },
            },
        },
    });

    if (!issue) return apiError("Issue not found", 404);

    // Increment view count (fire-and-forget)
    prisma.issue
        .update({
            where: { id },
            data: { viewCount: { increment: 1 } },
        })
        .catch(() => {});

    // Check if current user has voted (upvote)
    let userVote: number | null = null;
    let userResolutionVote: string | null = null;
    if (userId) {
        const vote = await prisma.vote.findUnique({
            where: { userId_issueId: { userId, issueId: id } },
        });
        userVote = vote?.value ?? null;

        // Check if user already cast a resolution verification vote
        const rv = await prisma.resolutionVote.findUnique({
            where: { userId_issueId: { userId, issueId: id } },
        });
        userResolutionVote = rv?.vote ?? null;
    }

    return apiSuccess({ issue, userVote, userResolutionVote });
}
