"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { ChevronUp, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Props {
  issueId: string;
  initialUpvotes: number;
  userVote: number | null;
  reporterId: string;
}

export function VoteButton({ issueId, initialUpvotes, userVote: initialVote, reporterId }: Props) {
  const { data: session } = useSession();
  const [upvotes, setUpvotes] = useState(initialUpvotes);
  const [userVote, setUserVote] = useState(initialVote);
  const [loading, setLoading] = useState(false);

  const isOwnIssue = session?.user?.id === reporterId;

  async function vote(value: 1 | -1) {
    if (!session) { toast.error("Sign in to vote"); return; }
    if (isOwnIssue) { toast.error("Cannot vote on your own issue"); return; }

    setLoading(true);
    const newValue = userVote === value ? 0 : value;

    try {
      const res = await fetch(`/api/issues/${issueId}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: newValue }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setUpvotes(data.upvotes);
      setUserVote(data.userVote);
    } catch {
      toast.error("Failed to vote");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-1">
      <Button
        variant={userVote === 1 ? "default" : "outline"}
        size="sm"
        className={cn("gap-1.5 px-3", userVote === 1 && "text-primary-foreground")}
        onClick={() => vote(1)}
        disabled={loading || isOwnIssue}
      >
        <ChevronUp className="h-4 w-4" />
        {upvotes}
      </Button>
      <span className="text-xs text-muted-foreground px-1">upvotes</span>
    </div>
  );
}
