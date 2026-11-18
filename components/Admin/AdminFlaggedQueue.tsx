"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle, Trash2, Flag, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

export function AdminFlaggedQueue() {
    const [issues, setIssues] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch("/api/admin/flagged")
            .then((r) => r.json())
            .then((d) => setIssues(d.issues ?? []))
            .finally(() => setLoading(false));
    }, []);

    async function unflag(id: string) {
        await fetch(`/api/admin/flagged/${id}`, { method: "PATCH" });
        setIssues((p) => p.filter((i) => i.id !== id));
        toast.success("Issue unflagged");
    }

    async function remove(id: string) {
        await fetch(`/api/admin/flagged/${id}`, { method: "DELETE" });
        setIssues((p) => p.filter((i) => i.id !== id));
        toast.success("Issue removed");
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

    if (issues.length === 0) {
        return (
            <div className="text-center py-8 text-muted-foreground">
                <Flag className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No flagged content.</p>
            </div>
        );
    }

    return (
        <div className="space-y-2">
            {issues.map((issue) => (
                <div
                    key={issue.id}
                    className="flex items-center gap-3 p-3 border border-red-500/20 rounded-xl bg-red-500/[0.05]"
                >
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                            {issue.title}
                        </p>
                        <p className="text-xs text-muted-foreground">
                            {issue.flagCount} flags ·{" "}
                            {formatDistanceToNow(new Date(issue.createdAt), {
                                addSuffix: true,
                            })}
                        </p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            render={
                                <Link
                                    href={`/issues/${issue.id}`}
                                    target="_blank"
                                />
                            }
                        >
                            <ExternalLink className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-emerald-400"
                            onClick={() => unflag(issue.id)}
                            title="Unflag (content is fine)"
                        >
                            <CheckCircle className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive"
                            onClick={() => remove(issue.id)}
                            title="Remove (close issue)"
                        >
                            <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                    </div>
                </div>
            ))}
        </div>
    );
}
