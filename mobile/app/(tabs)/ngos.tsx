import { useEffect, useState, useCallback } from "react";
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    ActivityIndicator,
    Platform,
    Linking,
    Alert,
    RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { formatDistanceToNow } from "date-fns";
import {
    Colors,
    CategoryEmoji,
    CategoryLabels,
    StatusColors,
    Radius,
    FontSize,
} from "@/constants/theme";
import { useAuth } from "@/stores/auth";
import { api } from "@/lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────

interface NGOListItem {
    id: string;
    name: string;
    description: string;
    website?: string | null;
    phone?: string | null;
    categories: string[];
    resolvedCount: number;
    user: { id: string; name?: string | null; image?: string | null };
}

interface IssueItem {
    id: string;
    title: string;
    category: string;
    status: string;
    priority: number;
    address?: string | null;
    lat: number;
    lng: number;
    upvotes: number;
    createdAt: string;
    deadline?: string | null;
    imageUrls: string[];
    reporter: { id: string; name?: string | null };
}

// ─── NGO Directory (for non-NGO users) ────────────────────────────────────────

function NGODirectory() {
    const [ngos, setNgos] = useState<NGOListItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await api("/api/ngos");
            setNgos(data.ngos ?? []);
        } catch (err: any) {
            setError(err.message ?? "Failed to load NGOs");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const renderNGO = ({ item }: { item: NGOListItem }) => (
        <View style={styles.ngoCard}>
            <View style={styles.ngoHeader}>
                <View style={styles.ngoAvatar}>
                    <Ionicons name="business" size={20} color={Colors.primary} />
                </View>
                <View style={styles.ngoHeaderInfo}>
                    <Text style={styles.ngoName}>{item.name}</Text>
                    <View style={styles.verifiedRow}>
                        <Ionicons name="checkmark-circle" size={12} color={Colors.success} />
                        <Text style={styles.verifiedText}>Verified</Text>
                    </View>
                </View>
                <View style={styles.resolvedBadge}>
                    <Text style={styles.resolvedCount}>{item.resolvedCount}</Text>
                    <Text style={styles.resolvedLabel}>resolved</Text>
                </View>
            </View>

            <Text style={styles.ngoDescription} numberOfLines={2}>
                {item.description}
            </Text>

            <View style={styles.categoriesRow}>
                {item.categories.slice(0, 4).map((cat) => (
                    <View key={cat} style={styles.categoryTag}>
                        <Text style={styles.categoryTagText}>
                            {CategoryEmoji[cat] ?? "📌"} {CategoryLabels[cat] ?? cat}
                        </Text>
                    </View>
                ))}
            </View>

            {(item.website || item.phone) && (
                <View style={styles.contactRow}>
                    {item.website && (
                        <TouchableOpacity
                            style={styles.contactBtn}
                            onPress={() => Linking.openURL(item.website!)}
                        >
                            <Ionicons name="globe-outline" size={14} color={Colors.primary} />
                            <Text style={styles.contactText}>Website</Text>
                        </TouchableOpacity>
                    )}
                    {item.phone && (
                        <TouchableOpacity
                            style={styles.contactBtn}
                            onPress={() => Linking.openURL(`tel:${item.phone}`)}
                        >
                            <Ionicons name="call-outline" size={14} color={Colors.primary} />
                            <Text style={styles.contactText}>Call</Text>
                        </TouchableOpacity>
                    )}
                </View>
            )}
        </View>
    );

    if (loading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color={Colors.primary} />
            </View>
        );
    }

    if (error) {
        return (
            <View style={styles.empty}>
                <Ionicons name="alert-circle-outline" size={48} color={Colors.destructive} />
                <Text style={styles.emptyText}>{error}</Text>
                <TouchableOpacity style={styles.retryBtn} onPress={load}>
                    <Text style={styles.retryText}>Retry</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <FlatList
            data={ngos}
            keyExtractor={(item) => item.id}
            renderItem={renderNGO}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            refreshControl={
                <RefreshControl
                    refreshing={loading}
                    onRefresh={load}
                    tintColor={Colors.primary}
                />
            }
            ListEmptyComponent={
                <View style={styles.empty}>
                    <Ionicons name="business-outline" size={48} color={Colors.mutedText} />
                    <Text style={styles.emptyText}>No NGOs found</Text>
                </View>
            }
        />
    );
}

