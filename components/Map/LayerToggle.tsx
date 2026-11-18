"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { SlidersHorizontal, Eye, EyeOff, X } from "lucide-react";
import type { IssueFilters, IssueStatus, IssueCategory } from "@/types";
import { cn } from "@/lib/utils";

const STATUSES: Array<{ value: IssueStatus; label: string; color: string }> = [
    { value: "REPORTED", label: "Reported", color: "rgb(239, 68, 68)" },
    { value: "VERIFIED", label: "Verified", color: "rgb(245, 158, 11)" },
    { value: "ASSIGNED", label: "Assigned", color: "rgb(139, 92, 246)" },
    { value: "RESOLVED", label: "Resolved", color: "rgb(34, 197, 94)" },
];

const CATEGORIES: Array<{
    value: IssueCategory;
    label: string;
    emoji: string;
}> = [
    { value: "ROAD", label: "Road", emoji: "\u{1F6E3}\uFE0F" },
    { value: "WATER", label: "Water", emoji: "\u{1F4A7}" },
    { value: "ELECTRICITY", label: "Electricity", emoji: "\u26A1" },
    { value: "SANITATION", label: "Sanitation", emoji: "\u{1F5D1}\uFE0F" },
    { value: "PUBLIC_SPACE", label: "Public Space", emoji: "\u{1F3D9}\uFE0F" },
    { value: "ENVIRONMENT", label: "Environment", emoji: "\u{1F331}" },
];

interface Props {
    filters: IssueFilters;
    onFiltersChange: (f: IssueFilters) => void;
    showPersonal: boolean;
    onTogglePersonal: () => void;
}

export function LayerToggle({
    filters,
    onFiltersChange,
    showPersonal,
    onTogglePersonal,
}: Props) {
    const [open, setOpen] = useState(false);

    const activeCount =
        (filters.status?.length ?? 0) + (filters.category?.length ?? 0);

    function toggleStatus(s: IssueStatus) {
        const current = filters.status ?? [];
        const next = current.includes(s)
            ? current.filter((x) => x !== s)
            : [...current, s];
        onFiltersChange({ ...filters, status: next.length ? next : undefined });
    }

    function toggleCategory(c: IssueCategory) {
        const current = filters.category ?? [];
        const next = current.includes(c)
            ? current.filter((x) => x !== c)
            : [...current, c];
        onFiltersChange({
            ...filters,
            category: next.length ? next : undefined,
        });
    }

    return (
        <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger
                render={
                    <Button
                        variant="secondary"
                        size="sm"
                        className="shadow-lg gap-1.5 rounded-full"
                    />
                }
            >
                <SlidersHorizontal className="h-4 w-4" />
                Filters
                {activeCount > 0 && (
                    <Badge
                        variant="default"
                        className="h-4 w-4 p-0 flex items-center justify-center text-[10px] ml-0.5"
                    >
                        {activeCount}
                    </Badge>
                )}
            </SheetTrigger>
            <SheetContent side="right" className="w-[17.5rem] px-5 py-5">
                <SheetHeader className="p-0">
                    <div className="flex items-center justify-between">
                        <SheetTitle className="font-display italic text-base">
                            Map Filters
                        </SheetTitle>
                        {activeCount > 0 && (
                            <button
                                onClick={() => onFiltersChange({})}
                                className="text-2xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
                            >
                                <X className="h-3 w-3" />
                                Clear all
                            </button>
                        )}
                    </div>
                </SheetHeader>

                <div className="space-y-6 mt-6">
                    {/* Status filters */}
                    <section>
                        <p className="text-2xs font-medium uppercase tracking-widest text-muted-foreground mb-3 px-1">
                            Status
                        </p>
                        <div className="rounded-xl glass overflow-hidden">
                            {STATUSES.map((s, i) => {
                                const active = filters.status?.includes(
                                    s.value,
                                );
                                return (
                                    <div key={s.value}>
                                        <button
                                            onClick={() =>
                                                toggleStatus(s.value)
                                            }
                                            className={cn(
                                                "w-full flex items-center gap-3 px-3.5 py-3 text-sm transition-all",
                                                active
                                                    ? "bg-white/[0.06] font-medium text-foreground"
                                                    : "text-muted-foreground hover:bg-white/[0.03] hover:text-foreground",
                                            )}
                                        >
                                            <span
                                                className={cn(
                                                    "h-2.5 w-2.5 rounded-full flex-shrink-0 transition-shadow",
                                                    active &&
                                                        "shadow-[0_0_8px_var(--dot-glow)]",
                                                )}
                                                style={
                                                    {
                                                        backgroundColor:
                                                            s.color,
                                                        "--dot-glow":
                                                            s.color + "66",
                                                    } as React.CSSProperties
                                                }
                                            />
                                            {s.label}
                                            {active && (
                                                <span className="ml-auto text-primary text-xs">
                                                    &#x2713;
                                                </span>
                                            )}
                                        </button>
                                        {i < STATUSES.length - 1 && (
                                            <Separator className="opacity-30" />
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </section>

                    {/* Category filters */}
                    <section>
                        <p className="text-2xs font-medium uppercase tracking-widest text-muted-foreground mb-3 px-1">
                            Category
                        </p>
                        <div className="flex flex-wrap gap-2">
                            {CATEGORIES.map((c) => {
                                const active = filters.category?.includes(
                                    c.value,
                                );
                                return (
                                    <button
                                        key={c.value}
                                        onClick={() => toggleCategory(c.value)}
                                        className={cn(
                                            "px-3 py-2 rounded-lg text-xs transition-all",
                                            active
                                                ? "glass-amber text-primary font-medium shadow-[0_0_12px_-4px_rgba(245,158,11,0.3)]"
                                                : "glass text-muted-foreground hover:text-foreground hover:bg-white/[0.05]",
                                        )}
                                    >
                                        <span className="mr-1">{c.emoji}</span>
                                        {c.label}
                                    </button>
                                );
                            })}
                        </div>
                    </section>

                    <Separator className="opacity-30" />

                    {/* Personal layer toggle */}
                    <section>
                        <p className="text-2xs font-medium uppercase tracking-widest text-muted-foreground mb-3 px-1">
                            Layers
                        </p>
                        <button
                            onClick={onTogglePersonal}
                            className={cn(
                                "w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm transition-all",
                                showPersonal
                                    ? "bg-pink-500/10 border border-pink-500/20 text-pink-400 font-medium"
                                    : "glass text-muted-foreground hover:text-foreground hover:bg-white/[0.05]",
                            )}
                        >
                            {showPersonal ? (
                                <Eye className="h-4 w-4" />
                            ) : (
                                <EyeOff className="h-4 w-4" />
                            )}
                            Lost &amp; Found / Bounties
                            <span className="ml-auto text-xs opacity-60">
                                {"\u{1F3F7}\uFE0F"}
                            </span>
                        </button>
                    </section>
                </div>
            </SheetContent>
        </Sheet>
    );
}
