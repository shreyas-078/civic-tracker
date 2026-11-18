import { prisma } from "@/lib/prisma";
import { BadgeType } from "@prisma/client";

// ─── Trust score deltas ───────────────────────────────────────────────────────

export const TRUST_DELTA = {
    // Reporter gains
    REPORT_VERIFIED: 5, // issue verified by community upvotes
    DUPLICATE_REPORT: 2, // credit for spotting a known issue
    AI_FALSE_FLAG_RESTORED: 3, // admin cleared a false AI/community flag

    // Upvote feedback
    UPVOTE_RECEIVED: 1, // per upvote on reporter's issue (was 2)

    // Penalties on reporter
    FALSE_REPORT: -10, // confirmed spam/false issue
    SPAM_FLAGGED: -3, // issue reaches 3+ community flags (was -5)

    // Resolution vote outcomes — applied to the RESOLVER (NGO/admin)
    RESOLUTION_CONFIRMED_RESOLVER: 6, // community confirms resolution as genuine
    FALSE_RESOLUTION_CLAIM: -12, // community rejects resolution claim

    // Bonus for fast resolution by NGO/resolver
    NGO_FAST_RESOLUTION: 4, // resolved within 48 hours of creation

    // NGO deadline-based trust adjustments
    NGO_DEADLINE_MET: 8, // NGO resolved before their deadline
    NGO_DEADLINE_MISSED: -15, // NGO failed to resolve before deadline

    // Community voter reward (voting in the majority)
    CORRECT_RESOLUTION_VOTE: 2, // was 3
} as const;

// ─── Blacklist threshold ─────────────────────────────────────────────────────

export const BLACKLIST_THRESHOLD = 10;

// ─── Trust mutation (transactional) ──────────────────────────────────────────

export async function adjustTrustScore(userId: string, delta: number) {
    return prisma.$transaction([
        prisma.user.update({
            where: { id: userId },
            data: {
                trustScore: {
                    increment: delta,
                },
            },
        }),
    ]);
}

/** Adjust trust + check badge eligibility + auto-blacklist if below threshold */
export async function adjustTrustAndCheckBadges(userId: string, delta: number) {
    const [updatedUser] = await prisma.$transaction([
        prisma.user.update({
            where: { id: userId },
            data: { trustScore: { increment: delta } },
        }),
    ]);

    // Check and award badges
    await checkAndAwardBadges(
        userId,
        updatedUser.trustScore,
        updatedUser.totalReports,
    );

    // Auto-blacklist if trust score drops below threshold
    if (
        updatedUser.trustScore <= BLACKLIST_THRESHOLD &&
        !updatedUser.isBlacklisted
    ) {
        await blacklistUser(userId);
    }

    return updatedUser;
}

// ─── Blacklist a user (and their NGO if applicable) ──────────────────────────

export async function blacklistUser(userId: string) {
    await prisma.user.update({
        where: { id: userId },
        data: { isBlacklisted: true },
    });

    // Also blacklist their NGO if they have one
    const ngo = await prisma.nGO.findUnique({
        where: { userId },
        select: { id: true, status: true },
    });
    if (ngo && ngo.status !== "BLACKLISTED") {
        await prisma.nGO.update({
            where: { id: ngo.id },
            data: {
                status: "BLACKLISTED",
                blacklistNote: `Auto-blacklisted: trust score dropped below ${BLACKLIST_THRESHOLD}`,
            },
        });
    }
}

// ─── Leaderboard upsert ───────────────────────────────────────────────────────

export async function updateLeaderboard(userId: string, scoreIncrease: number) {
    return prisma.leaderboard.upsert({
        where: { userId },
        create: {
            userId,
            score: Math.max(0, scoreIncrease),
            weeklyScore: Math.max(0, scoreIncrease),
            monthlyScore: Math.max(0, scoreIncrease),
        },
        update: {
            score: { increment: scoreIncrease },
            weeklyScore: { increment: scoreIncrease },
            monthlyScore: { increment: scoreIncrease },
        },
    });
}

// ─── Badge checks ─────────────────────────────────────────────────────────────

export async function checkAndAwardBadges(
    userId: string,
    trustScore: number,
    totalReports: number,
) {
    const badgesToCheck: Array<{ type: BadgeType; condition: boolean }> = [
        { type: "TEN_REPORTS", condition: totalReports >= 10 },
        { type: "FIFTY_REPORTS", condition: totalReports >= 50 },
        { type: "COMMUNITY_HERO", condition: trustScore >= 80 },
    ];

    const existingBadges = await prisma.badge.findMany({
        where: { userId },
        select: { type: true },
    });
    const ownedTypes = new Set(existingBadges.map((b) => b.type));

    const newBadges = badgesToCheck.filter(
        (b) => b.condition && !ownedTypes.has(b.type),
    );

    if (newBadges.length > 0) {
        await prisma.badge.createMany({
            data: newBadges.map((b) => ({ userId, type: b.type })),
            skipDuplicates: true,
        });
    }

    return newBadges.map((b) => b.type);
}

export async function awardBadge(userId: string, type: BadgeType) {
    try {
        return await prisma.badge.create({ data: { userId, type } });
    } catch {
        // Silently skip if already awarded (unique constraint)
        return null;
    }
}

// ─── NGO badge check ──────────────────────────────────────────────────────────

export async function checkNGOBadges(ngoId: string) {
    const ngo = await prisma.nGO.findUnique({
        where: { id: ngoId },
        include: {
            issues: {
                where: { status: "RESOLVED" },
                select: { resolvedAt: true, createdAt: true },
            },
        },
    });

    if (!ngo) return;

    const resolvedCount = ngo.issues.length;

    if (resolvedCount >= 50) {
        await awardBadge(ngo.userId, "TOP_NGO");
    }

    // Fast resolver: avg resolution < 3 days
    if (resolvedCount >= 5) {
        const resolutionTimes = ngo.issues
            .filter((i) => i.resolvedAt)
            .map((i) => {
                const ms = i.resolvedAt!.getTime() - i.createdAt.getTime();
                return ms / (1000 * 60 * 60 * 24);
            });

        if (resolutionTimes.length > 0) {
            const avg =
                resolutionTimes.reduce((a, b) => a + b, 0) /
                resolutionTimes.length;
            if (avg < 3) {
                await awardBadge(ngo.userId, "FAST_RESOLVER");
            }
        }
    }
}
