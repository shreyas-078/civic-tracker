"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { RefreshCw, ExternalLink, Download, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

const STATUS_COLOR: Record<string, string> = {
    REPORTED: "bg-amber-500/15 text-amber-400 border border-amber-500/20",
    VERIFIED: "bg-blue-500/15 text-blue-400 border border-blue-500/20",
    ASSIGNED: "bg-purple-500/15 text-purple-400 border border-purple-500/20",
    RESOLVED: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20",
};

export function AdminIssuesFeed() {
    const [issues, setIssues] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [exporting, setExporting] = useState(false);

    async function deleteIssue(id: string) {
        await fetch(`/api/admin/issues/${id}`, { method: "DELETE" });
        setIssues((p) => p.filter((i) => i.id !== id));
        toast.success("Issue closed");
    }

    async function load() {
        setLoading(true);
        try {
            const res = await fetch("/api/admin/issues");
            const data = await res.json();
            setIssues(data.issues ?? []);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        load();
        const interval = setInterval(load, 30_000); // poll every 30s
        return () => clearInterval(interval);
    }, []);

    async function handleExport(format: "csv" | "geojson") {
        setExporting(true);
        try {
            const res = await fetch(`/api/admin/export?format=${format}`);
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `civic-issues.${format === "csv" ? "csv" : "geojson"}`;
            a.click();
        } finally {
            setExporting(false);
        }
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                    Auto-refreshes every 30 seconds
                </p>
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleExport("csv")}
                        disabled={exporting}
                    >
                        <Download className="h-3.5 w-3.5 mr-1" /> CSV
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleExport("geojson")}
                        disabled={exporting}
                    >
                        <Download className="h-3.5 w-3.5 mr-1" /> GeoJSON
                    </Button>
                    <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={load}
                        disabled={loading}
                    >
                        <RefreshCw
                            className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
                        />
                    </Button>
                </div>
            </div>

            {loading ? (
                <div className="space-y-2">
                    {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-14 rounded-lg" />
                    ))}
                </div>
            ) : (
                <div className="space-y-2">
                    {issues.map((issue) => (
                        <div
                            key={issue.id}
                            className="flex items-center gap-3 p-3 glass rounded-xl hover:bg-white/[0.05] transition-all duration-200"
                        >
                            <span
                                className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[issue.status] ?? ""}`}
                            >
                                {issue.status.charAt(0) +
                                    issue.status.slice(1).toLowerCase()}
                            </span>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">
                                    {issue.title}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    {issue.category} · {issue.upvotes} upvotes
                                    {issue.reporter?.name
                                        ? ` · ${issue.reporter.name}`
                                        : ""}{" "}
                                    ·{" "}
                                    {formatDistanceToNow(
                                        new Date(issue.createdAt),
                                        { addSuffix: true },
                                    )}
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
                                    className="h-7 w-7 text-destructive"
                                    onClick={() => deleteIssue(issue.id)}
                                    title="Close issue"
                                >
                                    <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                            </div>
                        </div>
                    ))}
                    {issues.length === 0 && (
                        <p className="text-center text-muted-foreground text-sm py-6">
                            No issues found.
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}
