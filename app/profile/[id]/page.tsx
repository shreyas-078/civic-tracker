import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { MapPin, Shield, Star, CheckCircle, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const BADGE_INFO: Record<
    string,
    { label: string; emoji: string; description: string }
> = {
    FIRST_REPORT: {
        label: "First Reporter",
        emoji: "🥇",
        description: "First to report an issue in an area",
    },
    TEN_REPORTS: {
        label: "Active Reporter",
        emoji: "📊",
        description: "Submitted 10+ verified reports",
    },
    FIFTY_REPORTS: {
        label: "Champion",
        emoji: "🌟",
        description: "Submitted 50+ verified reports",
    },
    COMMUNITY_HERO: {
        label: "Community Hero",
        emoji: "🦸",
        description: "Trust score above 80",
    },
    FAST_RESOLVER: {
        label: "Fast Resolver",
        emoji: "⚡",
        description: "Resolves issues in under 3 days",
    },
    TOP_NGO: {
        label: "Top NGO",
        emoji: "🏆",
        description: "Resolved 50+ issues",
    },
    NGO_PARTNER: {
        label: "NGO Partner",
        emoji: "🤝",
        description: "Verified NGO",
    },
};

const STATUS_COLOR: Record<string, string> = {
    REPORTED: "text-amber-400",
    VERIFIED: "text-blue-400",
    ASSIGNED: "text-purple-400",
    RESOLVED: "text-emerald-400",
};

export default async function ProfilePage({
    params,
}: {
    params: { id: string };
}) {
    const session = await auth();

    const user = await prisma.user.findUnique({
        where: { id: params.id },
        include: {
            badges: true,
            ngo: {
                select: {
                    id: true,
                    name: true,
                    status: true,
                    resolvedCount: true,
                },
            },
            issues: {
                where: {
                    isPersonal: false,
                    isFlagged: false,
                    status: { not: "CLOSED" },
                },
                select: {
                    id: true,
                    title: true,
                    category: true,
                    status: true,
                    upvotes: true,
                    createdAt: true,
                    lat: true,
                    lng: true,
                },
                orderBy: { createdAt: "desc" },
                take: 10,
            },
        },
    });

    if (!user) notFound();

    const isOwnProfile = session?.user?.id === user.id;
    const isNGO = user.role === "NGO" && user.ngo?.status === "APPROVED";

    const CATEGORY_EMOJI: Record<string, string> = {
        ROAD: "🛣️",
        WATER: "💧",
        ELECTRICITY: "⚡",
        SANITATION: "🗑️",
        PUBLIC_SPACE: "🏙️",
        ENVIRONMENT: "🌱",
        LOST_FOUND: "🔍",
        OTHER: "📌",
    };

    return (
        <div className="min-h-screen max-w-lg mx-auto px-4 py-6">
            {/* Profile card */}
            <div className="glass rounded-2xl p-4 mb-6">
                <div className="flex items-start gap-4">
                    <Avatar className="h-16 w-16 ring-2 ring-white/10">
                        <AvatarImage src={user.image ?? undefined} />
                        <AvatarFallback className="text-xl bg-primary/20 text-primary">
                            {user.name?.[0] ?? "U"}
                        </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                        <h1 className="text-xl font-bold tracking-tight truncate">
                            {user.name ?? "Anonymous"}
                        </h1>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span className="text-xs glass-subtle px-2 py-0.5 rounded-full">
                                {user.role}
                            </span>
                            {isNGO && (
                                <span className="text-xs bg-purple-500/15 text-purple-400 border border-purple-500/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                                    <Shield className="h-3 w-3" /> Verified NGO
                                </span>
                            )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Member since{" "}
                            {formatDistanceToNow(user.createdAt, {
                                addSuffix: true,
                            })}
                        </p>
                    </div>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3 mb-6">
                <Card>
                    <CardContent className="p-3 text-center">
                        <p className="text-2xl font-bold">
                            {user.totalReports}
                        </p>
                        <p className="text-xs text-muted-foreground">Reports</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-3 text-center">
                        <p className="text-2xl font-bold">{user.trustScore}</p>
                        <p className="text-xs text-muted-foreground">
                            Trust Score
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-3 text-center">
                        <p className="text-2xl font-bold">
                            {isNGO
                                ? user.ngo?.resolvedCount
                                : user.resolvedCount}
                        </p>
                        <p className="text-xs text-muted-foreground">
                            {isNGO ? "Resolved" : "Verified"}
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Badges */}
            {user.badges.length > 0 && (
                <>
                    <h2 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
                        <Star className="h-4 w-4 text-amber-400" /> Badges
                    </h2>
                    <div className="flex gap-2 flex-wrap mb-6">
                        {user.badges.map((badge) => {
                            const info = BADGE_INFO[badge.type] ?? {
                                label: badge.type,
                                emoji: "🎖️",
                                description: "",
                            };
                            return (
                                <div
                                    key={badge.type}
                                    className="flex flex-col items-center gap-1 glass px-3 py-2 rounded-xl text-center hover:bg-white/[0.05] transition-colors"
                                    title={info.description}
                                >
                                    <span className="text-2xl">
                                        {info.emoji}
                                    </span>
                                    <span className="text-xs font-medium leading-tight">
                                        {info.label}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </>
            )}

            <Separator className="mb-4 bg-white/[0.06]" />

            {/* NGO: show resolved issues only */}
            {isNGO ? (
                <div>
                    <h2 className="text-sm font-semibold mb-1 flex items-center gap-1.5">
                        <CheckCircle className="h-4 w-4 text-emerald-400" />
                        {user.ngo?.name} — Resolved Issues
                    </h2>
                    <p className="text-xs text-muted-foreground mb-3">
                        {user.ngo?.resolvedCount} issues resolved
                    </p>
                </div>
            ) : (
                <div>
                    <h2 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
                        <MapPin className="h-4 w-4" /> Recent Reports
                    </h2>
                    {user.issues.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                            No reports yet.
                        </p>
                    ) : (
                        <div className="space-y-2">
                            {user.issues.map((issue) => (
                                <Link
                                    key={issue.id}
                                    href={`/issues/${issue.id}`}
                                    className="flex items-center gap-3 p-3 rounded-xl glass hover:bg-white/[0.05] transition-all duration-200"
                                >
                                    <span className="text-lg">
                                        {CATEGORY_EMOJI[issue.category]}
                                    </span>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium truncate">
                                            {issue.title}
                                        </p>
                                        <p
                                            className={`text-xs ${STATUS_COLOR[issue.status] ?? "text-muted-foreground"}`}
                                        >
                                            {issue.status.charAt(0) +
                                                issue.status
                                                    .slice(1)
                                                    .toLowerCase()}{" "}
                                            · {issue.upvotes} upvotes ·{" "}
                                            {formatDistanceToNow(
                                                issue.createdAt,
                                                { addSuffix: true },
                                            )}
                                        </p>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
