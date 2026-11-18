"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
    MapPin,
    ArrowRight,
    Zap,
    Shield,
    Users,
    CheckCircle2,
    AlertTriangle,
    Droplets,
    Lightbulb,
    Trash2,
    Trees,
    Package,
    Construction,
    LayoutGrid,
    ChevronRight,
    Star,
} from "lucide-react";

function timeAgo(date: string | Date): string {
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
}

const CATEGORIES = [
    {
        icon: Construction,
        label: "Road & Potholes",
        desc: "Damage, potholes, broken roads",
        count: "38%",
    },
    {
        icon: Droplets,
        label: "Water Supply",
        desc: "Leaks, outages, contamination",
        count: "22%",
    },
    {
        icon: Lightbulb,
        label: "Electricity",
        desc: "Outages, broken streetlights",
        count: "14%",
    },
    {
        icon: Trash2,
        label: "Sanitation",
        desc: "Garbage, cleanliness, drains",
        count: "11%",
    },
    {
        icon: Trees,
        label: "Environment",
        desc: "Pollution, fallen trees, pests",
        count: "8%",
    },
    {
        icon: LayoutGrid,
        label: "Public Spaces",
        desc: "Parks, sidewalks, signage",
        count: "5%",
    },
    {
        icon: Package,
        label: "Lost & Found",
        desc: "Report or find lost items",
        count: "1%",
    },
    {
        icon: AlertTriangle,
        label: "Other",
        desc: "Everything else civic",
        count: "1%",
    },
];

const STEPS = [
    {
        num: "01",
        title: "Report",
        desc: "Pin the location, snap a photo, and describe the issue in under a minute.",
        icon: MapPin,
    },
    {
        num: "02",
        title: "Verify",
        desc: "Community members upvote and validate reports to surface real problems.",
        icon: Shield,
    },
    {
        num: "03",
        title: "Resolve",
        desc: "Verified NGOs are assigned issues, upload proof, and close the loop.",
        icon: CheckCircle2,
    },
];

const STATUS_COLORS: Record<string, string> = {
    REPORTED: "#f59e0b",
    VERIFIED: "#3b82f6",
    ASSIGNED: "#8b5cf6",
    RESOLVED: "#22c55e",
};

const CATEGORY_ICONS: Record<string, React.ElementType> = {
    ROAD: Construction,
    WATER: Droplets,
    ELECTRICITY: Lightbulb,
    SANITATION: Trash2,
    ENVIRONMENT: Trees,
    PUBLIC_SPACE: LayoutGrid,
    LOST_FOUND: Package,
    OTHER: AlertTriangle,
};