// ─── NGO Dashboard (for NGO role users) ──────────────────────────────────────

function NGODashboard() {
    const router = useRouter();
    const [tab, setTab] = useState<"available" | "assigned">("available");
    const [availableIssues, setAvailableIssues] = useState<IssueItem[]>([]);
    const [assignedIssues, setAssignedIssues] = useState<IssueItem[]>([]);
    const [ngoId, setNgoId] = useState<string | null>(null);
    const [categories, setCategories] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [claimingId, setClaimingId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        setError(null);
        try {
            const [availRes, assignRes] = await Promise.all([
                api("/api/ngos/issues?type=available"),
                api("/api/ngos/issues?type=assigned"),
            ]);
            setAvailableIssues(availRes.issues ?? []);
            setAssignedIssues(assignRes.issues ?? []);
            setNgoId(availRes.ngoId ?? assignRes.ngoId ?? null);
            setCategories(availRes.categories ?? []);
        } catch (err: any) {
            setError(err.message ?? "Failed to load issues");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        load(true);
    }, [load]);

    useEffect(() => {
        load();
    }, [load]);

    const handleClaim = async (issueId: string, issueTitle: string) => {
        Alert.alert(
            "Claim Issue",
            `Take responsibility for resolving:\n"${issueTitle}"?`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Claim",
                    onPress: async () => {
                        setClaimingId(issueId);
                        try {
                            await api(`/api/issues/${issueId}/status`, {
                                method: "PATCH",
                                body: { status: "ASSIGNED" },
                            });
                            Alert.alert(
                                "Claimed!",
                                "The issue has been assigned to your NGO.",
                            );
                            await load(true);
                        } catch (err: any) {
                            Alert.alert(
                                "Error",
                                err.message ?? "Failed to claim issue",
                            );
                        } finally {
                            setClaimingId(null);
                        }
                    },
                },
            ],
        );
    };

    const renderIssueCard = ({
        item,
        showClaim,
    }: {
        item: IssueItem;
        showClaim: boolean;
    }) => {
        const isOverdue =
            item.deadline && new Date(item.deadline) < new Date();
        const statusColor = StatusColors[item.status] ?? Colors.primary;

        return (
            <TouchableOpacity
                style={styles.issueCard}
                onPress={() => router.push(`/issues/${item.id}`)}
                activeOpacity={0.75}
            >
                <View style={styles.issueCardTop}>
                    <View style={styles.issueMeta}>
                        <Text style={styles.issueCategoryEmoji}>
                            {CategoryEmoji[item.category] ?? "📌"}
                        </Text>
                        <Text style={styles.issueCategoryLabel}>
                            {CategoryLabels[item.category] ?? item.category}
                        </Text>
                        <View
                            style={[
                                styles.statusDot,
                                { backgroundColor: statusColor },
                            ]}
                        />
                    </View>
                    {item.priority >= 7 && (
                        <View style={styles.highPriorityBadge}>
                            <Ionicons
                                name="alert-circle"
                                size={10}
                                color="#ef4444"
                            />
                            <Text style={styles.highPriorityText}>High</Text>
                        </View>
                    )}
                </View>

                <Text style={styles.issueTitle} numberOfLines={2}>
                    {item.title}
                </Text>

                {item.address && (
                    <View style={styles.addressRow}>
                        <Ionicons
                            name="location-outline"
                            size={12}
                            color={Colors.mutedText}
                        />
                        <Text style={styles.addressText} numberOfLines={1}>
                            {item.address}
                        </Text>
                    </View>
                )}

                <View style={styles.issueCardBottom}>
                    <View style={styles.issueStats}>
                        <Ionicons
                            name="arrow-up"
                            size={12}
                            color={Colors.mutedText}
                        />
                        <Text style={styles.issueStatText}>{item.upvotes}</Text>
                        <Text style={styles.issueDot}>·</Text>
                        <Text style={styles.issueStatText}>
                            {formatDistanceToNow(new Date(item.createdAt), {
                                addSuffix: true,
                            })}
                        </Text>
                    </View>

                    {item.deadline && (
                        <Text
                            style={[
                                styles.deadlineText,
                                isOverdue && { color: Colors.destructive },
                            ]}
                        >
                            {isOverdue ? "⚠ Overdue" : "Due "}
                            {!isOverdue &&
                                formatDistanceToNow(new Date(item.deadline), {
                                    addSuffix: true,
                                })}
                        </Text>
                    )}
                </View>

                {showClaim && (
                    <TouchableOpacity
                        style={[
                            styles.claimBtn,
                            claimingId === item.id && styles.claimBtnDisabled,
                        ]}
                        onPress={() => handleClaim(item.id, item.title)}
                        disabled={claimingId === item.id}
                    >
                        {claimingId === item.id ? (
                            <ActivityIndicator
                                size="small"
                                color={Colors.primaryForeground}
                            />
                        ) : (
                            <>
                                <Ionicons
                                    name="hand-right"
                                    size={14}
                                    color={Colors.primaryForeground}
                                />
                                <Text style={styles.claimBtnText}>
                                    Claim Issue
                                </Text>
                            </>
                        )}
                    </TouchableOpacity>
                )}

                {!showClaim && (
                    <View style={styles.viewIssueRow}>
                        <Text style={styles.viewIssueText}>Tap to view & resolve</Text>
                        <Ionicons
                            name="chevron-forward"
                            size={14}
                            color={Colors.mutedText}
                        />
                    </View>
                )}
            </TouchableOpacity>
        );
    };

    if (loading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color={Colors.primary} />
            </View>
        );
    }

    if (error) {
        return (
            <View style={styles.empty}>
                <Ionicons
                    name="alert-circle-outline"
                    size={48}
                    color={Colors.destructive}
                />
                <Text style={styles.emptyText}>{error}</Text>
                <TouchableOpacity
                    style={styles.retryBtn}
                    onPress={() => load()}
                >
                    <Text style={styles.retryText}>Retry</Text>
                </TouchableOpacity>
            </View>
        );
    }

    const currentIssues =
        tab === "available" ? availableIssues : assignedIssues;

    return (
        <View style={{ flex: 1 }}>
            {/* Category tags */}
            {categories.length > 0 && (
                <View style={styles.categoriesHeader}>
                    <Text style={styles.categoriesHeaderLabel}>
                        Your categories:
                    </Text>
                    <View style={styles.categoriesRow}>
                        {categories.map((cat) => (
                            <View key={cat} style={styles.categoryTag}>
                                <Text style={styles.categoryTagText}>
                                    {CategoryEmoji[cat] ?? "📌"}{" "}
                                    {CategoryLabels[cat] ?? cat}
                                </Text>
                            </View>
                        ))}
                    </View>
                </View>
            )}

            {/* Tab selector */}
            <View style={styles.tabRow}>
                <TouchableOpacity
                    style={[
                        styles.tabBtn,
                        tab === "available" && styles.tabBtnActive,
                    ]}
                    onPress={() => setTab("available")}
                >
                    <Text
                        style={[
                            styles.tabBtnText,
                            tab === "available" && styles.tabBtnTextActive,
                        ]}
                    >
                        Available{" "}
                        <Text style={styles.tabCount}>
                            ({availableIssues.length})
                        </Text>
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[
                        styles.tabBtn,
                        tab === "assigned" && styles.tabBtnActive,
                    ]}
                    onPress={() => setTab("assigned")}
                >
                    <Text
                        style={[
                            styles.tabBtnText,
                            tab === "assigned" && styles.tabBtnTextActive,
                        ]}
                    >
                        My Issues{" "}
                        <Text style={styles.tabCount}>
                            ({assignedIssues.length})
                        </Text>
                    </Text>
                </TouchableOpacity>
            </View>

            <FlatList
                data={currentIssues}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) =>
                    renderIssueCard({ item, showClaim: tab === "available" })
                }
                contentContainerStyle={styles.list}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor={Colors.primary}
                    />
                }
                ListEmptyComponent={
                    <View style={styles.empty}>
                        <Ionicons
                            name={
                                tab === "available"
                                    ? "checkmark-done-outline"
                                    : "clipboard-outline"
                            }
                            size={48}
                            color={Colors.mutedText}
                        />
                        <Text style={styles.emptyText}>
                            {tab === "available"
                                ? "No issues available in your categories"
                                : "No issues assigned to you yet"}
                        </Text>
                        {tab === "available" && (
                            <Text style={styles.emptySubText}>
                                Issues become available once they are verified by an admin
                            </Text>
                        )}
                    </View>
                }
            />
        </View>
    );
}

