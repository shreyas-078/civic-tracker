"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import {
    Map,
    Trophy,
    Building2,
    User,
    LogIn,
    Shield,
    Smartphone,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

const NAV_ITEMS = [
    { href: "/map", label: "Map", icon: Map },
    { href: "/leaderboard", label: "Leaders", icon: Trophy },
    { href: "/ngos", label: "NGOs", icon: Building2 },
];

// Pages that should never show the bottom nav
const HIDDEN_ON = ["/", "/auth"];

export function BottomNav() {
    const pathname = usePathname();
    const { data: session } = useSession();

    // Hide on landing page and auth pages
    const shouldHide = HIDDEN_ON.some((path) =>
        path === "/" ? pathname === "/" : pathname.startsWith(path),
    );
    if (shouldHide) return null;

    return (
        <nav className="fixed bottom-0 left-0 right-0 z-40 pb-safe">
            <div className="mx-auto max-w-lg px-3 pb-2 pt-1">
                <div
                    className="rounded-2xl border border-white/[0.08] overflow-hidden"
                    style={{
                        background: "rgba(12, 10, 7, 0.88)",
                        backdropFilter: "blur(24px)",
                        WebkitBackdropFilter: "blur(24px)",
                        boxShadow:
                            "0 -1px 0 0 rgba(255,255,255,0.04), 0 8px 40px -8px rgba(0,0,0,0.6)",
                    }}
                >
                    <div className="flex items-center justify-around px-1 py-1.5">
                        {/* Regular nav items */}
                        {NAV_ITEMS.map((item) => {
                            const Icon = item.icon;
                            const isActive = pathname.startsWith(item.href);
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={cn(
                                        "relative flex flex-col items-center gap-0.5 px-4 py-2 rounded-xl transition-all duration-200 min-w-0",
                                        isActive
                                            ? "text-primary"
                                            : "text-muted-foreground hover:text-foreground/70",
                                    )}
                                >
                                    {isActive && (
                                        <motion.div
                                            layoutId="nav-indicator"
                                            className="absolute inset-0 rounded-xl"
                                            style={{
                                                background:
                                                    "rgba(245,158,11,0.1)",
                                            }}
                                            transition={{
                                                type: "spring",
                                                stiffness: 400,
                                                damping: 32,
                                            }}
                                        />
                                    )}
                                    <Icon
                                        className={cn(
                                            "h-5 w-5 relative z-10",
                                            isActive &&
                                                "drop-shadow-[0_0_6px_rgba(245,158,11,0.5)]",
                                        )}
                                    />
                                    <span className="text-[10px] font-medium leading-tight relative z-10">
                                        {item.label}
                                    </span>
                                </Link>
                            );
                        })}

                        {/* Get the mobile app (reporting moved to mobile) */}
                        {session && (
                            <Link
                                href="/report"
                                className="relative flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl transition-all duration-200 text-muted-foreground hover:text-foreground/70"
                            >
                                <div className="w-7 h-7 rounded-lg flex items-center justify-center relative z-10 transition-colors bg-white/[0.07] border border-white/[0.1]">
                                    <Smartphone className="h-4 w-4" />
                                </div>
                                <span className="text-[10px] font-medium leading-tight relative z-10">
                                    Report
                                </span>
                            </Link>
                        )}

                        {/* Profile / auth */}
                        {session ? (
                            <DropdownMenu>
                                <DropdownMenuTrigger
                                    render={
                                        <button className="flex flex-col items-center gap-0.5 px-4 py-2 rounded-xl transition-colors hover:bg-white/[0.05]" />
                                    }
                                >
                                    <Avatar className="h-5 w-5 ring-1 ring-white/10">
                                        <AvatarImage
                                            src={
                                                session.user?.image ?? undefined
                                            }
                                        />
                                        <AvatarFallback className="text-[8px] bg-primary/20 text-primary">
                                            {session.user?.name?.[0] ?? "U"}
                                        </AvatarFallback>
                                    </Avatar>
                                    <span className="text-[10px] font-medium leading-tight text-muted-foreground">
                                        Profile
                                    </span>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent
                                    align="end"
                                    className="mb-2 rounded-xl border-white/[0.09]"
                                    style={{
                                        background: "rgba(14, 12, 9, 0.95)",
                                        backdropFilter: "blur(24px)",
                                    }}
                                >
                                    <DropdownMenuItem
                                        render={
                                            <Link
                                                href={`/profile/${session.user.id}`}
                                                className="gap-2"
                                            />
                                        }
                                    >
                                        <User className="h-4 w-4" /> My Profile
                                    </DropdownMenuItem>

                                    {(session.user as any).role === "ADMIN" && (
                                        <DropdownMenuItem
                                            render={
                                                <Link
                                                    href="/admin"
                                                    className="gap-2"
                                                />
                                            }
                                        >
                                            <Shield className="h-4 w-4" /> Admin
                                        </DropdownMenuItem>
                                    )}
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                        onClick={() =>
                                            signOut({ callbackUrl: "/" })
                                        }
                                    >
                                        Sign out
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        ) : (
                            <Link
                                href="/auth/signin"
                                className="flex flex-col items-center gap-0.5 px-4 py-2 rounded-xl text-muted-foreground hover:text-foreground/70 hover:bg-white/[0.05] transition-all"
                            >
                                <LogIn className="h-5 w-5" />
                                <span className="text-[10px] font-medium leading-tight">
                                    Sign In
                                </span>
                            </Link>
                        )}
                    </div>
                </div>
            </div>
        </nav>
    );
}
