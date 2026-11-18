"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { MessageSquare, Reply, Send } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { FlagButton } from "./FlagButton";
import type { CommentData } from "@/types";

interface Props {
    issueId: string;
}

export function CommentThread({ issueId }: Props) {
    const { data: session } = useSession();
    const [comments, setComments] = useState<CommentData[]>([]);
    const [loading, setLoading] = useState(true);
    const [sort, setSort] = useState("hot");
    const [newComment, setNewComment] = useState("");
    const [replyTo, setReplyTo] = useState<{ id: string; name: string } | null>(
        null,
    );
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        setLoading(true);
        fetch(`/api/issues/${issueId}/comments?sort=${sort}`)
            .then((r) => r.json())
            .then((data) => setComments(data.comments ?? []))
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [issueId, sort]);

    async function submitComment() {
        if (!newComment.trim()) return;
        setSubmitting(true);
        try {
            const res = await fetch(`/api/issues/${issueId}/comments`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    content: newComment,
                    parentId: replyTo?.id,
                }),
            });
            if (!res.ok) {
                const err = await res.json();
                toast.error(err.error ?? "Failed to post comment");
                return;
            }
            const { comment } = await res.json();
            setNewComment("");
            setReplyTo(null);

            // Optimistically update
            if (comment.parentId) {
                setComments((prev) =>
                    prev.map((c) =>
                        c.id === comment.parentId
                            ? { ...c, replies: [...(c.replies ?? []), comment] }
                            : c,
                    ),
                );
            } else {
                setComments((prev) => [comment, ...prev]);
            }
            toast.success("Comment posted!");
        } catch {
            toast.error("Failed to post comment");
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold flex items-center gap-1.5">
                    <MessageSquare className="h-4 w-4" />
                    Comments ({comments.length})
                </h3>
                <Select
                    value={sort}
                    onValueChange={(v) => v !== null && setSort(v)}
                >
                    <SelectTrigger className="h-7 w-24 text-xs">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="hot">Hot</SelectItem>
                        <SelectItem value="new">New</SelectItem>
                        <SelectItem value="top">Top</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* Comment input */}
            {session ? (
                <div className="space-y-2">
                    {replyTo && (
                        <div className="flex items-center gap-2 text-xs glass-subtle px-3 py-1.5 rounded-xl">
                            <Reply className="h-3 w-3" />
                            Replying to <strong>{replyTo.name}</strong>
                            <button
                                onClick={() => setReplyTo(null)}
                                className="ml-auto text-muted-foreground hover:text-foreground"
                            >
                                ✕
                            </button>
                        </div>
                    )}
                    <div className="flex gap-2">
                        <Textarea
                            placeholder="Write a comment..."
                            value={newComment}
                            onChange={(e) => setNewComment(e.target.value)}
                            rows={2}
                            className="text-sm resize-none"
                        />
                        <Button
                            size="icon"
                            className="shrink-0 h-auto"
                            onClick={submitComment}
                            disabled={submitting || !newComment.trim()}
                        >
                            <Send className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            ) : (
                <p className="text-xs text-muted-foreground">
                    <a href="/auth/signin" className="underline">
                        Sign in
                    </a>{" "}
                    to comment.
                </p>
            )}

            {/* Comment list */}
            {loading ? (
                <div className="space-y-3">
                    {[1, 2].map((i) => (
                        <div key={i} className="flex gap-2">
                            <Skeleton className="h-7 w-7 rounded-full shrink-0" />
                            <div className="space-y-1.5 flex-1">
                                <Skeleton className="h-3 w-24" />
                                <Skeleton className="h-4 w-full" />
                            </div>
                        </div>
                    ))}
                </div>
            ) : comments.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                    No comments yet. Be the first!
                </p>
            ) : (
                <div className="space-y-4">
                    {comments.map((comment) => (
                        <div key={comment.id}>
                            <CommentItem
                                comment={comment}
                                issueId={issueId}
                                onReply={(id, name) => setReplyTo({ id, name })}
                            />
                            {/* Replies */}
                            {comment.replies && comment.replies.length > 0 && (
                                <div className="ml-8 mt-2 space-y-2 border-l-2 border-muted pl-3">
                                    {comment.replies.map((reply) => (
                                        <CommentItem
                                            key={reply.id}
                                            comment={reply}
                                            issueId={issueId}
                                            isReply
                                            onReply={() => {}}
                                        />
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

function CommentItem({
    comment,
    issueId,
    isReply,
    onReply,
}: {
    comment: CommentData;
    issueId: string;
    isReply?: boolean;
    onReply: (id: string, name: string) => void;
}) {
    return (
        <div className="flex gap-2.5">
            <Avatar className={isReply ? "h-6 w-6" : "h-7 w-7"}>
                <AvatarImage src={comment.author.image ?? undefined} />
                <AvatarFallback className="text-xs">
                    {comment.author.name?.[0] ?? "U"}
                </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-medium">
                        {comment.author.name ?? "Anonymous"}
                    </span>
                    <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(comment.createdAt), {
                            addSuffix: true,
                        })}
                    </span>
                    <span className="text-xs text-muted-foreground">
                        · trust {comment.author.trustScore}
                    </span>
                </div>
                <p className="text-sm mt-0.5 leading-relaxed">
                    {comment.content}
                </p>
                <div className="flex items-center gap-1 mt-1">
                    {!isReply && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-xs gap-1 text-muted-foreground px-1.5"
                            onClick={() =>
                                onReply(
                                    comment.id,
                                    comment.author.name ?? "user",
                                )
                            }
                        >
                            <Reply className="h-3 w-3" /> Reply
                        </Button>
                    )}
                    <FlagButton issueId={issueId} commentId={comment.id} />
                </div>
            </div>
        </div>
    );
}
