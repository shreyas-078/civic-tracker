import { useEffect, useState, useCallback } from "react";
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    ActivityIndicator,
    Platform,
    Image,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Colors, Radius, FontSize } from "@/constants/theme";
import { useLocation } from "@/stores/location";
import { api } from "@/lib/api";
import type { LeaderboardEntry } from "@/types";

export default function LeaderboardScreen() {
    const router = useRouter();
    const { location } = useLocation();
    const [tab, setTab] = useState<"reporters" | "ngos">("reporters");
    const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchLeaderboard = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ type: tab });
            if (location) {
                params.set("lat", String(location.lat));
                params.set("lng", String(location.lng));
            }
            const data = await api(`/api/leaderboard?${params}`);
            setEntries(data.entries ?? []);
        } catch {
            console.error("Failed to fetch leaderboard");
        } finally {
            setLoading(false);
        }
    }, [tab, location]);

    useEffect(() => {
        fetchLeaderboard();
    }, [fetchLeaderboard]);

    const medalColors = ["#f59e0b", "#c0c0c0", "#cd7f32"];

    const renderEntry = ({
        item,
        index,
    }: {
        item: LeaderboardEntry;
        index: number;
    }) => {
        const isTop3 = index < 3;
        return (
            <TouchableOpacity
                style={[styles.entryCard, isTop3 && styles.entryCardTop]}
                onPress={() => item.userId ? router.push(`/profile/${item.userId}`) : undefined}
                activeOpacity={item.userId ? 0.7 : 1}
            >
                <View style={styles.rankCol}>
                    {isTop3 ? (
                        <View
                            style={[
                                styles.medal,
                                { backgroundColor: medalColors[index] + "30" },
                            ]}
                        >
                            <Text
                                style={[
                                    styles.medalText,
                                    { color: medalColors[index] },
                                ]}
                            >
                                {index + 1}
                            </Text>
                        </View>
                    ) : (
                        <Text style={styles.rankNum}>{item.rank}</Text>
                    )}
                </View>

                <View style={styles.avatar}>
                    {item.image ? (
                        <Image
                            source={{ uri: item.image }}
                            style={styles.avatarImage}
                        />
                    ) : (
                        <Text style={styles.avatarLetter}>
                            {item.name?.[0] ?? "?"}
                        </Text>
                    )}
                </View>

                <View style={styles.entryInfo}>
                    <Text style={styles.entryName}>
                        {item.name ?? "Anonymous"}
                    </Text>
                    <View style={styles.entryStats}>
                        {item.totalReports != null ? (
                            <>
                                <Text style={styles.entryStat}>
                                    {item.totalReports} reports
                                </Text>
                                <Text style={styles.entryStatDot}>·</Text>
                                <Text style={styles.entryStat}>
                                    Trust {item.trustScore}
                                </Text>
                            </>
                        ) : (
                            <Text style={styles.entryStat}>
                                {(item as any).resolvedCount ?? 0} resolved
                            </Text>
                        )}
                    </View>
                </View>

                <View style={styles.scoreCol}>
                    <Text style={styles.scoreNum}>{item.score ?? (item as any).resolvedCount ?? 0}</Text>
                    <Text style={styles.scoreLabel}>{item.score != null ? "pts" : "resolved"}</Text>
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Leaderboard</Text>
                <View style={styles.tabs}>
                    <TouchableOpacity
                        style={[
                            styles.tab,
                            tab === "reporters" && styles.tabActive,
                        ]}
                        onPress={() => setTab("reporters")}
                    >
                        <Text
                            style={[
                                styles.tabText,
                                tab === "reporters" && styles.tabTextActive,
                            ]}
                        >
                            Reporters
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.tab, tab === "ngos" && styles.tabActive]}
                        onPress={() => setTab("ngos")}
                    >
                        <Text
                            style={[
                                styles.tabText,
                                tab === "ngos" && styles.tabTextActive,
                            ]}
                        >
                            NGOs
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>

            {loading ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={Colors.primary} />
                </View>
            ) : (
                <FlatList
                    data={entries}
                    keyExtractor={(item) => item.userId ?? (item as any).id ?? String(item.rank)}
                    renderItem={renderEntry}
                    contentContainerStyle={styles.list}
                    showsVerticalScrollIndicator={false}
                    ListEmptyComponent={
                        <View style={styles.empty}>
                            <Ionicons
                                name="trophy-outline"
                                size={48}
                                color={Colors.mutedText}
                            />
                            <Text style={styles.emptyText}>No entries yet</Text>
                        </View>
                    }
                />
            )}
        </View>
    );
}

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
        gap: 12,
    },
    headerTitle: {
        color: Colors.foreground,
        fontSize: FontSize["2xl"],
        fontWeight: "700",
    },
    tabs: {
        flexDirection: "row",
        backgroundColor: Colors.glassBg,
        borderRadius: Radius.lg,
        padding: 3,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    tab: {
        flex: 1,
        paddingVertical: 8,
        alignItems: "center",
        borderRadius: Radius.md,
    },
    tabActive: {
        backgroundColor: Colors.primaryDim,
    },
    tabText: {
        color: Colors.mutedText,
        fontSize: FontSize.sm,
        fontWeight: "500",
    },
    tabTextActive: {
        color: Colors.primary,
        fontWeight: "600",
    },
    center: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
    },
    list: {
        padding: 16,
        gap: 8,
    },
    entryCard: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: Colors.glassBg,
        borderRadius: Radius.xl,
        borderWidth: 1,
        borderColor: Colors.border,
        padding: 12,
        gap: 12,
        marginBottom: 8,
    },
    entryCardTop: {
        borderColor: "rgba(245,158,11,0.15)",
        backgroundColor: Colors.primaryMuted,
    },
    rankCol: {
        width: 32,
        alignItems: "center",
    },
    medal: {
        width: 28,
        height: 28,
        borderRadius: 14,
        justifyContent: "center",
        alignItems: "center",
    },
    medalText: {
        fontSize: FontSize.base,
        fontWeight: "800",
    },
    rankNum: {
        color: Colors.mutedText,
        fontSize: FontSize.base,
        fontWeight: "600",
    },
    avatar: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: Colors.primaryDim,
        justifyContent: "center",
        alignItems: "center",
    },
    avatarImage: {
        width: 38,
        height: 38,
        borderRadius: 19,
    },
    avatarLetter: {
        color: Colors.primary,
        fontSize: FontSize.md,
        fontWeight: "600",
    },
    entryInfo: {
        flex: 1,
    },
    entryName: {
        color: Colors.foreground,
        fontSize: FontSize.base,
        fontWeight: "500",
    },
    entryStats: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
    },
    entryStat: {
        color: Colors.mutedText,
        fontSize: FontSize.xs,
    },
    entryStatDot: {
        color: Colors.mutedText,
    },
    scoreCol: {
        alignItems: "center",
    },
    scoreNum: {
        color: Colors.primary,
        fontSize: FontSize.lg,
        fontWeight: "700",
    },
    scoreLabel: {
        color: Colors.mutedText,
        fontSize: FontSize["2xs"],
    },
    empty: {
        alignItems: "center",
        paddingTop: 80,
        gap: 12,
    },
    emptyText: {
        color: Colors.mutedText,
        fontSize: FontSize.base,
    },
});
