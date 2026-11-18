import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiSuccess, requireAdmin } from "@/lib/api-helpers";
import { adjustTrustAndCheckBadges, TRUST_DELTA } from "@/lib/trust";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { error } = await requireAdmin(req);
  if (error) return error;

  // Fetch before update to check if it was actually flagged
  const issue = await prisma.issue.findUnique({
    where: { id: params.id },
    select: { reporterId: true, isFlagged: true },
  });

  // Unflag
  await prisma.issue.update({
    where: { id: params.id },
    data: { isFlagged: false, flagCount: 0 },
  });

  // Restore trust to reporter — their issue was flagged in error (AI or community false positive)
  if (issue?.isFlagged) {
    await adjustTrustAndCheckBadges(
      issue.reporterId,
      TRUST_DELTA.AI_FALSE_FLAG_RESTORED,
    );
  }

  return apiSuccess({ success: true });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { error } = await requireAdmin(req);
  if (error) return error;

  // Close (soft delete)
  await prisma.issue.update({
    where: { id: params.id },
    data: { status: "CLOSED" },
  });

  return apiSuccess({ success: true });
}
