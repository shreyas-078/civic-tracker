import { useEffect, useState, useCallback } from "react";
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
    Colors,
    Radius,
    FontSize,
    CategoryLabels,
    StatusLabels,
    StatusColors,
} from "@/constants/theme";
import { api } from "@/lib/api";
import { useAuth } from "@/stores/auth";

type Tab = "flagged" | "ngos" | "issues";

type FlaggedIssue = {
    id: string;
    title: string;
    category: string;
    status: string;
    flagCount: number;
    createdAt: string;
};

type PendingNGO = {
    id: string;
    name: string;
    description: string;
    categories: string[];
    createdAt: string;
    user: { id: string; name: string; email: string };
};

type AdminIssue = {
    id: string;
    title: string;
    status: string;
    category: string;
    upvotes: number;
    isFlagged: boolean;
    createdAt: string;
    reporter: { name: string; email: string };
};

export default function AdminScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { user } = useAuth();
    const [tab, setTab] = useState<Tab>("flagged");
    const [flagged, setFlagged] = useState<FlaggedIssue[]>([]);
    const [ngos, setNgos] = useState<PendingNGO[]>([]);
    const [issues, setIssues] = useState<AdminIssue[]>([]);
    const [loading, setLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    useEffect(() => {
        if (user?.role !== "ADMIN") {
            router.replace("/(tabs)");
        }
    }, [user]);

    const fetchTab = useCallback(async (t: Tab) => {
        setLoading(true);
        try {
            if (t === "flagged") {
                const data = await api("/api/admin/flagged");
                setFlagged(data.issues ?? []);
            } else if (t === "ngos") {
                const data = await api("/api/admin/ngos");
                setNgos(data.ngos ?? []);
            } else if (t === "issues") {
                const data = await api("/api/admin/issues");
                setIssues(data.issues ?? []);
            }
        } catch (e: any) {
            Alert.alert("Error", e.message ?? "Failed to load data");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchTab(tab);
    }, [tab]);

    // ── Flagged actions ──────────────────────────────────────────────────
    const handleUnflag = async (id: string) => {
        setActionLoading(id + "_unflag");
        try {
            await api(`/api/admin/flagged/${id}`, { method: "PATCH" });
            setFlagged((p) => p.filter((i) => i.id !== id));
        } catch (e: any) {
            Alert.alert("Error", e.message ?? "Failed to unflag");
        } finally {
            setActionLoading(null);
        }
    };

    const handleCloseIssue = (id: string, title: string, source: "flagged" | "issues") => {
        Alert.alert("Close Issue", `Close "${title}"?`, [
            { text: "Cancel", style: "cancel" },
            {
                text: "Close",
                style: "destructive",
                onPress: async () => {
                    setActionLoading(id + "_close");
                    try {
                        await api(`/api/admin/flagged/${id}`, { method: "DELETE" });
                        if (source === "flagged") setFlagged((p) => p.filter((i) => i.id !== id));
                        else setIssues((p) => p.filter((i) => i.id !== id));
                    } catch (e: any) {
                        Alert.alert("Error", e.message ?? "Failed to close issue");
                    } finally {
                        setActionLoading(null);
                    }
                },
            },
        ]);
    };

    // ── NGO actions ──────────────────────────────────────────────────────
    const handleNGOAction = async (id: string, action: "APPROVE" | "REJECT") => {
        Alert.alert(
            action === "APPROVE" ? "Approve NGO" : "Reject NGO",
            action === "APPROVE"
                ? "Approve this NGO? They will be able to claim and resolve issues."
                : "Reject this NGO application?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: action === "APPROVE" ? "Approve" : "Reject",
                    style: action === "APPROVE" ? "default" : "destructive",
                    onPress: async () => {
                        setActionLoading(id + "_" + action);
                        try {
                            await api(`/api/admin/ngos/${id}/approve`, {
                                method: "PATCH",
                                body: { action },
                            });
                            setNgos((p) => p.filter((n) => n.id !== id));
                        } catch (e: any) {
                            Alert.alert("Error", e.message ?? "Action failed");
                        } finally {
                            setActionLoading(null);
                        }
                    },
                },
            ],
        );
    };

    // ── Renderers ────────────────────────────────────────────────────────
    const renderFlagged = ({ item }: { item: FlaggedIssue }) => {
        const isActing = actionLoading?.startsWith(item.id);
        return (
            <TouchableOpacity
                style={styles.card}
                onPress={() => router.push(`/issues/${item.id}` as any)}
                activeOpacity={0.8}
            >
                <View style={styles.cardHeader}>
                    <View style={styles.flagBadge}>
                        <Ionicons name="flag" size={11} color={Colors.destructive} />
                        <Text style={styles.flagCount}>{item.flagCount} flags</Text>
                    </View>
                    <Text style={styles.cardMeta}>
                        {CategoryLabels[item.category] ?? item.category}
                    </Text>
                    <View style={[styles.statusDot, { backgroundColor: StatusColors[item.status] ?? Colors.mutedText }]} />
                </View>
                <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
                <View style={styles.actions}>
                    <TouchableOpacity
                        style={styles.approveBtn}
                        onPress={() => handleUnflag(item.id)}
                        disabled={!!isActing}
                    >
                        {actionLoading === item.id + "_unflag" ? (
                            <ActivityIndicator size="small" color={Colors.success} />
                        ) : (
                            <Text style={styles.approveBtnText}>Unflag</Text>
                        )}
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.rejectBtn}
                        onPress={() => handleCloseIssue(item.id, item.title, "flagged")}
                        disabled={!!isActing}
                    >
                        {actionLoading === item.id + "_close" ? (
                            <ActivityIndicator size="small" color={Colors.destructive} />
                        ) : (
                            <Text style={styles.rejectBtnText}>Close</Text>
                        )}
                    </TouchableOpacity>
                </View>
            </TouchableOpacity>
        );
    };

    const renderNGO = ({ item }: { item: PendingNGO }) => {
        const isActing = actionLoading?.startsWith(item.id);
        return (
            <View style={styles.card}>
                <Text style={styles.cardTitle}>{item.name}</Text>
                <Text style={styles.cardMeta}>{item.user.name} · {item.user.email}</Text>
                {item.categories?.length > 0 && (
                    <Text style={styles.cardMeta}>
                        {item.categories.map((c) => CategoryLabels[c] ?? c).join(", ")}
                    </Text>
                )}
                {item.description ? (
                    <Text style={styles.cardDesc} numberOfLines={3}>{item.description}</Text>
                ) : null}
                <View style={styles.actions}>
                    <TouchableOpacity
                        style={styles.approveBtn}
                        onPress={() => handleNGOAction(item.id, "APPROVE")}
                        disabled={!!isActing}
                    >
                        {actionLoading === item.id + "_APPROVE" ? (
                            <ActivityIndicator size="small" color={Colors.success} />
                        ) : (
                            <Text style={styles.approveBtnText}>Approve</Text>
                        )}
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.rejectBtn}
                        onPress={() => handleNGOAction(item.id, "REJECT")}
                        disabled={!!isActing}
                    >
                        {actionLoading === item.id + "_REJECT" ? (
                            <ActivityIndicator size="small" color={Colors.destructive} />
                        ) : (
                            <Text style={styles.rejectBtnText}>Reject</Text>
                        )}
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    const renderIssue = ({ item }: { item: AdminIssue }) => {
        const isActing = actionLoading?.startsWith(item.id);
        return (
            <TouchableOpacity
                style={[styles.card, item.isFlagged && styles.cardFlagged]}
                onPress={() => router.push(`/issues/${item.id}` as any)}
                activeOpacity={0.8}
            >
                <View style={styles.cardHeader}>
                    <View style={[styles.statusDot, { backgroundColor: StatusColors[item.status] ?? Colors.mutedText }]} />
                    <Text style={styles.cardMeta}>{StatusLabels[item.status] ?? item.status}</Text>
                    <Text style={styles.cardMeta}>· {item.upvotes} votes</Text>
                    {item.isFlagged && (
                        <Ionicons name="flag" size={12} color={Colors.destructive} />
                    )}
                </View>
                <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
                <Text style={styles.cardMeta}>{item.reporter?.name} · {CategoryLabels[item.category] ?? item.category}</Text>
                <TouchableOpacity
                    style={[styles.rejectBtn, { alignSelf: "flex-start" }]}
                    onPress={() => handleCloseIssue(item.id, item.title, "issues")}
                    disabled={!!isActing}
                >
                    {actionLoading === item.id + "_close" ? (
                        <ActivityIndicator size="small" color={Colors.destructive} />
                    ) : (
                        <Text style={styles.rejectBtnText}>Close Issue</Text>
                    )}
                </TouchableOpacity>
            </TouchableOpacity>
        );
    };

    const tabData = tab === "flagged" ? flagged : tab === "ngos" ? ngos : issues;
    const tabRenderer = tab === "flagged" ? renderFlagged : tab === "ngos" ? renderNGO : renderIssue;

    const TABS: { key: Tab; label: string; icon: string; badge?: number }[] = [
        { key: "flagged", label: "Flagged", icon: "flag", badge: flagged.length || undefined },
        { key: "ngos", label: "NGOs", icon: "business", badge: ngos.length || undefined },
        { key: "issues", label: "Issues", icon: "list" },
    ];

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace("/(tabs)")}>
                    <Ionicons name="arrow-back" size={22} color={Colors.foreground} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Admin Panel</Text>
                <TouchableOpacity onPress={() => fetchTab(tab)} disabled={loading}>
                    <Ionicons name="refresh" size={20} color={loading ? Colors.mutedText : Colors.primary} />
                </TouchableOpacity>
            </View>

            {/* Tabs */}
            <View style={styles.tabBar}>
                {TABS.map((t) => (
                    <TouchableOpacity
                        key={t.key}
                        style={[styles.tabItem, tab === t.key && styles.tabItemActive]}
                        onPress={() => setTab(t.key)}
                    >
                        <Ionicons
                            name={t.icon as any}
                            size={16}
                            color={tab === t.key ? Colors.primary : Colors.mutedText}
                        />
                        <Text style={[styles.tabLabel, tab === t.key && styles.tabLabelActive]}>
                            {t.label}
                        </Text>
                        {!!t.badge && (
                            <View style={styles.badge}>
                                <Text style={styles.badgeText}>{t.badge}</Text>
                            </View>
                        )}
                    </TouchableOpacity>
                ))}
            </View>

            {loading ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={Colors.primary} />
                </View>
            ) : (
                <FlatList
                    data={tabData as any[]}
                    keyExtractor={(item) => item.id}
                    renderItem={tabRenderer as any}
                    contentContainerStyle={styles.list}
                    showsVerticalScrollIndicator={false}
                    ListEmptyComponent={
                        <View style={styles.empty}>
                            <Ionicons name="checkmark-done-circle-outline" size={48} color={Colors.mutedText} />
                            <Text style={styles.emptyText}>
                                {tab === "flagged" ? "No flagged content" : tab === "ngos" ? "No pending NGO applications" : "No active issues"}
                            </Text>
                        </View>
                    }
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    header: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
        gap: 12,
    },
    headerTitle: {
        flex: 1,
        fontSize: FontSize["2xl"],
        fontWeight: "700",
        color: Colors.foreground,
    },
    tabBar: {
        flexDirection: "row",
        backgroundColor: Colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
    },
    tabItem: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 12,
        gap: 5,
        borderBottomWidth: 2,
        borderBottomColor: "transparent",
    },
    tabItemActive: {
        borderBottomColor: Colors.primary,
    },
    tabLabel: {
        fontSize: FontSize.xs,
        fontWeight: "500",
        color: Colors.mutedText,
    },
    tabLabelActive: {
        color: Colors.primary,
        fontWeight: "600",
    },
    badge: {
        backgroundColor: Colors.destructive,
        borderRadius: Radius.full,
        minWidth: 16,
        height: 16,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 4,
    },
    badgeText: {
        color: Colors.white,
        fontSize: 9,
        fontWeight: "700",
    },
    center: { flex: 1, justifyContent: "center", alignItems: "center" },
    list: { padding: 16, gap: 10 },
    card: {
        backgroundColor: Colors.card,
        borderRadius: Radius.xl,
        borderWidth: 1,
        borderColor: Colors.border,
        padding: 14,
        gap: 8,
        marginBottom: 8,
    },
    cardFlagged: {
        borderColor: "rgba(239,68,68,0.25)",
    },
    cardHeader: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
    },
    statusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    flagBadge: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        backgroundColor: Colors.destructiveDim,
        paddingHorizontal: 7,
        paddingVertical: 3,
        borderRadius: Radius.full,
    },
    flagCount: {
        color: Colors.destructive,
        fontSize: FontSize["2xs"],
        fontWeight: "700",
    },
    cardTitle: {
        color: Colors.foreground,
        fontSize: FontSize.base,
        fontWeight: "500",
        lineHeight: 20,
    },
    cardMeta: {
        color: Colors.mutedText,
        fontSize: FontSize.xs,
    },
    cardDesc: {
        color: Colors.secondaryText,
        fontSize: FontSize.xs,
        lineHeight: 18,
    },
    actions: {
        flexDirection: "row",
        gap: 10,
        marginTop: 4,
    },
    approveBtn: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: Colors.successDim,
        borderRadius: Radius.lg,
        paddingVertical: 9,
        minHeight: 36,
    },
    approveBtnText: {
        color: Colors.success,
        fontSize: FontSize.sm,
        fontWeight: "600",
    },
    rejectBtn: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: Colors.destructiveDim,
        borderRadius: Radius.lg,
        paddingVertical: 9,
        minHeight: 36,
    },
    rejectBtnText: {
        color: Colors.destructive,
        fontSize: FontSize.sm,
        fontWeight: "600",
    },
    empty: { alignItems: "center", paddingTop: 80, gap: 12 },
    emptyText: { color: Colors.mutedText, fontSize: FontSize.base },
});