export default function LandingPage() {
    const { data: session } = useSession();
    const [liveIssues, setLiveIssues] = useState<
        {
            id: string;
            category: string;
            title: string;
            status: string;
            createdAt: string;
        }[]
    >([]);

    useEffect(() => {
        fetch("/api/issues?limit=4&global=true")
            .then((res) => res.json())
            .then((data) => {
                if (data?.issues?.length) setLiveIssues(data.issues);
            })
            .catch(() => {});
    }, []);

    const mapHref = session ? "/map" : "/auth/signin";

    return (
        <div className="min-h-screen bg-background overflow-x-hidden">
            {/* ── Ambient background ── */}
            <div className="fixed inset-0 -z-10 pointer-events-none overflow-hidden">
                <div className="mesh-orb mesh-orb-1" />
                <div className="mesh-orb mesh-orb-2" />
            </div>

            {/* ── Top Navigation ── */}
            <header className="fixed top-0 left-0 right-0 z-50 border-b border-white/[0.06] backdrop-blur-xl bg-background/60">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
                    <Link href="/" className="flex items-center gap-2.5 group">
                        <div className="w-7 h-7 rounded-lg bg-primary/15 border border-primary/25 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                            <MapPin className="w-3.5 h-3.5 text-primary" />
                        </div>
                        <span className="font-display font-[700] text-[15px] tracking-tight text-foreground/90">
                            CiviTrack
                        </span>
                    </Link>

                    <nav className="hidden md:flex items-center gap-6">
                        <Link
                            href="/leaderboard"
                            className="text-[13px] text-muted-foreground hover:text-foreground transition-colors"
                        >
                            Leaderboard
                        </Link>
                        <Link
                            href="/ngos"
                            className="text-[13px] text-muted-foreground hover:text-foreground transition-colors"
                        >
                            NGOs
                        </Link>
                    </nav>

                    <div className="flex items-center gap-3">
                        {session ? (
                            <Link
                                href="/map"
                                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-[13px] font-semibold hover:bg-primary/90 transition-colors"
                            >
                                Open Map
                                <ArrowRight className="w-3.5 h-3.5" />
                            </Link>
                        ) : (
                            <>
                                <Link
                                    href="/auth/signin"
                                    className="text-[13px] text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    Sign in
                                </Link>
                                <Link
                                    href="/auth/signin"
                                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-[13px] font-semibold hover:bg-primary/90 transition-colors"
                                >
                                    Get Started
                                    <ArrowRight className="w-3.5 h-3.5" />
                                </Link>
                            </>
                        )}
                    </div>
                </div>
            </header>

            {/* ── Hero Section ── */}
            <section className="relative min-h-screen flex items-center pt-14">
                {/* Dot grid */}
                <div className="absolute inset-0 dot-grid-bg opacity-60 pointer-events-none" />

                <div className="max-w-7xl mx-auto px-4 sm:px-6 py-20 w-full">
                    <div className="grid lg:grid-cols-[1fr_380px] gap-12 xl:gap-20 items-center">
                        {/* Left: Hero text */}
                        <div>
                            {/* Pill badge */}
                            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/20 bg-primary/8 mb-8 animate-fade-in">
                                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pin-pulse" />
                                <span className="text-[11px] font-mono text-primary/80 uppercase tracking-widest">
                                    Community-powered civic platform
                                </span>
                            </div>

                            {/* Giant headline */}
                            <div className="space-y-1 mb-8">
                                <h1
                                    className="hero-line hero-line-1 font-display font-[800] italic leading-[0.9] tracking-tight"
                                    style={{
                                        fontSize: "clamp(56px, 9vw, 120px)",
                                    }}
                                >
                                    <span className="text-foreground/90">
                                        Report.
                                    </span>
                                </h1>
                                <h1
                                    className="hero-line hero-line-2 font-display font-[800] italic leading-[0.9] tracking-tight"
                                    style={{
                                        fontSize: "clamp(56px, 9vw, 120px)",
                                    }}
                                >
                                    <span className="text-foreground/70">
                                        Verify.
                                    </span>
                                </h1>
                                <h1
                                    className="hero-line hero-line-3 font-display font-[800] italic leading-[0.9] tracking-tight"
                                    style={{
                                        fontSize: "clamp(56px, 9vw, 120px)",
                                    }}
                                >
                                    <span className="text-primary">
                                        Resolve.
                                    </span>
                                </h1>
                            </div>

                            <p
                                className="text-muted-foreground text-[15px] sm:text-[17px] leading-relaxed max-w-md mb-10 animate-fade-up"
                                style={{ animationDelay: "350ms" }}
                            >
                                Your city's problems, tracked from report to
                                resolution. Join thousands building civic
                                accountability together.
                            </p>

                            {/* CTAs */}
                            <div
                                className="flex flex-wrap gap-3 animate-fade-up"
                                style={{ animationDelay: "450ms" }}
                            >
                                <Link
                                    href={mapHref}
                                    className="group inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-primary text-primary-foreground font-semibold text-[14px] hover:bg-primary/90 transition-all hover:shadow-amber-glow"
                                >
                                    Start Reporting
                                    <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                                </Link>
                                <a
                                    href="#how-it-works"
                                    className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl border border-white/10 text-foreground/80 font-medium text-[14px] hover:border-white/20 hover:bg-white/4 transition-all"
                                >
                                    How it works
                                </a>
                            </div>

                            {/* Stats row */}
                            <div className="flex flex-wrap gap-6 mt-12 pt-8 border-t border-white/[0.07]">
                                {[
                                    { val: "2,400+", label: "Issues reported" },
                                    { val: "89%", label: "Resolution rate" },
                                    { val: "47", label: "Active NGOs" },
                                ].map((stat, i) => (
                                    <div
                                        key={stat.label}
                                        className={`stat-in stat-in-${i + 1}`}
                                    >
                                        <div className="font-mono text-2xl font-bold text-foreground tabular-nums">
                                            {stat.val}
                                        </div>
                                        <div className="text-[11px] text-muted-foreground mt-0.5 uppercase tracking-wide">
                                            {stat.label}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Right: Live issues feed */}
                        <div className="hidden lg:block">
                            <div className="glass rounded-2xl overflow-hidden border border-white/[0.08]">
                                {/* Feed header */}
                                <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-primary animate-pin-pulse" />
                                        <span className="text-[11px] font-mono text-muted-foreground uppercase tracking-widest">
                                            Live Issues
                                        </span>
                                    </div>
                                    <Link
                                        href={mapHref}
                                        className="text-[11px] text-primary/70 hover:text-primary flex items-center gap-1 transition-colors"
                                    >
                                        View all{" "}
                                        <ChevronRight className="w-3 h-3" />
                                    </Link>
                                </div>

                                {/* Issue cards */}
                                <div className="divide-y divide-white/[0.05]">
                                    {liveIssues.length === 0 ? (
                                        <div className="px-4 py-8 text-center text-[12px] text-muted-foreground">
                                            No issues reported yet
                                        </div>
                                    ) : (
                                        liveIssues.map((issue, i) => {
                                            const Icon =
                                                CATEGORY_ICONS[
                                                    issue.category
                                                ] ?? AlertTriangle;
                                            const statusColor =
                                                STATUS_COLORS[issue.status] ??
                                                "#6b7280";
                                            return (
                                                <div
                                                    key={issue.id}
                                                    className={`feed-card feed-card-${i + 1} flex items-center gap-3 px-4 py-3.5 hover:bg-white/[0.03] transition-colors`}
                                                >
                                                    <div
                                                        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                                                        style={{
                                                            background: `${statusColor}18`,
                                                        }}
                                                    >
                                                        <Icon
                                                            className="w-3.5 h-3.5"
                                                            style={{
                                                                color: statusColor,
                                                            }}
                                                        />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-[13px] text-foreground/80 truncate leading-tight">
                                                            {issue.title}
                                                        </p>
                                                        <p className="text-[11px] text-muted-foreground mt-0.5">
                                                            {timeAgo(
                                                                issue.createdAt,
                                                            )}
                                                        </p>
                                                    </div>
                                                    <span
                                                        className="text-[10px] font-mono px-1.5 py-0.5 rounded-md border flex-shrink-0"
                                                        style={{
                                                            color: statusColor,
                                                            borderColor: `${statusColor}30`,
                                                            background: `${statusColor}10`,
                                                        }}
                                                    >
                                                        {issue.status.charAt(
                                                            0,
                                                        ) +
                                                            issue.status
                                                                .slice(1)
                                                                .toLowerCase()}
                                                    </span>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>

                                {/* Bottom CTA */}
                                <div className="px-4 py-3 bg-white/[0.02] border-t border-white/[0.05]">
                                    <Link
                                        href={mapHref}
                                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border border-primary/25 bg-primary/8 text-primary text-[12px] font-semibold hover:bg-primary/14 transition-colors"
                                    >
                                        <MapPin className="w-3.5 h-3.5" />
                                        Open interactive map
                                    </Link>
                                </div>
                            </div>

                            {/* Floating trust score card */}
                            <div className="mt-3 glass rounded-xl px-4 py-3 flex items-center gap-3 border border-white/[0.07]">
                                <div className="w-8 h-8 rounded-full bg-primary/15 border border-primary/25 flex items-center justify-center flex-shrink-0">
                                    <Star className="w-3.5 h-3.5 text-primary" />
                                </div>
                                <div>
                                    <p className="text-[12px] text-foreground/80 font-medium">
                                        Earn trust points
                                    </p>
                                    <p className="text-[11px] text-muted-foreground">
                                        Report issues, get upvoted, climb the
                                        leaderboard
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ── Ticker bar ── */}
            <div className="border-y border-white/[0.06] bg-white/[0.015] overflow-hidden py-2.5">
                <div className="animate-ticker whitespace-nowrap inline-block">
                    {Array.from({ length: 2 }).map((_, rep) => (
                        <span key={rep}>
                            {[
                                "Road Damage",
                                "Water Leak",
                                "Power Outage",
                                "Garbage Overflow",
                                "Broken Streetlight",
                                "Pothole",
                                "Drain Blockage",
                                "Fallen Tree",
                                "Noise Pollution",
                                "Illegal Dumping",
                            ].map((item, i) => (
                                <span
                                    key={`${rep}-${i}`}
                                    className="inline-flex items-center gap-3 mx-6 text-[11px] text-muted-foreground uppercase tracking-widest font-mono"
                                >
                                    <span className="w-1 h-1 rounded-full bg-primary/50" />
                                    {item}
                                </span>
                            ))}
                        </span>
                    ))}
                </div>
            </div>

            {/* ── How it works ── */}
            <section id="how-it-works" className="py-24 sm:py-32">
                <div className="max-w-7xl mx-auto px-4 sm:px-6">
                    <div className="mb-14">
                        <p className="text-[11px] font-mono text-primary/70 uppercase tracking-widest mb-3">
                            Process
                        </p>
                        <h2 className="font-display font-[700] italic text-4xl sm:text-5xl text-foreground/90 leading-tight">
                            How it works
                        </h2>
                        <p className="text-muted-foreground mt-3 text-[15px] max-w-md">
                            Three steps from problem to resolution. Powered by
                            community and verified NGOs.
                        </p>
                    </div>

                    <div className="grid sm:grid-cols-3 gap-6">
                        {STEPS.map((step, i) => {
                            const Icon = step.icon;
                            return (
                                <div
                                    key={step.num}
                                    className="relative glass rounded-2xl p-6 border border-white/[0.07] hover:border-white/[0.12] transition-colors group"
                                >
                                    {/* Connector line (desktop) */}
                                    {i < STEPS.length - 1 && (
                                        <div className="hidden sm:block absolute top-9 -right-3 w-6 h-px bg-gradient-to-r from-white/10 to-white/5 z-10" />
                                    )}

                                    <div className="flex items-start gap-4 mb-4">
                                        <span className="font-mono text-[11px] text-primary/60 mt-1">
                                            {step.num}
                                        </span>
                                        <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center group-hover:bg-primary/15 transition-colors">
                                            <Icon
                                                className="w-4.5 h-4.5 text-primary"
                                                style={{
                                                    width: "18px",
                                                    height: "18px",
                                                }}
                                            />
                                        </div>
                                    </div>

                                    <h3 className="font-display font-[700] italic text-2xl text-foreground/90 mb-2">
                                        {step.title}
                                    </h3>
                                    <p className="text-[13px] text-muted-foreground leading-relaxed">
                                        {step.desc}
                                    </p>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </section>

            {/* ── Categories ── */}
            <section className="py-20 sm:py-28 border-t border-white/[0.05]">
                <div className="max-w-7xl mx-auto px-4 sm:px-6">
                    <div className="mb-14">
                        <p className="text-[11px] font-mono text-primary/70 uppercase tracking-widest mb-3">
                            Coverage
                        </p>
                        <h2 className="font-display font-[700] italic text-4xl sm:text-5xl text-foreground/90 leading-tight">
                            What we track
                        </h2>
                        <p className="text-muted-foreground mt-3 text-[15px] max-w-md">
                            Eight issue categories covering every civic concern
                            in your neighborhood.
                        </p>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {CATEGORIES.map((cat) => {
                            const Icon = cat.icon;
                            return (
                                <Link
                                    key={cat.label}
                                    href={mapHref}
                                    className="group glass rounded-xl p-4 border border-white/[0.07] hover:border-primary/20 hover:bg-primary/[0.04] transition-all duration-200"
                                >
                                    <div className="w-9 h-9 rounded-lg bg-white/[0.05] border border-white/[0.08] flex items-center justify-center mb-3 group-hover:bg-primary/10 group-hover:border-primary/20 transition-colors">
                                        <Icon className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                                    </div>
                                    <p className="text-[13px] font-semibold text-foreground/80 group-hover:text-foreground transition-colors leading-tight">
                                        {cat.label}
                                    </p>
                                    <p className="text-[11px] text-muted-foreground mt-1 leading-snug">
                                        {cat.desc}
                                    </p>
                                    <p className="text-[10px] font-mono text-primary/50 mt-2.5">
                                        {cat.count} of reports
                                    </p>
                                </Link>
                            );
                        })}
                    </div>
                </div>
            </section>

            {/* ── Trust & Community ── */}
            <section className="py-20 sm:py-28 border-t border-white/[0.05]">
                <div className="max-w-7xl mx-auto px-4 sm:px-6">
                    <div className="grid md:grid-cols-2 gap-6">
                        {/* Trust score card */}
                        <div className="glass rounded-2xl p-8 border border-white/[0.07] relative overflow-hidden">
                            <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-primary/10 blur-2xl pointer-events-none" />
                            <p className="text-[11px] font-mono text-primary/70 uppercase tracking-widest mb-4">
                                Gamified
                            </p>
                            <h3 className="font-display font-[700] italic text-3xl text-foreground/90 mb-3">
                                Build your trust score
                            </h3>
                            <p className="text-[14px] text-muted-foreground mb-6 leading-relaxed">
                                Every verified report earns you points. Climb
                                the leaderboard, earn badges, and become a
                                recognized civic champion in your city.
                            </p>
                            <div className="grid grid-cols-3 gap-3">
                                {[
                                    { badge: "🔍", label: "First Report" },
                                    { badge: "⚡", label: "10 Reports" },
                                    { badge: "🏆", label: "Top Reporter" },
                                ].map((b) => (
                                    <div
                                        key={b.label}
                                        className="glass-subtle rounded-xl p-3 text-center border border-white/[0.05]"
                                    >
                                        <div className="text-xl mb-1">
                                            {b.badge}
                                        </div>
                                        <div className="text-[10px] text-muted-foreground font-mono">
                                            {b.label}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* NGO network card */}
                        <div className="glass rounded-2xl p-8 border border-white/[0.07] relative overflow-hidden">
                            <div className="absolute -bottom-8 -left-8 w-32 h-32 rounded-full bg-success/10 blur-2xl pointer-events-none" />
                            <p className="text-[11px] font-mono text-primary/70 uppercase tracking-widest mb-4">
                                Network
                            </p>
                            <h3 className="font-display font-[700] italic text-3xl text-foreground/90 mb-3">
                                47 verified NGOs
                            </h3>
                            <p className="text-[14px] text-muted-foreground mb-6 leading-relaxed">
                                Screened and approved organizations receive your
                                reports, assign teams, and upload resolution
                                proof before closing issues.
                            </p>
                            <div className="flex items-center gap-3">
                                <div className="flex -space-x-2">
                                    {[
                                        "#f59e0b",
                                        "#22c55e",
                                        "#3b82f6",
                                        "#8b5cf6",
                                        "#ec4899",
                                    ].map((color, i) => (
                                        <div
                                            key={i}
                                            className="w-8 h-8 rounded-full border-2 border-background flex items-center justify-center text-[10px] font-bold"
                                            style={{
                                                background: `${color}25`,
                                                color,
                                                borderColor:
                                                    "hsl(var(--background))",
                                            }}
                                        >
                                            <Users
                                                style={{
                                                    width: "12px",
                                                    height: "12px",
                                                }}
                                            />
                                        </div>
                                    ))}
                                </div>
                                <Link
                                    href="/ngos"
                                    className="text-[12px] text-primary hover:text-primary/80 flex items-center gap-1 transition-colors"
                                >
                                    View all NGOs{" "}
                                    <ChevronRight className="w-3 h-3" />
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ── Final CTA ── */}
            <section className="py-24 sm:py-32 border-t border-white/[0.05]">
                <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
                    <p className="text-[11px] font-mono text-primary/70 uppercase tracking-widest mb-5">
                        Join the mission
                    </p>
                    <h2 className="font-display font-[800] italic text-4xl sm:text-6xl text-foreground/90 leading-tight mb-6">
                        Your city deserves{" "}
                        <span className="text-primary">better.</span>
                    </h2>
                    <p className="text-muted-foreground text-[16px] mb-10 leading-relaxed max-w-lg mx-auto">
                        Every issue you report brings your community one step
                        closer to resolution. Start making a difference today.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-3 justify-center">
                        <Link
                            href={mapHref}
                            className="group inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-primary text-primary-foreground font-bold text-[15px] hover:bg-primary/90 transition-all hover:shadow-amber-glow"
                        >
                            <Zap className="w-4 h-4" />
                            {session ? "Open the Map" : "Create Free Account"}
                            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                        </Link>
                        <Link
                            href="/leaderboard"
                            className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl border border-white/10 text-foreground/70 font-medium text-[15px] hover:border-white/18 hover:bg-white/4 transition-all"
                        >
                            View Leaderboard
                        </Link>
                    </div>
                </div>
            </section>

            {/* ── Footer ── */}
            <footer className="border-t border-white/[0.05] py-8">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-md bg-primary/15 border border-primary/20 flex items-center justify-center">
                            <MapPin className="w-2.5 h-2.5 text-primary" />
                        </div>
                        <span className="font-display font-[700] italic text-[13px] text-foreground/50">
                            CiviTrack
                        </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground/50 font-mono">
                        Community-powered civic accountability
                    </p>
                    <div className="flex items-center gap-5">
                        {["Leaderboard", "NGOs", "Sign In"].map((item) => (
                            <Link
                                key={item}
                                href={`/${item.toLowerCase().replace(" ", "-")}`}
                                className="text-[11px] text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                            >
                                {item}
                            </Link>
                        ))}
                    </div>
                </div>
            </footer>
        </div>
    );
}
