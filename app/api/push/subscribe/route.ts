import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess, requireAuth, validateBody, parseJsonBody } from "@/lib/api-helpers";

const subscribeSchema = z.object({
  endpoint: z.string().url(),
  p256dh: z.string(),
  auth: z.string(),
});

export async function POST(req: NextRequest) {
  const { session, error } = await requireAuth();
  if (error) return error;

  const body = await parseJsonBody(req);
  const { data, error: ve } = validateBody(subscribeSchema, body);
  if (ve) return ve;

  await prisma.pushSubscription.upsert({
    where: { endpoint: data.endpoint },
    create: {
      userId: session!.user.id,
      endpoint: data.endpoint,
      p256dh: data.p256dh,
      auth: data.auth,
    },
    update: {
      userId: session!.user.id,
      p256dh: data.p256dh,
      auth: data.auth,
    },
  });

  return apiSuccess({ success: true });
}

export async function DELETE(req: NextRequest) {
  const { session, error } = await requireAuth();
  if (error) return error;

  const body = await parseJsonBody(req);
  const endpoint = body?.endpoint;
  if (!endpoint) return apiError("Missing endpoint");

  await prisma.pushSubscription.deleteMany({
    where: { userId: session!.user.id, endpoint },
  });

  return apiSuccess({ success: true });
}
