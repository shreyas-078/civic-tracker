import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
    apiError,
    apiSuccess,
    requireAdmin,
    validateBody,
    parseJsonBody,
} from "@/lib/api-helpers";
import { createNotification } from "@/lib/notifications";

const approveSchema = z.object({
    action: z.enum(["APPROVE", "REJECT", "BLACKLIST"]),
    reason: z.string().max(500).optional(),
});

export async function PATCH(
    req: NextRequest,
    { params }: { params: { id: string } },
) {
    const { error } = await requireAdmin(req);
    if (error) return error;

    const body = await parseJsonBody(req);
    const { data, error: ve } = validateBody(approveSchema, body);
    if (ve) return ve;

    const ngo = await prisma.nGO.findUnique({
        where: { id: params.id },
        select: { id: true, userId: true, name: true },
    });
    if (!ngo) return apiError("NGO not found", 404);

    if (data.action === "APPROVE") {
        await prisma.nGO.update({
            where: { id: params.id },
            data: { status: "APPROVED", approvedAt: new Date() },
        });

        await prisma.user.update({
            where: { id: ngo.userId },
            data: { role: "NGO" },
        });

        await createNotification({
            userId: ngo.userId,
            type: "NGO_APPLICATION_UPDATE",
            title: "NGO Application Approved!",
            body: `Your NGO "${ngo.name}" has been approved. You can now claim and resolve civic issues.`,
            actionUrl: "/ngos",
        });
    } else if (data.action === "REJECT") {
        await prisma.nGO.delete({ where: { id: params.id } });

        await createNotification({
            userId: ngo.userId,
            type: "NGO_APPLICATION_UPDATE",
            title: "NGO Application Update",
            body: `Your NGO application was not approved. ${data.reason ?? "Please contact support for more information."}`,
        });
    } else if (data.action === "BLACKLIST") {
        await prisma.nGO.update({
            where: { id: params.id },
            data: { status: "BLACKLISTED", blacklistNote: data.reason },
        });

        await createNotification({
            userId: ngo.userId,
            type: "NGO_APPLICATION_UPDATE",
            title: "NGO Account Suspended",
            body: `Your NGO "${ngo.name}" has been suspended. ${data.reason ?? ""}`,
        });
    }

    return apiSuccess({ success: true, action: data.action });
}
