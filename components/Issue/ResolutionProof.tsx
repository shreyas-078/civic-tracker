"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import {
    CheckCircle,
    XCircle,
    HelpCircle,
    Camera,
    Upload,
    Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { useSession } from "next-auth/react";

interface Props {
    issueId: string;
    proofUrls: string[];
    canUpload?: boolean;
    existingVote?: string | null;
}

export function ResolutionProof({
    issueId,
    proofUrls,
    canUpload,
    existingVote,
}: Props) {
    const { data: session } = useSession();
    const [vote, setVote] = useState<"YES" | "NO" | "IDK" | null>(
        (existingVote as "YES" | "NO" | "IDK" | null) ?? null,
    );
    const [voting, setVoting] = useState(false);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    async function submitVerification(v: "YES" | "NO" | "IDK") {
        if (!session) {
            toast.error("Sign in first");
            return;
        }
        setVoting(true);
        setVote(v);
        try {
            const res = await fetch(`/api/resolution/vote/${issueId}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ vote: v }),
            });
            if (!res.ok) throw new Error();
            toast.success("Thanks for your feedback!");
        } catch {
            toast.error("Failed to submit vote");
            setVote(null);
        } finally {
            setVoting(false);
        }
    }

    if (proofUrls.length === 0 && canUpload) {
        return (
            <div className="glass rounded-xl p-4 space-y-3 border border-emerald-500/20">
                <p className="text-sm font-semibold text-emerald-400">
                    Upload Resolution Proof
                </p>
                <p className="text-xs text-muted-foreground">
                    Take a photo showing the issue has been fixed.
                </p>
                <div>
                    <Button
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        disabled={uploading}
                        onClick={() => fileInputRef.current?.click()}
                    >
                        {uploading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <Camera className="h-4 w-4" />
                        )}
                        Take / Choose Photo
                    </Button>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            setUploading(true);
                            try {
                                const form = new FormData();
                                form.append("files", file);
                                const up = await fetch("/api/upload", {
                                    method: "POST",
                                    body: form,
                                });
                                if (!up.ok) throw new Error("Upload failed");
                                const { urls } = await up.json();

                                const res = await fetch(
                                    `/api/issues/${issueId}/resolve`,
                                    {
                                        method: "POST",
                                        headers: {
                                            "Content-Type": "application/json",
                                        },
                                        body: JSON.stringify({
                                            resolutionProof: urls,
                                        }),
                                    },
                                );
                                if (!res.ok)
                                    throw new Error("Could not save proof");
                                toast.success(
                                    "Proof submitted! Awaiting community verification.",
                                );
                            } catch {
                                toast.error(
                                    "Failed to upload proof. Please try again.",
                                );
                            } finally {
                                setUploading(false);
                            }
                        }}
                    />
                </div>
            </div>
        );
    }

    if (proofUrls.length === 0) return null;

    return (
        <div className="space-y-3">
            <h3 className="text-sm font-semibold">Resolution Proof</h3>

            <div className="flex gap-2 overflow-x-auto">
                {proofUrls.map((url, i) => (
                    <div
                        key={i}
                        className="relative flex-shrink-0 h-28 w-40 rounded-lg overflow-hidden"
                    >
                        <Image
                            src={url}
                            alt={`Proof ${i + 1}`}
                            fill
                            className="object-cover"
                        />
                    </div>
                ))}
            </div>

            {/* Community verification */}
            <div className="glass rounded-xl p-4 space-y-3 border border-emerald-500/20">
                <p className="text-sm font-semibold text-emerald-400">
                    Has this been resolved?
                </p>
                <p className="text-xs text-muted-foreground">
                    Help verify if this issue has actually been fixed.
                </p>
                <div className="flex gap-2">
                    <Button
                        size="sm"
                        variant={vote === "YES" ? "default" : "outline"}
                        className="gap-1.5 flex-1"
                        onClick={() => submitVerification("YES")}
                        disabled={voting || vote !== null}
                    >
                        <CheckCircle className="h-3.5 w-3.5" /> Yes
                    </Button>
                    <Button
                        size="sm"
                        variant={vote === "NO" ? "destructive" : "outline"}
                        className="gap-1.5 flex-1"
                        onClick={() => submitVerification("NO")}
                        disabled={voting || vote !== null}
                    >
                        <XCircle className="h-3.5 w-3.5" /> No
                    </Button>
                    <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 flex-1"
                        onClick={() => submitVerification("IDK")}
                        disabled={voting || vote !== null}
                    >
                        <HelpCircle className="h-3.5 w-3.5" /> Not sure
                    </Button>
                </div>
                {vote && (
                    <p className="text-xs text-emerald-400">
                        Thanks for your vote!
                    </p>
                )}
            </div>
        </div>
    );
}
