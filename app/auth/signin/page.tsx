"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    MapPin,
    Zap,
    ArrowRight,
    Construction,
    Droplets,
    Lightbulb,
    Trash2,
    Loader2,
    Eye,
    EyeOff,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

// Demo logins are shown only when NEXT_PUBLIC_ENABLE_DEMO_LOGIN="true".
const DEMO_LOGIN_ENABLED =
    process.env.NEXT_PUBLIC_ENABLE_DEMO_LOGIN === "true";

const DEMO_ACCOUNTS = [
    {
        label: "Citizen",
        email: "demo@civictrack.local",
        password: "demo",
        desc: "Report issues",
    },
    {
        label: "NGO",
        email: "ngo@civictrack.local",
        password: "ngo",
        desc: "Resolve issues",
    },
    {
        label: "Admin",
        email: "admin@civictrack.local",
        password: "admin",
        desc: "Moderate all",
    },
] as const;

const PREVIEW_STATS = [
    { label: "Issues Reported", value: "2,400+" },
    { label: "Resolution Rate", value: "89%" },
    { label: "Active NGOs", value: "47" },
];

export default function SignInPage() {
    const searchParams = useSearchParams();
    const callbackUrl = searchParams.get("callbackUrl") ?? "/map";
    const [mode, setMode] = useState<"signin" | "signup">("signin");
    const [loading, setLoading] = useState<string | null>(null);
    const [showPassword, setShowPassword] = useState(false);

    // Form fields
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    async function handleGoogle() {
        setLoading("google");
        await signIn("google", { callbackUrl });
    }

    async function handleEmailSubmit(e: React.FormEvent) {
        e.preventDefault();

        if (mode === "signup") {
            if (name.trim().length < 2) {
                toast.error("Name must be at least 2 characters");
                return;
            }
            if (password.length < 8) {
                toast.error("Password must be at least 8 characters");
                return;
            }

            setLoading("email");
            try {
                const res = await fetch("/api/auth/signup", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        name: name.trim(),
                        email,
                        password,
                    }),
                });

                if (!res.ok) {
                    const data = await res.json();
                    toast.error(data.error ?? "Signup failed");
                    setLoading(null);
                    return;
                }

                // Auto sign-in after successful signup
                const signInRes = await signIn("credentials", {
                    email,
                    password,
                    callbackUrl,
                    redirect: false,
                });

                if (signInRes?.error) {
                    toast.error(
                        "Account created but sign-in failed. Please sign in manually.",
                    );
                    setMode("signin");
                    setLoading(null);
                } else if (signInRes?.url) {
                    toast.success("Account created!");
                    window.location.href = signInRes.url;
                }
            } catch {
                toast.error("Something went wrong. Please try again.");
                setLoading(null);
            }
        } else {
            // Sign in mode
            if (!email || !password) {
                toast.error("Please enter your email and password");
                return;
            }

            setLoading("email");
            const res = await signIn("credentials", {
                email,
                password,
                callbackUrl,
                redirect: false,
            });

            if (res?.error) {
                setLoading(null);
                toast.error("Invalid email or password");
            } else if (res?.url) {
                window.location.href = res.url;
            }
        }
    }

    async function handleDemo(account: (typeof DEMO_ACCOUNTS)[number]) {
        setLoading(`demo-${account.label}`);
        const res = await signIn("demo-credentials", {
            email: account.email,
            password: account.password,
            callbackUrl,
            redirect: false,
        });
        if (res?.error) {
            setLoading(null);
            toast.error("Demo login failed. Please try again.");
        } else if (res?.url) {
            window.location.href = res.url;
        }
    }

    const isLoading = loading !== null;

    return (
        <div className="min-h-screen bg-background flex">
            {/* ── Left panel — branding ── */}
            <div className="hidden lg:flex flex-col w-[420px] flex-shrink-0 relative overflow-hidden border-r border-white/[0.06]">
                {/* Ambient glow */}
                <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute -top-20 -left-20 w-64 h-64 rounded-full bg-primary/15 blur-3xl" />
                    <div className="absolute bottom-0 right-0 w-48 h-48 rounded-full bg-primary/8 blur-2xl" />
                </div>

                {/* Dot grid */}
                <div className="absolute inset-0 dot-grid-bg opacity-40 pointer-events-none" />

                {/* Content */}
                <div className="relative flex flex-col h-full p-10">
                    {/* Logo */}
                    <Link
                        href="/"
                        className="flex items-center gap-2.5 group w-fit"
                    >
                        <div className="w-8 h-8 rounded-xl bg-primary/15 border border-primary/25 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                            <MapPin className="w-4 h-4 text-primary" />
                        </div>
                        <span className="font-display font-[800] italic text-[17px] text-foreground/90">
                            CiviTrack
                        </span>
                    </Link>

                    {/* Main quote */}
                    <div className="mt-auto mb-auto pt-24">
                        <h2 className="font-display font-[700] italic text-5xl leading-[0.95] text-foreground/90 mb-6">
                            Your city
                            <br />
                            deserves
                            <br />
                            <span className="text-primary">better.</span>
                        </h2>
                        <p className="text-[14px] text-muted-foreground leading-relaxed max-w-[280px]">
                            Community-powered civic issue tracking. From pothole
                            to patch in days, not months.
                        </p>
                    </div>

                    {/* Stats */}
                    <div className="space-y-3 mb-6">
                        {PREVIEW_STATS.map((stat) => (
                            <div
                                key={stat.label}
                                className="flex items-center justify-between py-2.5 border-b border-white/[0.06]"
                            >
                                <span className="text-[12px] text-muted-foreground">
                                    {stat.label}
                                </span>
                                <span className="font-mono text-[13px] font-bold text-foreground/80">
                                    {stat.value}
                                </span>
                            </div>
                        ))}
                    </div>

                    {/* Category pills */}
                    <div className="flex flex-wrap gap-2">
                        {[
                            { Icon: Construction, label: "Roads" },
                            { Icon: Droplets, label: "Water" },
                            { Icon: Lightbulb, label: "Power" },
                            { Icon: Trash2, label: "Sanitation" },
                        ].map(({ Icon, label }) => (
                            <div
                                key={label}
                                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.07] text-[11px] text-muted-foreground"
                            >
                                <Icon className="w-3 h-3 text-primary/60" />
                                {label}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* ── Right panel — form ── */}
            <div className="flex-1 flex items-center justify-center p-6 sm:p-10 relative">
                {/* Mobile logo */}
                <div className="absolute top-6 left-6 lg:hidden">
                    <Link href="/" className="flex items-center gap-2 group">
                        <div className="w-7 h-7 rounded-lg bg-primary/15 border border-primary/25 flex items-center justify-center">
                            <MapPin className="w-3.5 h-3.5 text-primary" />
                        </div>
                        <span className="font-display font-[700] italic text-[14px] text-foreground/80">
                            CiviTrack
                        </span>
                    </Link>
                </div>

                <div className="w-full max-w-[380px]">
                    {/* Heading */}
                    <div className="mb-8">
                        <h1 className="font-display font-[700] italic text-3xl text-foreground/90 mb-2">
                            {mode === "signin" ? "Sign in" : "Create account"}
                        </h1>
                        <p className="text-[14px] text-muted-foreground">
                            {mode === "signin"
                                ? "Access the civic issue map and start making a difference."
                                : "Join the community and start reporting civic issues."}
                        </p>
                    </div>

                    {/* Google */}
                    <button
                        onClick={handleGoogle}
                        disabled={isLoading}
                        className="w-full flex items-center justify-center gap-2.5 h-11 rounded-xl border border-white/10 bg-white/[0.04] text-[14px] font-medium text-foreground/80 hover:bg-white/[0.07] hover:border-white/14 transition-all disabled:opacity-50 mb-5"
                    >
                        <svg
                            className="h-4 w-4 flex-shrink-0"
                            viewBox="0 0 24 24"
                            fill="none"
                        >
                            <path
                                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                fill="#4285F4"
                            />
                            <path
                                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                fill="#34A853"
                            />
                            <path
                                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                                fill="#FBBC05"
                            />
                            <path
                                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                fill="#EA4335"
                            />
                        </svg>
                        {loading === "google"
                            ? "Redirecting..."
                            : "Continue with Google"}
                    </button>

                    {/* Divider */}
                    <div className="relative mb-5">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-white/[0.07]" />
                        </div>
                        <div className="relative flex justify-center">
                            <span className="bg-background px-3 text-[11px] font-mono text-muted-foreground/50 uppercase tracking-widest">
                                or
                            </span>
                        </div>
                    </div>

                    {/* Email + Password form */}
                    <form
                        onSubmit={handleEmailSubmit}
                        className="space-y-3 mb-5"
                    >
                        {mode === "signup" && (
                            <div className="space-y-1.5">
                                <Label className="text-[12px] text-muted-foreground">
                                    Name
                                </Label>
                                <Input
                                    placeholder="Your full name"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    disabled={isLoading}
                                    autoComplete="name"
                                />
                            </div>
                        )}
                        <div className="space-y-1.5">
                            <Label className="text-[12px] text-muted-foreground">
                                Email
                            </Label>
                            <Input
                                type="email"
                                placeholder="you@example.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                disabled={isLoading}
                                autoComplete="email"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-[12px] text-muted-foreground">
                                Password
                            </Label>
                            <div className="relative">
                                <Input
                                    type={showPassword ? "text" : "password"}
                                    placeholder={
                                        mode === "signup"
                                            ? "At least 8 characters"
                                            : "Your password"
                                    }
                                    value={password}
                                    onChange={(e) =>
                                        setPassword(e.target.value)
                                    }
                                    disabled={isLoading}
                                    autoComplete={
                                        mode === "signup"
                                            ? "new-password"
                                            : "current-password"
                                    }
                                    className="pr-10"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword((v) => !v)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                                    tabIndex={-1}
                                >
                                    {showPassword ? (
                                        <EyeOff className="h-4 w-4" />
                                    ) : (
                                        <Eye className="h-4 w-4" />
                                    )}
                                </button>
                            </div>
                        </div>
                        <Button
                            type="submit"
                            className="w-full gap-2"
                            disabled={isLoading}
                        >
                            {loading === "email" ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <ArrowRight className="h-4 w-4" />
                            )}
                            {mode === "signin" ? "Sign in" : "Create account"}
                        </Button>
                    </form>

                    {/* Toggle mode */}
                    <p className="text-[13px] text-center text-muted-foreground mb-6">
                        {mode === "signin" ? (
                            <>
                                Don&apos;t have an account?{" "}
                                <button
                                    onClick={() => setMode("signup")}
                                    className="text-primary hover:underline font-medium"
                                >
                                    Sign up
                                </button>
                            </>
                        ) : (
                            <>
                                Already have an account?{" "}
                                <button
                                    onClick={() => setMode("signin")}
                                    className="text-primary hover:underline font-medium"
                                >
                                    Sign in
                                </button>
                            </>
                        )}
                    </p>

                    {/* Terms */}
                    <p className="text-[11px] text-center text-muted-foreground/40 mb-6">
                        By continuing you agree to our Terms of Service and
                        Privacy Policy.
                    </p>

                    {DEMO_LOGIN_ENABLED && (
                        <>
                    {/* Demo divider */}
                    <div className="relative mb-4">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-white/[0.07]" />
                        </div>
                        <div className="relative flex justify-center">
                            <span className="bg-background px-3 text-[11px] font-mono text-muted-foreground/50 uppercase tracking-widest">
                                demo
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-1.5 justify-center mb-3">
                        <Zap className="w-3 h-3 text-primary/60" />
                        <p className="text-[12px] text-muted-foreground/60">
                            Quick access — no account required
                        </p>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                        {DEMO_ACCOUNTS.map((account) => (
                            <button
                                key={account.label}
                                onClick={() => handleDemo(account)}
                                disabled={isLoading}
                                className="group flex flex-col items-center py-3 px-2 rounded-xl border border-white/[0.08] bg-white/[0.03] hover:border-primary/20 hover:bg-primary/[0.06] transition-all disabled:opacity-50"
                            >
                                <span className="text-[12px] font-semibold text-foreground/75 group-hover:text-foreground transition-colors">
                                    {loading === `demo-${account.label}`
                                        ? "..."
                                        : account.label}
                                </span>
                                <span className="text-[10px] text-muted-foreground/50 mt-0.5 font-mono">
                                    {account.desc}
                                </span>
                            </button>
                        ))}
                    </div>
                        </>
                    )}

                    {/* Back link */}
                    <div className="mt-8 text-center">
                        <Link
                            href="/"
                            className="text-[12px] text-muted-foreground/40 hover:text-muted-foreground transition-colors flex items-center justify-center gap-1"
                        >
                            ← Back to home
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
