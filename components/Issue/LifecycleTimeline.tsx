"use client";

import { cn } from "@/lib/utils";
import { CheckCircle, Circle, Clock, AlertTriangle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface Props {
    status: string;
    createdAt?: string;
    resolvedAt?: string;
    deadline?: string;
    hasNGO?: boolean;
}

const STATUS_ORDER = ["REPORTED", "ASSIGNED", "RESOLVED", "CLOSED"];

export function LifecycleTimeline({
    status,
    createdAt,
    resolvedAt,
    deadline,
    hasNGO,
}: Props) {
    const currentIdx = STATUS_ORDER.indexOf(status);
    // Legacy: treat VERIFIED the same as REPORTED for display purposes
    const displayIdx =
        status === "VERIFIED" ? STATUS_ORDER.indexOf("REPORTED") : currentIdx;

    // Only show the ASSIGNED step if an NGO is/was assigned
    const steps = [
        { key: "REPORTED", label: "Reported" },
        ...(hasNGO || status === "ASSIGNED"
            ? [{ key: "ASSIGNED", label: "NGO Assigned" }]
            : []),
        { key: "RESOLVED", label: "Resolved" },
    ];

    return (
        <div className="space-y-1">
            <h3 className="text-sm font-semibold mb-3">Issue Progress</h3>

            <div className="relative">
                {/* Connecting line */}
                <div className="absolute left-3 top-4 bottom-4 w-0.5 bg-white/[0.06]" />

                <div className="space-y-4">
                    {steps.map((step, i) => {
                        const stepIdx = STATUS_ORDER.indexOf(step.key);
                        const isCompleted =
                            stepIdx < displayIdx ||
                            status === step.key ||
                            (step.key === "REPORTED" && status === "VERIFIED");
                        const isCurrent = status === step.key;

                        const timestamps: Record<string, string | undefined> = {
                            REPORTED: createdAt,
                            RESOLVED: resolvedAt,
                        };
                        const timestamp = timestamps[step.key];

                        return (
                            <div
                                key={step.key}
                                className="relative flex items-start gap-3 pl-0"
                            >
                                <div
                                    className={cn(
                                        "relative z-10 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border-2",
                                        isCompleted
                                            ? "border-primary bg-primary text-primary-foreground"
                                            : "border-white/[0.12] bg-white/[0.03]",
                                    )}
                                >
                                    {isCompleted ? (
                                        <CheckCircle className="h-3.5 w-3.5" />
                                    ) : (
                                        <Circle className="h-3.5 w-3.5 text-muted-foreground" />
                                    )}
                                </div>
                                <div className="pt-0.5 min-w-0">
                                    <p
                                        className={cn(
                                            "text-sm",
                                            isCurrent
                                                ? "font-semibold"
                                                : isCompleted
                                                  ? "font-medium"
                                                  : "text-muted-foreground",
                                        )}
                                    >
                                        {step.label}
                                    </p>
                                    {timestamp && (
                                        <p className="text-xs text-muted-foreground">
                                            {formatDistanceToNow(
                                                new Date(timestamp),
                                                { addSuffix: true },
                                            )}
                                        </p>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Deadline warning */}
            {deadline && status !== "RESOLVED" && status !== "CLOSED" && (
                <div className="mt-3 flex items-center gap-1.5 text-xs">
                    {new Date(deadline) < new Date() ? (
                        <span className="flex items-center gap-1 text-red-600 font-medium">
                            <AlertTriangle className="h-3 w-3" />
                            Deadline passed{" "}
                            {formatDistanceToNow(new Date(deadline), {
                                addSuffix: true,
                            })}
                        </span>
                    ) : (
                        <span className="flex items-center gap-1 text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            Expected resolution:{" "}
                            {formatDistanceToNow(new Date(deadline), {
                                addSuffix: true,
                            })}
                        </span>
                    )}
                </div>
            )}
        </div>
    );
}
