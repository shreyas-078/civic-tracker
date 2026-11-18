"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
    CheckCircle,
    XCircle,
    Building2,
    ExternalLink,
    Ban,
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { Input } from "@/components/ui/input";

export function AdminNGOQueue() {
    const [ngos, setNgos] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState<string | null>(null);
    const [blacklistTarget, setBlacklistTarget] = useState<string | null>(null);
    const [blacklistReason, setBlacklistReason] = useState("");

    useEffect(() => {
        fetch("/api/admin/ngos")
            .then((r) => r.json())
            .then((d) => setNgos(d.ngos ?? []))
            .finally(() => setLoading(false));
    }, []);

    async function handleAction(
        ngoId: string,
        action: "APPROVE" | "REJECT" | "BLACKLIST",
        reason?: string,
    ) {
        setProcessing(ngoId);
        try {
            const res = await fetch(`/api/admin/ngos/${ngoId}/approve`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action, reason }),
            });
            if (!res.ok) throw new Error();
            setNgos((prev) => prev.filter((n) => n.id !== ngoId));
            setBlacklistTarget(null);
            setBlacklistReason("");
            toast.success(
                action === "APPROVE"
                    ? "NGO approved!"
                    : action === "REJECT"
                      ? "NGO rejected"
                      : "NGO blacklisted",
            );
        } catch {
            toast.error("Failed to process NGO application");
        } finally {
            setProcessing(null);
        }
    }

    if (loading) {
        return (
            <div className="space-y-3">
                {[1, 2].map((i) => (
                    <Skeleton key={i} className="h-24 rounded-xl" />
                ))}
            </div>
        );
    }

    if (ngos.length === 0) {
        return (
            <div className="text-center py-8 text-muted-foreground">
                <Building2 className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No pending NGO applications.</p>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {ngos.map((ngo) => (
                <div key={ngo.id} className="glass rounded-xl p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                        <div>
                            <h3 className="font-semibold">{ngo.name}</h3>
                            <p className="text-xs text-muted-foreground">
                                Applied{" "}
                                {formatDistanceToNow(new Date(ngo.createdAt), {
                                    addSuffix: true,
                                })}
                            </p>
                        </div>
                        <span className="text-xs bg-amber-500/15 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full">
                            PENDING
                        </span>
                    </div>

                    <p className="text-sm text-muted-foreground line-clamp-2">
                        {ngo.description}
                    </p>

                    {ngo.proofUrl && (
                        <a
                            href={ngo.proofUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                            <ExternalLink className="h-3 w-3" /> View proof
                            document
                        </a>
                    )}

                    <div className="space-y-2">
                        <div className="flex gap-2">
                            <Button
                                size="sm"
                                variant="default"
                                className="gap-1.5 flex-1"
                                onClick={() => handleAction(ngo.id, "APPROVE")}
                                disabled={processing === ngo.id}
                            >
                                <CheckCircle className="h-3.5 w-3.5" /> Approve
                            </Button>
                            <Button
                                size="sm"
                                variant="destructive"
                                className="gap-1.5 flex-1"
                                onClick={() => handleAction(ngo.id, "REJECT")}
                                disabled={processing === ngo.id}
                            >
                                <XCircle className="h-3.5 w-3.5" /> Reject
                            </Button>
                            <Button
                                size="sm"
                                variant="outline"
                                className="gap-1.5 text-red-400 border-red-500/20 hover:bg-red-500/10"
                                onClick={() =>
                                    setBlacklistTarget(
                                        blacklistTarget === ngo.id
                                            ? null
                                            : ngo.id,
                                    )
                                }
                                disabled={processing === ngo.id}
                            >
                                <Ban className="h-3.5 w-3.5" /> Ban
                            </Button>
                        </div>
                        {blacklistTarget === ngo.id && (
                            <div className="flex gap-2">
                                <Input
                                    placeholder="Reason for blacklisting..."
                                    value={blacklistReason}
                                    onChange={(e) =>
                                        setBlacklistReason(e.target.value)
                                    }
                                    className="text-sm h-8"
                                />
                                <Button
                                    size="sm"
                                    variant="destructive"
                                    className="shrink-0"
                                    onClick={() =>
                                        handleAction(
                                            ngo.id,
                                            "BLACKLIST",
                                            blacklistReason,
                                        )
                                    }
                                    disabled={processing === ngo.id}
                                >
                                    Confirm
                                </Button>
                            </div>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
}
