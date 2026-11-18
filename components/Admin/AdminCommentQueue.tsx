"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle, Trash2, MessageSquare, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

export function AdminCommentQueue() {
    const [comments, setComments] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch("/api/admin/comments")
            .then((r) => r.json())
            .then((d) => setComments(d.comments ?? []))
            .finally(() => setLoading(false));
    }, []);

    async function unflag(id: string) {
        await fetch(`/api/admin/comments/${id}`, { method: "PATCH" });
        setComments((p) => p.filter((c) => c.id !== id));
        toast.success("Comment unflagged");
    }

    async function remove(id: string) {
        await fetch(`/api/admin/comments/${id}`, { method: "DELETE" });
        setComments((p) => p.filter((c) => c.id !== id));
        toast.success("Comment removed");
    }

    if (loading) {
        return (
            <div className="space-y-2">
                {[1, 2].map((i) => (
                    <Skeleton key={i} className="h-16 rounded-lg" />
                ))}
            </div>
        );
    }

    if (comments.length === 0) {
        return (
            <div className="text-center py-8 text-muted-foreground">
                <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No flagged comments.</p>
            </div>
        );
    }

    return (
        <div className="space-y-2">
            {comments.map((comment) => (
                <div
                    key={comment.id}
                    className="flex items-start gap-3 p-3 border border-red-500/20 rounded-xl bg-red-500/[0.05]"
                >
                    <div className="flex-1 min-w-0">
                        <p className="text-sm line-clamp-2">
                            {comment.content}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                            by {comment.author?.name ?? "Unknown"} ·{" "}
                            {comment.flagCount} flags ·{" "}
                            {formatDistanceToNow(new Date(comment.createdAt), {
                                addSuffix: true,
                            })}
                        </p>
                        {comment.issue && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                                on:{" "}
                                <span className="text-foreground/70">
                                    {comment.issue.title}
                                </span>
                            </p>
                        )}
                    </div>
                    <div className="flex gap-1 shrink-0">
                        {comment.issue && (
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                render={
                                    <Link
                                        href={`/issues/${comment.issue.id}`}
                                        target="_blank"
                                    />
                                }
                            >
                                <ExternalLink className="h-3.5 w-3.5" />
                            </Button>
                        )}
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-emerald-400"
                            onClick={() => unflag(comment.id)}
                            title="Unflag"
                        >
                            <CheckCircle className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive"
                            onClick={() => remove(comment.id)}
                            title="Remove comment"
                        >
                            <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                    </div>
                </div>
            ))}
        </div>
    );
}
