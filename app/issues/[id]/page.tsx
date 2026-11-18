import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
    ArrowLeft,
    MapPin,
    Clock,
    AlertTriangle,
    Sparkles,
    Eye,
    MessageCircle,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { LifecycleTimeline } from "@/components/Issue/LifecycleTimeline";
import { CommentThread } from "@/components/Issue/CommentThread";
import { VoteButton } from "@/components/Issue/VoteButton";
import { ResolutionProof } from "@/components/Issue/ResolutionProof";
import { FlagButton } from "@/components/Issue/FlagButton";

const STATUS_BADGE: Record<string, string> = {
    REPORTED: "bg-amber-500/15 text-amber-400 border-amber-500/20",
    VERIFIED: "bg-blue-500/15 text-blue-400 border-blue-500/20",
    ASSIGNED: "bg-purple-500/15 text-purple-400 border-purple-500/20",
    RESOLVED: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
    CLOSED: "bg-white/[0.06] text-muted-foreground border-white/[0.08]",
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

export default async function IssueDetailPage({
    params,
}: {
    params: { id: string };
}) {
    const session = await auth();

    const issue = await prisma.issue.findUnique({
        where: { id: params.id },
        include: {
            reporter: {
                select: {
                    id: true,
                    name: true,
                    image: true,
                    trustScore: true,
                    role: true,
                },
            },
            assignedNGO: {
                select: { id: true, name: true, userId: true },
            },
            _count: { select: { comments: true, votes: true } },
        },
    });

    if (!issue) notFound();

    // Increment view count
    await prisma.issue.update({
        where: { id: params.id },
        data: { viewCount: { increment: 1 } },
    });

    // Get user vote if logged in
    let userVote: number | null = null;
    let userResolutionVote: string | null = null;
    if (session?.user?.id) {
        const vote = await prisma.vote.findUnique({
            where: {
                userId_issueId: { userId: session.user.id, issueId: params.id },
            },
        });
        userVote = vote?.value ?? null;

        const rv = await prisma.resolutionVote.findUnique({
            where: {
                userId_issueId: { userId: session.user.id, issueId: params.id },
            },
        });
        userResolutionVote = rv?.vote ?? null;
    }

    const aiAnalysis = issue.aiAnalysis as any;

    return (
        <div className="min-h-screen">
            {/* Header */}
            <div className="sticky top-0 z-10 glass-strong border-b border-white/[0.06] px-4 py-3 flex items-center gap-3">
                <Button
                    variant="ghost"
                    size="icon"
                    render={<Link href="/map" />}
                    className="rounded-xl"
                >
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <div className="flex-1 min-w-0">
                    <h1 className="text-sm font-semibold truncate tracking-tight">
                        {issue.title}
                    </h1>
                </div>
                <FlagButton issueId={issue.id} />
            </div>

            <div className="max-w-2xl mx-auto">
                {/* Images */}
                {issue.imageUrls.length > 0 && (
                    <div className="flex gap-1 overflow-x-auto">
                        {issue.imageUrls.map((url, i) => (
                            <div
                                key={i}
                                className="relative flex-shrink-0 h-52 w-80 first:rounded-none"
                            >
                                <Image
                                    src={url}
                                    alt={`Issue photo ${i + 1}`}
                                    fill
                                    className="object-cover"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-background/60 via-transparent to-transparent" />
                            </div>
                        ))}
                    </div>
                )}

                <div className="px-4 py-5 space-y-5">
                    {/* Status + category + priority */}
                    <div className="flex items-center gap-2 flex-wrap">
                        <span
                            className={`text-xs font-medium px-2.5 py-1 rounded-full border ${STATUS_BADGE[issue.status]}`}
                        >
                            {issue.status.charAt(0) +
                                issue.status.slice(1).toLowerCase()}
                        </span>
                        <span className="text-sm">
                            {CATEGORY_EMOJI[issue.category]}{" "}
                            {issue.category.replace("_", " ")}
                        </span>
                        {issue.priority >= 8 && (
                            <span className="flex items-center gap-1 text-xs font-medium text-red-400 bg-red-500/15 border border-red-500/20 px-2 py-0.5 rounded-full">
                                <AlertTriangle className="h-3 w-3" /> Critical
                            </span>
                        )}
                        {issue.isPersonal && issue.bounty && (
                            <span className="text-xs font-medium bg-amber-500/15 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full">
                                💰 ₹{issue.bounty} bounty
                            </span>
                        )}
                    </div>

                    {/* Title */}
                    <h2 className="text-xl font-bold leading-snug tracking-tight">
                        {issue.title}
                    </h2>

                    {/* Meta */}
                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        {issue.address && (
                            <span className="flex items-center gap-1">
                                <MapPin className="h-3 w-3 text-primary/60" />{" "}
                                {issue.address}
                            </span>
                        )}
                        <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDistanceToNow(issue.createdAt, {
                                addSuffix: true,
                            })}
                        </span>
                        <span className="flex items-center gap-1">
                            <Eye className="h-3 w-3" /> {issue.viewCount}
                        </span>
                        <span className="flex items-center gap-1">
                            <MessageCircle className="h-3 w-3" />{" "}
                            {issue._count.comments}
                        </span>
                    </div>

                    {/* Description */}
                    <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-line">
                        {issue.description}
                    </p>

                    {/* Reporter */}
                    <div className="glass rounded-xl p-3 flex items-center gap-3">
                        <Avatar className="h-8 w-8 ring-1 ring-white/10">
                            <AvatarImage
                                src={issue.reporter.image ?? undefined}
                            />
                            <AvatarFallback className="text-xs bg-primary/20 text-primary">
                                {issue.reporter.name?.[0] ?? "U"}
                            </AvatarFallback>
                        </Avatar>
                        <div className="text-xs">
                            <span className="text-muted-foreground">
                                Reported by{" "}
                            </span>
                            <Link
                                href={`/profile/${issue.reporter.id}`}
                                className="font-medium hover:text-primary transition-colors"
                            >
                                {issue.reporter.name ?? "Anonymous"}
                            </Link>
                            <span className="text-muted-foreground">
                                {" "}
                                · Trust score: {issue.reporter.trustScore}
                            </span>
                        </div>
                    </div>

                    {/* NGO */}
                    {issue.assignedNGO && (
                        <div
                            className="glass rounded-xl px-4 py-3 text-sm border-purple-500/20"
                            style={{ borderColor: "rgba(139, 92, 246, 0.15)" }}
                        >
                            <p className="font-medium text-purple-400">
                                Assigned to{" "}
                                <Link
                                    href={`/ngos`}
                                    className="hover:underline"
                                >
                                    {issue.assignedNGO.name}
                                </Link>
                            </p>
                        </div>
                    )}

                    {/* AI analysis */}
                    {aiAnalysis && (
                        <div
                            className="glass rounded-2xl px-4 py-3 text-sm space-y-3 border-primary/15"
                            style={{
                                borderColor: "hsl(var(--primary) / 0.12)",
                            }}
                        >
                            <div className="flex items-center gap-1.5 font-semibold text-primary">
                                <Sparkles className="h-4 w-4" /> AI Analysis
                            </div>

                            {/* Resolution Time Estimate — prominent */}
                            <div className="glass rounded-xl p-3 flex items-center gap-3 border border-primary/10">
                                <div className="flex items-center justify-center h-10 w-10 rounded-full bg-primary/10 shrink-0">
                                    <Clock className="h-5 w-5 text-primary" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs text-muted-foreground">
                                        Estimated Resolution Time
                                    </p>
                                    <p className="font-bold text-lg leading-tight">
                                        {aiAnalysis.estimatedResolutionDays}{" "}
                                        <span className="text-sm font-normal text-muted-foreground">
                                            {aiAnalysis.estimatedResolutionDays ===
                                            1
                                                ? "day"
                                                : "days"}
                                        </span>
                                    </p>
                                    {aiAnalysis.estimationReasoning && (
                                        <p className="text-[11px] text-muted-foreground mt-0.5">
                                            {aiAnalysis.estimationReasoning}
                                        </p>
                                    )}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2 text-xs mt-2">
                                <div className="glass rounded-xl p-2.5 text-center">
                                    <p className="text-muted-foreground">
                                        Priority
                                    </p>
                                    <p className="font-bold text-base text-red-400">
                                        {aiAnalysis.priorityScore}/10
                                    </p>
                                </div>
                                <div className="glass rounded-xl p-2.5 text-center">
                                    <p className="text-muted-foreground">
                                        Category
                                    </p>
                                    <p className="font-bold text-xs mt-0.5">
                                        {aiAnalysis.suggestedCategory}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Vote */}
                    <VoteButton
                        issueId={issue.id}
                        initialUpvotes={issue.upvotes}
                        userVote={userVote}
                        reporterId={issue.reporter.id}
                    />

                    <Separator className="bg-white/[0.06]" />

                    {/* Lifecycle */}
                    <LifecycleTimeline
                        status={issue.status}
                        createdAt={issue.createdAt.toISOString()}
                        resolvedAt={issue.resolvedAt?.toISOString()}
                        deadline={issue.deadline?.toISOString()}
                        hasNGO={!!issue.assignedNGOId}
                    />

                    {/* Resolution proof */}
                    {issue.status === "RESOLVED" &&
                        issue.resolutionProof.length > 0 && (
                            <ResolutionProof
                                issueId={issue.id}
                                proofUrls={issue.resolutionProof}
                                existingVote={userResolutionVote}
                            />
                        )}

                    {/* Upload resolution proof (any signed-in user) */}
                    {session &&
                        issue.status !== "RESOLVED" &&
                        issue.status !== "CLOSED" && (
                            <ResolutionProof
                                issueId={issue.id}
                                proofUrls={[]}
                                canUpload
                            />
                        )}

                    <Separator className="bg-white/[0.06]" />

                    {/* Comments */}
                    <CommentThread issueId={issue.id} />
                </div>
            </div>
        </div>
    );
}
