"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Trophy, Building2, Star, MapPin } from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";

const BADGE_ICONS: Record<string, string> = {
    FIRST_REPORT: "\u{1F947}",
    TEN_REPORTS: "\u{1F4CA}",
    FIFTY_REPORTS: "\u{1F31F}",
    COMMUNITY_HERO: "\u{1F9B8}",
    FAST_RESOLVER: "\u26A1",
    TOP_NGO: "\u{1F3C6}",
    NGO_PARTNER: "\u{1F91D}",
};

const DEFAULT_LOCATION = { lat: 28.6139, lng: 77.209 };

function LoadingRows() {
    return (
        <div className="space-y-1">
            {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3">
                    <Skeleton className="h-5 w-5 rounded" />
                    <Skeleton className="h-9 w-9 rounded-full" />
                    <div className="flex-1 space-y-1.5">
                        <Skeleton className="h-3.5 w-28" />
                        <Skeleton className="h-3 w-20" />
                    </div>
                    <Skeleton className="h-6 w-14 rounded-full" />
                </div>
            ))}
        </div>
    );
}

function EmptyState({ message }: { message: string }) {
    return (
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <div className="h-12 w-12 rounded-2xl glass-amber flex items-center justify-center mb-4">
                <MapPin className="h-5 w-5 text-primary" />
            </div>
            <p className="text-sm text-muted-foreground">{message}</p>
        </div>
    );
}

function useLocation() {
    const [location, setLocation] = useState(DEFAULT_LOCATION);
    const resolved = useRef(false);

    useEffect(() => {
        navigator.geolocation?.getCurrentPosition(
            (pos) => {
                if (!resolved.current) {
                    resolved.current = true;
                    setLocation({
                        lat: pos.coords.latitude,
                        lng: pos.coords.longitude,
                    });
                }
            },
            () => {
                resolved.current = true;
            },
        );
    }, []);

    return location;
}

function useTabData(
    type: "reporters" | "ngos",
    location: { lat: number; lng: number },
) {
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const fetched = useRef(false);

    const load = useCallback(() => {
        if (fetched.current) return;
        fetched.current = true;
        setLoading(true);
        fetch(
            `/api/leaderboard?lat=${location.lat}&lng=${location.lng}&type=${type}`,
        )
            .then((r) => r.json())
            .then((d) => setData(d.entries ?? []))
            .finally(() => setLoading(false));
    }, [type, location.lat, location.lng]);

    // Refetch when location changes
    useEffect(() => {
        fetched.current = false;
    }, [location.lat, location.lng]);

    return { data, loading, load };
}

/* ── Podium (top 3 reporters) ──────────────────────────────────── */

function Podium({ reporters }: { reporters: any[] }) {
    if (reporters.length < 3) return null;

    return (
        <div className="grid grid-cols-3 gap-2 mb-2">
            {[reporters[1], reporters[0], reporters[2]].map((entry, idx) => {
                const rank = [2, 1, 3][idx];
                const isFirst = rank === 1;
                return (
                    <motion.div
                        key={entry.userId}
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.08, duration: 0.4 }}
                    >
                        <Link
                            href={`/profile/${entry.userId}`}
                            className={`flex flex-col items-center text-center p-3 rounded-2xl transition-all duration-200 group ${
                                isFirst
                                    ? "glass-amber glow-sm -mt-2"
                                    : "glass hover:bg-white/[0.05]"
                            }`}
                        >
                            <div className="relative mb-2">
                                <Avatar
                                    size="lg"
                                    className={`ring-2 transition-all ${
                                        isFirst
                                            ? "ring-primary/40 group-hover:ring-primary/60"
                                            : "ring-white/10 group-hover:ring-white/20"
                                    }`}
                                >
                                    <AvatarImage
                                        src={entry.image ?? undefined}
                                    />
                                    <AvatarFallback className="text-xs bg-primary/20 text-primary">
                                        {entry.name?.[0] ?? "U"}
                                    </AvatarFallback>
                                </Avatar>
                                <span className="absolute -top-1 -right-1 text-sm">
                                    {rank === 1
                                        ? "\u{1F947}"
                                        : rank === 2
                                          ? "\u{1F948}"
                                          : "\u{1F949}"}
                                </span>
                            </div>
                            <p className="text-xs font-semibold truncate w-full">
                                {entry.name ?? "Anonymous"}
                            </p>
                            <p className="font-mono text-xs text-primary mt-0.5">
                                {entry.score}
                                <span className="text-primary/60">pt</span>
                            </p>
                        </Link>
                    </motion.div>
                );
            })}
        </div>
    );
}

/* ── Reporter row list ─────────────────────────────────────────── */

function ReporterRows({ reporters }: { reporters: any[] }) {
    const rows = reporters.length >= 3 ? reporters.slice(3) : reporters;
    if (rows.length === 0) return null;

    return (
        <div className="rounded-2xl glass overflow-hidden">
            {rows.map((entry: any, i: number) => (
                <motion.div
                    key={entry.userId}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04 + 0.2, duration: 0.3 }}
                >
                    <Link
                        href={`/profile/${entry.userId}`}
                        className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.04] transition-colors group"
                    >
                        <span className="font-mono text-xs text-muted-foreground w-5 text-right tabular-nums">
                            {entry.rank}
                        </span>
                        <Avatar className="h-8 w-8 ring-1 ring-white/10 group-hover:ring-primary/25 transition-all">
                            <AvatarImage src={entry.image ?? undefined} />
                            <AvatarFallback className="text-2xs bg-primary/15 text-primary">
                                {entry.name?.[0] ?? "U"}
                            </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                                {entry.name ?? "Anonymous"}
                            </p>
                            <p className="text-2xs text-muted-foreground">
                                <span className="font-mono tabular-nums">
                                    {entry.areaReports}
                                </span>{" "}
                                reports{" "}
                                <span className="text-white/20 mx-0.5">/</span>{" "}
                                Trust{" "}
                                <span className="font-mono tabular-nums">
                                    {entry.trustScore}
                                </span>
                            </p>
                        </div>
                        <div className="flex items-center gap-1.5">
                            {entry.badges?.slice(0, 2).map((b: string) => (
                                <span key={b} title={b} className="text-sm">
                                    {BADGE_ICONS[b] ?? "\u{1F396}\uFE0F"}
                                </span>
                            ))}
                            <Badge
                                variant="secondary"
                                className="text-2xs font-mono tabular-nums ml-1 bg-primary/10 text-primary border-primary/15"
                            >
                                {entry.score}
                            </Badge>
                        </div>
                    </Link>
                    {i < rows.length - 1 && (
                        <Separator className="mx-4 w-auto opacity-40" />
                    )}
                </motion.div>
            ))}
        </div>
    );
}

