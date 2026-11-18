import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess, requireAuthUniversal } from "@/lib/api-helpers";

/**
 * GET /api/ngos/issues?type=available|assigned
 *
 * For authenticated NGO users:
 *  - type=available  → VERIFIED issues whose category is in the NGO's allowed list
 *                      and not yet claimed by anyone
 *  - type=assigned   → Issues currently ASSIGNED to this NGO
 */
export async function GET(req: NextRequest) {
    const { userId, error } = await requireAuthUniversal(req);
    if (error) return error;

    // Verify the user is an NGO
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { role: true },
    });
    if (!user || user.role !== "NGO") {
        return apiError("Only NGO users can access this endpoint", 403);
    }

    // Fetch this user's NGO record
    const ngo = await prisma.nGO.findUnique({
        where: { userId },
        select: { id: true, status: true, categories: true },
    });
    if (!ngo || ngo.status !== "APPROVED") {
        return apiError("Your NGO is not approved", 403);
    }

    const type = req.nextUrl.searchParams.get("type") ?? "available";

    if (type === "available") {
        // Open issues in this NGO's allowed categories, not yet assigned
        const issues = await prisma.issue.findMany({
            where: {
                status: { in: ["VERIFIED", "REPORTED"] },
                category: { in: ngo.categories as any[] },
                assignedNGOId: null,
                isFlagged: false,
            },
            select: {
                id: true,
                title: true,
                category: true,
                status: true,
                priority: true,
                address: true,
                lat: true,
                lng: true,
                upvotes: true,
                createdAt: true,
                deadline: true,
                imageUrls: true,
                reporter: {
                    select: { id: true, name: true },
                },
            },
            orderBy: [
                { priority: "desc" },
                { upvotes: "desc" },
                { createdAt: "asc" },
            ],
            take: 50,
        });
        return apiSuccess({
            issues,
            ngoId: ngo.id,
            categories: ngo.categories,
        });
    }

    if (type === "assigned") {
        // Issues currently ASSIGNED to this NGO
        const issues = await prisma.issue.findMany({
            where: {
                assignedNGOId: ngo.id,
                status: "ASSIGNED",
            },
            select: {
                id: true,
                title: true,
                category: true,
                status: true,
                priority: true,
                address: true,
                lat: true,
                lng: true,
                upvotes: true,
                createdAt: true,
                deadline: true,
                imageUrls: true,
                reporter: {
                    select: { id: true, name: true },
                },
            },
            orderBy: [{ deadline: "asc" }, { priority: "desc" }],
            take: 50,
        });
        return apiSuccess({ issues, ngoId: ngo.id });
    }

    return apiError("Invalid type parameter. Use 'available' or 'assigned'");
}
