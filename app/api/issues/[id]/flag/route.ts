import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess, requireAuth, validateBody, parseJsonBody } from "@/lib/api-helpers";
import { adjustTrustAndCheckBadges, TRUST_DELTA } from "@/lib/trust";

const flagSchema = z.object({
  reason: z.string().max(200).optional(),
  commentId: z.string().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { session, error } = await requireAuth();
  if (error) return error;

  const body = await parseJsonBody(req);
  const { data, error: ve } = validateBody(flagSchema, body);
  if (ve) return ve;

  const userId = session!.user.id;
  const issueId = params.id;

  if (data.commentId) {
    // Flag a comment
    try {
      await prisma.flag.create({
        data: { userId, commentId: data.commentId, reason: data.reason },
      });
    } catch {
      return apiError("Already flagged this comment");
    }

    const updated = await prisma.comment.update({
      where: { id: data.commentId },
      data: { flagCount: { increment: 1 } },
    });

    if (updated.flagCount >= 3) {
      await prisma.comment.update({
        where: { id: data.commentId },
        data: { isFlagged: true },
      });
    }

    return apiSuccess({ flagged: true, flagCount: updated.flagCount });
  } else {
    // Flag an issue
    const issue = await prisma.issue.findUnique({
      where: { id: issueId },
      select: { reporterId: true },
    });
    if (!issue) return apiError("Issue not found", 404);

    try {
      await prisma.flag.create({ data: { userId, issueId, reason: data.reason } });
    } catch {
      return apiError("Already flagged this issue");
    }

    const updated = await prisma.issue.update({
      where: { id: issueId },
      data: { flagCount: { increment: 1 } },
    });

    if (updated.flagCount >= 3) {
      await prisma.issue.update({ where: { id: issueId }, data: { isFlagged: true } });
      await adjustTrustAndCheckBadges(issue.reporterId, TRUST_DELTA.SPAM_FLAGGED);
    }

    return apiSuccess({ flagged: true, flagCount: updated.flagCount });
  }
}
