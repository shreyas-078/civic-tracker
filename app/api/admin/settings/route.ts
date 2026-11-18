import { NextRequest } from "next/server";
import { z } from "zod";
import {
    apiError,
    apiSuccess,
    requireAdmin,
    validateBody,
    parseJsonBody,
} from "@/lib/api-helpers";
import { ModerationSettings } from "@/lib/moderation-settings";

/** GET /api/admin/settings — return current moderation settings */
export async function GET() {
    const { error } = await requireAdmin();
    if (error) return error;

    return apiSuccess({ settings: ModerationSettings.getAll() });
}

const updateSchema = z.object({
    imageModerationEnabled: z.boolean().optional(),
});

/** POST /api/admin/settings — update moderation settings */
export async function POST(req: NextRequest) {
    const { error } = await requireAdmin();
    if (error) return error;

    const body = await parseJsonBody(req);
    const { data, error: ve } = validateBody(updateSchema, body);
    if (ve) return ve;

    if (data.imageModerationEnabled !== undefined) {
        ModerationSettings.setImageModerationEnabled(
            data.imageModerationEnabled,
        );
    }

    return apiSuccess({ settings: ModerationSettings.getAll() });
}