/* ── NGO row list ──────────────────────────────────────────────── */

function NgoRows({ ngos }: { ngos: any[] }) {
    return (
        <div className="rounded-2xl glass overflow-hidden">
            {ngos.map((entry: any, i: number) => (
                <motion.div
                    key={entry.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04, duration: 0.3 }}
                >
                    <div className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.04] transition-colors group">
                        <span className="font-mono text-xs text-muted-foreground w-5 text-right tabular-nums">
                            {entry.rank}
                        </span>
                        <div className="h-9 w-9 rounded-xl bg-purple-500/10 border border-purple-500/15 flex items-center justify-center group-hover:border-purple-500/25 transition-colors">
                            <Building2 className="h-4 w-4 text-purple-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                                {entry.name}
                            </p>
                            <p className="text-2xs text-muted-foreground">
                                <span className="font-mono tabular-nums">
                                    {entry.resolvedCount}
                                </span>{" "}
                                issues resolved
                            </p>
                        </div>
                        <div className="flex items-center gap-1.5">
                            {entry.badges?.slice(0, 2).map((b: string) => (
                                <span key={b} title={b} className="text-sm">
                                    {BADGE_ICONS[b] ?? "\u{1F396}\uFE0F"}
                                </span>
                            ))}
                        </div>
                    </div>
                    {i < ngos.length - 1 && (
                        <Separator className="mx-4 w-auto opacity-40" />
                    )}
                </motion.div>
            ))}
        </div>
    );
}

/* ── Main page ─────────────────────────────────────────────────── */

export default function LeaderboardPage() {
    const location = useLocation();
    const [activeTab, setActiveTab] = useState<"reporters" | "ngos">(
        "reporters",
    );

    const reportersTab = useTabData("reporters", location);
    const ngosTab = useTabData("ngos", location);

    // Eagerly load the active tab; lazy-load the other on first switch
    useEffect(() => {
        reportersTab.load();
    }, [reportersTab.load]);

    useEffect(() => {
        if (activeTab === "ngos") ngosTab.load();
    }, [activeTab, ngosTab.load]);

    return (
        <div className="min-h-screen max-w-lg mx-auto pb-24">
            {/* Header */}
            <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="px-4 pt-8 pb-6"
            >
                <div className="flex items-center gap-3 mb-2">
                    <div className="relative h-10 w-10 rounded-2xl glass-amber flex items-center justify-center">
                        <div className="absolute inset-0 bg-primary/20 rounded-2xl blur-xl" />
                        <Trophy className="h-5 w-5 text-primary relative" />
                    </div>
                    <div>
                        <h1 className="font-display italic text-2xl font-bold tracking-tight">
                            Leaderboard
                        </h1>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            Top contributors in your area this month
                        </p>
                    </div>
                </div>
            </motion.div>

            <Tabs
                defaultValue="reporters"
                className="px-4 !flex-col"
                onValueChange={(v) => setActiveTab(v as "reporters" | "ngos")}
            >
                <TabsList className="w-full !flex-row !flex-nowrap">
                    <TabsTrigger
                        value="reporters"
                        className="flex-1 gap-1.5 data-[active]:bg-primary/15 data-[active]:text-primary data-[active]:border-primary/25"
                    >
                        <Star className="h-3.5 w-3.5" /> Reporters
                    </TabsTrigger>
                    <TabsTrigger
                        value="ngos"
                        className="flex-1 gap-1.5 data-[active]:bg-primary/15 data-[active]:text-primary data-[active]:border-primary/25"
                    >
                        <Building2 className="h-3.5 w-3.5" /> NGOs
                    </TabsTrigger>
                </TabsList>

                {/* --- Reporters Tab --- */}
                <TabsContent value="reporters" className="mt-4">
                    {reportersTab.loading ? (
                        <div className="rounded-2xl glass overflow-hidden">
                            <LoadingRows />
                        </div>
                    ) : reportersTab.data.length === 0 ? (
                        <EmptyState message="No reporters found in your area yet." />
                    ) : (
                        <div className="space-y-3">
                            <Podium reporters={reportersTab.data} />
                            <ReporterRows reporters={reportersTab.data} />
                        </div>
                    )}
                </TabsContent>

                {/* --- NGOs Tab --- */}
                <TabsContent value="ngos" className="mt-4">
                    {ngosTab.loading ? (
                        <div className="rounded-2xl glass overflow-hidden">
                            <LoadingRows />
                        </div>
                    ) : ngosTab.data.length === 0 ? (
                        <EmptyState message="No approved NGOs in your area yet." />
                    ) : (
                        <NgoRows ngos={ngosTab.data} />
                    )}
                </TabsContent>
            </Tabs>
        </div>
    );
}
