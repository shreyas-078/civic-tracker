"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSession } from "next-auth/react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
    ChevronUp,
    ArrowRight,
    MapPin,
    Clock,
    AlertTriangle,
    X,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import type { IssueCardData } from "@/types";
import { cn } from "@/lib/utils";

const STATUS_LABEL: Record<string, { label: string; className: string }> = {
    REPORTED: {
        label: "Reported",
        className: "bg-amber-500/15 text-amber-400 border border-amber-500/20",
    },
    VERIFIED: {
        label: "Verified",
        className: "bg-blue-500/15 text-blue-400 border border-blue-500/20",
    },
    ASSIGNED: {
        label: "Assigned",
        className:
            "bg-purple-500/15 text-purple-400 border border-purple-500/20",
    },
    RESOLVED: {
        label: "Resolved",
        className:
            "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20",
    },
    CLOSED: {
        label: "Closed",
        className:
            "bg-white/[0.05] text-muted-foreground border border-white/[0.08]",
    },
};

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

interface Props {
    issueId: string;
    onClose: () => void;
}

export function IssueDrawer({ issueId, onClose }: Props) {
    const { data: session } = useSession();
    const [issue, setIssue] = useState<IssueCardData | null>(null);
    const [loading, setLoading] = useState(true);
    const [voting, setVoting] = useState(false);
    const [userVote, setUserVote] = useState<number | null>(null);

    useEffect(() => {
        setLoading(true);
        fetch(`/api/issues/${issueId}`)
            .then((r) => r.json())
            .then((data) => {
                setIssue(data.issue);
                setUserVote(data.userVote ?? null);
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [issueId]);

    async function handleVote() {
        if (!session) {
            toast.error("Sign in to vote");
            return;
        }
        setVoting(true);
        try {
            const res = await fetch(`/api/issues/${issueId}/vote`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ value: userVote === 1 ? 0 : 1 }),
            });
            if (!res.ok) throw new Error();
            const data = await res.json();
            setIssue((prev) =>
                prev ? { ...prev, upvotes: data.upvotes } : prev,
            );
            setUserVote(data.userVote);
            toast.success(data.userVote === 1 ? "Upvoted!" : "Vote removed");
        } catch {
            toast.error("Failed to vote");
        } finally {
            setVoting(false);
        }
    }

    const statusInfo = issue ? STATUS_LABEL[issue.status] : null;

    return (
        <Sheet open onOpenChange={(open) => !open && onClose()}>
            <SheetContent
                side="right"
                className="w-[400px] max-w-[85vw] h-full overflow-y-auto p-5"
                showCloseButton={false}
            >
                {/* Close button */}
                <button
                    onClick={onClose}
                    className="absolute top-3 right-3 p-1 rounded-full hover:bg-white/[0.08] z-10 transition-colors"
                >
                    <X className="h-4 w-4" />
                </button>

                {loading ? (
                    <div className="space-y-3 pt-2">
                        <Skeleton className="h-5 w-3/4" />
                        <Skeleton className="h-4 w-1/2" />
                        <Skeleton className="h-24 w-full rounded-lg" />
                        <Skeleton className="h-4 w-2/3" />
                    </div>
                ) : issue ? (
                    <div className="pt-2 pb-6">
                        {/* Status + category */}
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <span
                                className={cn(
                                    "text-xs font-medium px-2 py-0.5 rounded-full",
                                    statusInfo?.className,
                                )}
                            >
                                {statusInfo?.label}
                            </span>
                            <span className="text-xs text-muted-foreground">
                                {CATEGORY_EMOJI[issue.category]}{" "}
                                {issue.category.replace("_", " ")}
                            </span>
                            {issue.priority >= 8 && (
                                <span className="flex items-center gap-1 text-xs text-red-600 font-medium">
                                    <AlertTriangle className="h-3 w-3" />
                                    High Priority
                                </span>
                            )}
                        </div>

                        {/* Title */}
                        <h2 className="text-lg font-semibold leading-snug mb-1">
                            {issue.title}
                        </h2>

                        {/* Location + time */}
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
                            {issue.address && (
                                <span className="flex items-center gap-1">
                                    <MapPin className="h-3 w-3" />
                                    {issue.address}
                                </span>
                            )}
                            <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {formatDistanceToNow(
                                    new Date(issue.createdAt),
                                    { addSuffix: true },
                                )}
                            </span>
                        </div>

                        {/* Description */}
                        <p className="text-sm text-muted-foreground mb-3 line-clamp-3">
                            {issue.description}
                        </p>

                        {/* Images */}
                        {issue.imageUrls.length > 0 && (
                            <div className="flex gap-2 overflow-x-auto mb-3 pb-1">
                                {issue.imageUrls.slice(0, 3).map((url, i) => (
                                    <div
                                        key={i}
                                        className="flex-shrink-0 relative h-20 w-20 rounded-lg overflow-hidden"
                                    >
                                        <Image
                                            src={url}
                                            alt={`Issue photo ${i + 1}`}
                                            fill
                                            className="object-cover"
                                        />
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Reporter */}
                        <div className="flex items-center gap-2 mb-4">
                            <Avatar className="h-6 w-6">
                                <AvatarImage
                                    src={issue.reporter.image ?? undefined}
                                />
                                <AvatarFallback className="text-xs">
                                    {issue.reporter.name?.[0] ?? "U"}
                                </AvatarFallback>
                            </Avatar>
                            <span className="text-xs text-muted-foreground">
                                Reported by{" "}
                                <Link
                                    href={`/profile/${issue.reporterId}`}
                                    className="hover:underline text-foreground"
                                >
                                    {issue.reporter.name ?? "Anonymous"}
                                </Link>{" "}
                                · Trust {issue.reporter.trustScore}
                            </span>
                        </div>

                        {/* NGO assigned */}
                        {issue.ngo && (
                            <div className="glass rounded-xl px-3 py-2 mb-3 text-xs text-purple-400 border border-purple-500/20">
                                Claimed by <strong>{issue.ngo.name}</strong>
                            </div>
                        )}

                        {/* Personal bounty */}
                        {issue.isPersonal && issue.bounty && (
                            <div className="glass rounded-xl px-3 py-2 mb-3 text-xs text-amber-400 border border-amber-500/20">
                                💰 Bounty: <strong>₹{issue.bounty}</strong>
                            </div>
                        )}

                        {/* Actions */}
                        <div className="flex items-center gap-2">
                            <Button
                                variant={userVote === 1 ? "default" : "outline"}
                                size="sm"
                                className="gap-1.5"
                                onClick={handleVote}
                                disabled={voting}
                            >
                                <ChevronUp className="h-4 w-4" />
                                {issue.upvotes}
                            </Button>

                            <Button
                                variant="secondary"
                                size="sm"
                                className="gap-1.5 flex-1"
                                render={<Link href={`/issues/${issueId}`} />}
                            >
                                View full details
                                <ArrowRight className="h-3 w-3" />
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div className="pt-4 text-center text-muted-foreground text-sm">
                        Issue not found.
                    </div>
                )}
            </SheetContent>
        </Sheet>
    );
}
