"use client";

import { useCallback, useEffect, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Search, ChevronLeft, ChevronRight, Users } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

const ROLE_BADGE: Record<string, { label: string; className: string }> = {
    CITIZEN: {
        label: "Citizen",
        className: "bg-white/[0.05] text-muted-foreground",
    },
    NGO: {
        label: "NGO",
        className: "bg-purple-500/15 text-purple-400 border-purple-500/20",
    },
    ADMIN: {
        label: "Admin",
        className: "bg-primary/15 text-primary border-primary/20",
    },
};

export function AdminUserList() {
    const [users, setUsers] = useState<any[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState("");
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState<string | null>(null);
    const limit = 20;

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                page: page.toString(),
                limit: limit.toString(),
                ...(search && { search }),
            });
            const res = await fetch(`/api/admin/users?${params}`);
            const data = await res.json();
            setUsers(data.users ?? []);
            setTotal(data.total ?? 0);
        } finally {
            setLoading(false);
        }
    }, [page, search]);

    useEffect(() => {
        load();
    }, [load]);

    async function handleRoleChange(userId: string, role: string) {
        setUpdating(userId);
        try {
            const res = await fetch(`/api/admin/users/${userId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ role }),
            });
            if (!res.ok) throw new Error();
            setUsers((prev) =>
                prev.map((u) => (u.id === userId ? { ...u, role } : u)),
            );
            toast.success(`Role updated to ${role}`);
        } catch {
            toast.error("Failed to update role");
        } finally {
            setUpdating(null);
        }
    }

    const totalPages = Math.ceil(total / limit);

    return (
        <div className="space-y-4">
            {/* Search */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Search by name or email..."
                    value={search}
                    onChange={(e) => {
                        setSearch(e.target.value);
                        setPage(1);
                    }}
                    className="pl-9"
                />
            </div>

            {loading ? (
                <div className="space-y-2">
                    {[1, 2, 3, 4].map((i) => (
                        <Skeleton key={i} className="h-14 rounded-lg" />
                    ))}
                </div>
            ) : users.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                    <Users className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No users found.</p>
                </div>
            ) : (
                <>
                    <div className="space-y-1.5">
                        {users.map((user) => {
                            const rb =
                                ROLE_BADGE[user.role] ?? ROLE_BADGE.CITIZEN;
                            return (
                                <div
                                    key={user.id}
                                    className="flex items-center gap-3 p-3 glass rounded-xl"
                                >
                                    <Avatar className="h-8 w-8">
                                        <AvatarImage
                                            src={user.image ?? undefined}
                                        />
                                        <AvatarFallback className="text-xs bg-primary/15 text-primary">
                                            {user.name?.[0] ?? "U"}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium truncate">
                                            {user.name ?? "Anonymous"}
                                        </p>
                                        <p className="text-2xs text-muted-foreground truncate">
                                            {user.email} · Trust{" "}
                                            <span className="font-mono">
                                                {user.trustScore}
                                            </span>{" "}
                                            ·{" "}
                                            <span className="font-mono">
                                                {user.totalReports}
                                            </span>{" "}
                                            reports
                                        </p>
                                    </div>
                                    <Select
                                        value={user.role}
                                        onValueChange={(v) =>
                                            handleRoleChange(user.id, v)
                                        }
                                        disabled={updating === user.id}
                                    >
                                        <SelectTrigger className="w-28 h-7 text-xs">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="CITIZEN">
                                                Citizen
                                            </SelectItem>
                                            <SelectItem value="NGO">
                                                NGO
                                            </SelectItem>
                                            <SelectItem value="ADMIN">
                                                Admin
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            );
                        })}
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="flex items-center justify-between">
                            <p className="text-xs text-muted-foreground">
                                {total} users · Page {page}/{totalPages}
                            </p>
                            <div className="flex gap-1">
                                <Button
                                    variant="outline"
                                    size="icon-sm"
                                    onClick={() =>
                                        setPage((p) => Math.max(1, p - 1))
                                    }
                                    disabled={page <= 1}
                                >
                                    <ChevronLeft className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                    variant="outline"
                                    size="icon-sm"
                                    onClick={() =>
                                        setPage((p) =>
                                            Math.min(totalPages, p + 1),
                                        )
                                    }
                                    disabled={page >= totalPages}
                                >
                                    <ChevronRight className="h-3.5 w-3.5" />
                                </Button>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
