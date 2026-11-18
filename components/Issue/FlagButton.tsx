"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Flag } from "lucide-react";
import { toast } from "sonner";
import { useSession } from "next-auth/react";

interface Props {
  issueId: string;
  commentId?: string;
}

export function FlagButton({ issueId, commentId }: Props) {
  const { data: session } = useSession();
  const [flagged, setFlagged] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleFlag() {
    if (!session) { toast.error("Sign in to flag content"); return; }
    if (flagged) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/issues/${issueId}/flag`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Inappropriate content", commentId }),
      });
      if (!res.ok) throw new Error();
      setFlagged(true);
      toast.success("Flagged for review");
    } catch {
      toast.error("Failed to flag");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-8 w-8 text-muted-foreground hover:text-destructive"
      onClick={handleFlag}
      disabled={loading || flagged}
      title="Flag as inappropriate"
    >
      <Flag className={`h-3.5 w-3.5 ${flagged ? "fill-destructive text-destructive" : ""}`} />
    </Button>
  );
}