// ─── Root screen ──────────────────────────────────────────────────────────────

export default function NGOsScreen() {
    const { user, isAuthenticated } = useAuth();
    const isNGO = isAuthenticated && user?.role === "NGO";

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>
                    {isNGO ? "NGO Dashboard" : "NGO Directory"}
                </Text>
                {isNGO && (
                    <View style={styles.ngoBadge}>
                        <Ionicons
                            name="shield-checkmark"
                            size={14}
                            color={Colors.primary}
                        />
                        <Text style={styles.ngoBadgeText}>NGO</Text>
                    </View>
                )}
            </View>

            {isNGO ? <NGODashboard /> : <NGODirectory />}
        </View>
    );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    header: {
        paddingTop: Platform.OS === "ios" ? 56 : 40,
        paddingHorizontal: 16,
        paddingBottom: 12,
        backgroundColor: Colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    headerTitle: {
        color: Colors.foreground,
        fontSize: FontSize["2xl"],
        fontWeight: "700",
    },
    ngoBadge: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        backgroundColor: Colors.primaryDim,
        borderRadius: Radius.full,
        paddingHorizontal: 10,
        paddingVertical: 4,
    },
    ngoBadgeText: {
        color: Colors.primary,
        fontSize: FontSize.xs,
        fontWeight: "700",
    },
    center: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
    },
    list: {
        padding: 16,
        paddingBottom: 40,
    },
    // NGO Directory card
    ngoCard: {
        backgroundColor: Colors.glassBg,
        borderRadius: Radius["2xl"],
        borderWidth: 1,
        borderColor: Colors.border,
        padding: 16,
        gap: 12,
        marginBottom: 12,
    },
    ngoHeader: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
    },
    ngoAvatar: {
        width: 42,
        height: 42,
        borderRadius: 12,
        backgroundColor: Colors.primaryDim,
        justifyContent: "center",
        alignItems: "center",
    },
    ngoHeaderInfo: {
        flex: 1,
    },
    ngoName: {
        color: Colors.foreground,
        fontSize: FontSize.md,
        fontWeight: "600",
    },
    verifiedRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
    },
    verifiedText: {
        color: Colors.success,
        fontSize: FontSize.xs,
        fontWeight: "500",
    },
    resolvedBadge: {
        alignItems: "center",
    },
    resolvedCount: {
        color: Colors.primary,
        fontSize: FontSize.lg,
        fontWeight: "700",
    },
    resolvedLabel: {
        color: Colors.mutedText,
        fontSize: FontSize["2xs"],
    },
    ngoDescription: {
        color: Colors.secondaryText,
        fontSize: FontSize.sm,
        lineHeight: 20,
    },
    categoriesRow: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 6,
    },
    categoryTag: {
        backgroundColor: Colors.glassBg,
        borderRadius: Radius.md,
        borderWidth: 1,
        borderColor: Colors.border,
        paddingHorizontal: 8,
        paddingVertical: 4,
    },
    categoryTagText: {
        color: Colors.secondaryText,
        fontSize: FontSize.xs,
    },
    contactRow: {
        flexDirection: "row",
        gap: 8,
    },
    contactBtn: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        backgroundColor: Colors.primaryMuted,
        borderRadius: Radius.md,
        paddingHorizontal: 10,
        paddingVertical: 6,
    },
    contactText: {
        color: Colors.primary,
        fontSize: FontSize.xs,
        fontWeight: "500",
    },
    // NGO Dashboard
    categoriesHeader: {
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 4,
        gap: 6,
    },
    categoriesHeaderLabel: {
        color: Colors.mutedText,
        fontSize: FontSize.xs,
        fontWeight: "500",
    },
    tabRow: {
        flexDirection: "row",
        paddingHorizontal: 16,
        paddingVertical: 10,
        gap: 8,
    },
    tabBtn: {
        flex: 1,
        paddingVertical: 8,
        alignItems: "center",
        borderRadius: Radius.lg,
        borderWidth: 1,
        borderColor: Colors.border,
        backgroundColor: Colors.glassBg,
    },
    tabBtnActive: {
        backgroundColor: Colors.primaryDim,
        borderColor: "rgba(245,158,11,0.3)",
    },
    tabBtnText: {
        color: Colors.mutedText,
        fontSize: FontSize.sm,
        fontWeight: "500",
    },
    tabBtnTextActive: {
        color: Colors.primary,
        fontWeight: "700",
    },
    tabCount: {
        fontWeight: "400",
        opacity: 0.7,
    },
    // Issue card
    issueCard: {
        backgroundColor: Colors.glassBg,
        borderRadius: Radius["2xl"],
        borderWidth: 1,
        borderColor: Colors.border,
        padding: 14,
        marginBottom: 10,
        gap: 8,
    },
    issueCardTop: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    issueMeta: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
    },
    issueCategoryEmoji: {
        fontSize: FontSize.md,
    },
    issueCategoryLabel: {
        color: Colors.secondaryText,
        fontSize: FontSize.xs,
    },
    statusDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    highPriorityBadge: {
        flexDirection: "row",
        alignItems: "center",
        gap: 3,
        backgroundColor: "rgba(239,68,68,0.15)",
        borderRadius: Radius.full,
        paddingHorizontal: 7,
        paddingVertical: 2,
    },
    highPriorityText: {
        color: Colors.destructive,
        fontSize: FontSize["2xs"],
        fontWeight: "600",
    },
    issueTitle: {
        color: Colors.foreground,
        fontSize: FontSize.base,
        fontWeight: "600",
        lineHeight: 20,
    },
    addressRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
    },
    addressText: {
        color: Colors.mutedText,
        fontSize: FontSize.xs,
        flex: 1,
    },
    issueCardBottom: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
    },
    issueStats: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
    },
    issueStatText: {
        color: Colors.mutedText,
        fontSize: FontSize.xs,
    },
    issueDot: {
        color: Colors.mutedText,
        fontSize: FontSize.xs,
    },
    deadlineText: {
        color: Colors.mutedText,
        fontSize: FontSize.xs,
    },
    claimBtn: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        backgroundColor: Colors.primary,
        borderRadius: Radius.lg,
        paddingVertical: 10,
        marginTop: 4,
    },
    claimBtnDisabled: {
        opacity: 0.6,
    },
    claimBtnText: {
        color: Colors.primaryForeground,
        fontSize: FontSize.sm,
        fontWeight: "700",
    },
    viewIssueRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "flex-end",
        gap: 4,
        marginTop: 2,
    },
    viewIssueText: {
        color: Colors.mutedText,
        fontSize: FontSize.xs,
    },
    // Common
    empty: {
        alignItems: "center",
        paddingTop: 80,
        gap: 12,
    },
    emptyText: {
        color: Colors.mutedText,
        fontSize: FontSize.base,
        textAlign: "center",
    },
    emptySubText: {
        color: Colors.mutedText,
        fontSize: FontSize.sm,
        textAlign: "center",
        opacity: 0.7,
        paddingHorizontal: 32,
    },
    retryBtn: {
        backgroundColor: Colors.primaryDim,
        borderRadius: Radius.lg,
        paddingHorizontal: 20,
        paddingVertical: 10,
        marginTop: 4,
    },
    retryText: {
        color: Colors.primary,
        fontSize: FontSize.sm,
        fontWeight: "600",
    },
});
