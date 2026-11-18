export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Building2,
    CheckCircle,
    Phone,
    Globe,
    Sparkles,
    Plus,
} from "lucide-react";

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

export default async function NGOsPage() {
    const session = await auth();
    const userRole = (session?.user as any)?.role;

    const ngos = await prisma.nGO.findMany({
        where: { status: "APPROVED" },
        include: {
            user: {
                select: {
                    id: true,
                    name: true,
                    image: true,
                    badges: { select: { type: true } },
                },
            },
        },
        orderBy: { resolvedCount: "desc" },
    });

    return (
        <div className="min-h-screen max-w-2xl mx-auto px-4 py-6">
            <div className="mb-6">
                <div className="flex items-center gap-2.5">
                    <div className="relative">
                        <div className="absolute inset-0 bg-purple-500/20 rounded-xl blur-lg" />
                        <Building2 className="h-6 w-6 text-purple-400 relative" />
                    </div>
                    <h1 className="text-2xl font-bold tracking-tight">
                        NGO Directory
                    </h1>
                </div>
                <p className="text-sm text-muted-foreground mt-1.5">
                    Verified organizations working to resolve civic issues in
                    your city.
                </p>
                {session && userRole === "CITIZEN" && (
                    <Button
                        size="sm"
                        className="mt-3 gap-1.5"
                        render={<Link href="/ngos/apply" />}
                    >
                        <Plus className="h-3.5 w-3.5" /> Register as NGO
                    </Button>
                )}
            </div>

            {ngos.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground">
                    <div className="glass rounded-2xl p-6 inline-block mb-4">
                        <Building2 className="h-12 w-12 mx-auto opacity-30" />
                    </div>
                    <p>No approved NGOs yet.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {ngos.map((ngo) => (
                        <div
                            key={ngo.id}
                            className="glass rounded-2xl p-4 space-y-3 hover:bg-white/[0.05] transition-all duration-300 group"
                        >
                            {/* Header */}
                            <div className="flex items-start gap-3">
                                <div className="h-10 w-10 rounded-xl bg-purple-500/15 border border-purple-500/20 flex items-center justify-center shrink-0 group-hover:bg-purple-500/20 transition-colors">
                                    <Building2 className="h-5 w-5 text-purple-400" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <h2 className="font-semibold tracking-tight">
                                            {ngo.name}
                                        </h2>
                                        <span className="flex items-center gap-1 text-xs bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                                            <CheckCircle className="h-3 w-3" />{" "}
                                            Verified
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground flex-wrap">
                                        <span className="flex items-center gap-1">
                                            <CheckCircle className="h-3 w-3 text-emerald-400" />
                                            {ngo.resolvedCount} resolved
                                        </span>
                                        {ngo.phone && (
                                            <span className="flex items-center gap-1">
                                                <Phone className="h-3 w-3" />{" "}
                                                {ngo.phone}
                                            </span>
                                        )}
                                        {ngo.website && (
                                            <a
                                                href={ngo.website}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-center gap-1 hover:text-primary transition-colors"
                                            >
                                                <Globe className="h-3 w-3" />{" "}
                                                Website
                                            </a>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Description */}
                            <p className="text-sm text-muted-foreground line-clamp-2">
                                {ngo.description}
                            </p>

                            {/* Categories */}
                            <div className="flex gap-1.5 flex-wrap">
                                {ngo.categories.map((cat) => (
                                    <span
                                        key={cat}
                                        className="text-xs glass-subtle px-2 py-0.5 rounded-full"
                                    >
                                        {CATEGORY_EMOJI[cat]}{" "}
                                        {cat.replace("_", " ")}
                                    </span>
                                ))}
                            </div>

                            {/* Badges */}
                            {ngo.user.badges.length > 0 && (
                                <div className="flex gap-1.5 flex-wrap">
                                    {ngo.user.badges.map((b) => (
                                        <span
                                            key={b.type}
                                            className="text-xs bg-amber-500/10 text-amber-400 border border-amber-500/15 px-2 py-0.5 rounded-full"
                                        >
                                            {b.type === "FAST_RESOLVER"
                                                ? "⚡ Fast Resolver"
                                                : b.type === "TOP_NGO"
                                                  ? "🏆 Top NGO"
                                                  : b.type}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
