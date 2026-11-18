import { useEffect, useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Image,
    ActivityIndicator,
    Platform,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { formatDistanceToNow } from "date-fns";
import { Colors, Radius, FontSize } from "@/constants/theme";
import { useAuth } from "@/stores/auth";
import { api } from "@/lib/api";
import type { UserProfileData, BadgeType } from "@/types";

const BADGE_META: Record<
    BadgeType,
    { icon: string; label: string; color: string }
> = {
    FIRST_REPORT: {
        icon: "flag",
        label: "First Report",
        color: Colors.primary,
    },
    TEN_REPORTS: { icon: "ribbon", label: "10 Reports", color: "#3b82f6" },
    FIFTY_REPORTS: { icon: "medal", label: "50 Reports", color: "#8b5cf6" },
    COMMUNITY_HERO: {
        icon: "star",
        label: "Community Hero",
        color: Colors.primary,
    },
    VERIFIED_SOLVER: {
        icon: "checkmark-done-circle",
        label: "Verified Solver",
        color: Colors.success,
    },
    SPEEDY_REPORTER: {
        icon: "flash",
        label: "Speedy Reporter",
        color: "#f97316",
    },
    NGO_PARTNER: { icon: "business", label: "NGO Partner", color: "#06b6d4" },
    FAST_RESOLVER: { icon: "rocket", label: "Fast Resolver", color: "#ec4899" },
    TOP_NGO: { icon: "trophy", label: "Top NGO", color: Colors.primary },
};

export default function ProfileScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    const { user: currentUser, signOut } = useAuth();

    const [profile, setProfile] = useState<UserProfileData | null>(null);
    const [loading, setLoading] = useState(true);

    const isOwnProfile = currentUser?.id === id;

    useEffect(() => {
        (async () => {
            try {
                const data = await api(`/api/users/${id}`);
                setProfile(data.user ?? data);
            } catch {
                console.error("Failed to fetch profile");
            } finally {
                setLoading(false);
            }
        })();
    }, [id]);

    if (loading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color={Colors.primary} />
            </View>
        );
    }

    if (!profile) {
        return (
            <View style={styles.center}>
                <Ionicons
                    name="person-outline"
                    size={48}
                    color={Colors.mutedText}
                />
                <Text style={styles.emptyText}>Profile not found</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={() => router.back()}
                    style={styles.backBtn}
                >
                    <Ionicons
                        name="arrow-back"
                        size={20}
                        color={Colors.foreground}
                    />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Profile</Text>
                {isOwnProfile && (
                    <TouchableOpacity onPress={signOut}>
                        <Text style={styles.signOutText}>Sign Out</Text>
                    </TouchableOpacity>
                )}
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>
                {/* Avatar and name */}
                <View style={styles.profileCard}>
                    <View style={styles.avatar}>
                        {profile.image ? (
                            <Image
                                source={{ uri: profile.image }}
                                style={styles.avatarImage}
                            />
                        ) : (
                            <Text style={styles.avatarLetter}>
                                {profile.name?.[0] ?? "?"}
                            </Text>
                        )}
                    </View>
                    <Text style={styles.profileName}>
                        {profile.name ?? "Anonymous"}
                    </Text>
                    <Text style={styles.profileRole}>
                        {profile.role === "NGO"
                            ? "NGO Member"
                            : profile.role === "ADMIN"
                              ? "Administrator"
                              : "Citizen"}
                    </Text>
                    <Text style={styles.joinDate}>
                        Joined{" "}
                        {formatDistanceToNow(new Date(profile.createdAt), {
                            addSuffix: true,
                        })}
                    </Text>
                </View>

                {/* Stats */}
                <View style={styles.statsRow}>
                    <View style={styles.statCard}>
                        <Text style={styles.statNum}>{profile.trustScore}</Text>
                        <Text style={styles.statLabel}>Trust</Text>
                    </View>
                    <View style={styles.statCard}>
                        <Text style={styles.statNum}>
                            {profile.totalReports}
                        </Text>
                        <Text style={styles.statLabel}>Reports</Text>
                    </View>
                    <View style={styles.statCard}>
                        <Text style={styles.statNum}>
                            {profile.resolvedCount}
                        </Text>
                        <Text style={styles.statLabel}>Resolved</Text>
                    </View>
                </View>

                {/* Badges */}
                {profile.badges.length > 0 && (
                    <View style={styles.badgesSection}>
                        <Text style={styles.sectionTitle}>Badges</Text>
                        <View style={styles.badgeGrid}>
                            {profile.badges.map((badge) => {
                                const meta = BADGE_META[badge.type] ?? {
                                    icon: "ribbon",
                                    label: badge.type,
                                    color: Colors.primary,
                                };
                                return (
                                    <View
                                        key={badge.type}
                                        style={styles.badgeCard}
                                    >
                                        <View
                                            style={[
                                                styles.badgeIcon,
                                                {
                                                    backgroundColor:
                                                        meta.color + "20",
                                                },
                                            ]}
                                        >
                                            <Ionicons
                                                name={meta.icon as any}
                                                size={20}
                                                color={meta.color}
                                            />
                                        </View>
                                        <Text style={styles.badgeLabel}>
                                            {meta.label}
                                        </Text>
                                    </View>
                                );
                            })}
                        </View>
                    </View>
                )}

                {/* NGO info */}
                {profile.ngo && (
                    <View style={styles.ngoSection}>
                        <Text style={styles.sectionTitle}>NGO</Text>
                        <View style={styles.ngoInfoCard}>
                            <Ionicons
                                name="business"
                                size={18}
                                color={Colors.primary}
                            />
                            <Text style={styles.ngoName}>
                                {profile.ngo.name}
                            </Text>
                            <View
                                style={[
                                    styles.ngoStatusBadge,
                                    {
                                        backgroundColor:
                                            profile.ngo.status === "APPROVED"
                                                ? Colors.successDim
                                                : Colors.warningDim,
                                    },
                                ]}
                            >
                                <Text
                                    style={[
                                        styles.ngoStatusText,
                                        {
                                            color:
                                                profile.ngo.status ===
                                                "APPROVED"
                                                    ? Colors.success
                                                    : Colors.warning,
                                        },
                                    ]}
                                >
                                    {profile.ngo.status}
                                </Text>
                            </View>
                        </View>
                    </View>
                )}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    center: {
        flex: 1,
        backgroundColor: Colors.background,
        justifyContent: "center",
        alignItems: "center",
        gap: 12,
    },
    emptyText: {
        color: Colors.mutedText,
        fontSize: FontSize.base,
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingTop: Platform.OS === "ios" ? 56 : 40,
        paddingHorizontal: 16,
        paddingBottom: 12,
        backgroundColor: Colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
    },
    backBtn: {
        width: 36,
        height: 36,
        borderRadius: 10,
        justifyContent: "center",
        alignItems: "center",
    },
    headerTitle: {
        color: Colors.foreground,
        fontSize: FontSize.lg,
        fontWeight: "600",
    },
    signOutText: {
        color: Colors.destructive,
        fontSize: FontSize.sm,
        fontWeight: "500",
    },
    scrollContent: {
        padding: 16,
        gap: 20,
        paddingBottom: 40,
    },
    profileCard: {
        alignItems: "center",
        gap: 8,
    },
    avatar: {
        width: 80,
        height: 80,
        borderRadius: 24,
        backgroundColor: Colors.primaryDim,
        justifyContent: "center",
        alignItems: "center",
        borderWidth: 2,
        borderColor: Colors.primary,
    },
    avatarImage: {
        width: 80,
        height: 80,
        borderRadius: 24,
    },
    avatarLetter: {
        color: Colors.primary,
        fontSize: FontSize["3xl"],
        fontWeight: "700",
    },
    profileName: {
        color: Colors.foreground,
        fontSize: FontSize["2xl"],
        fontWeight: "700",
    },
    profileRole: {
        color: Colors.secondaryText,
        fontSize: FontSize.sm,
    },
    joinDate: {
        color: Colors.mutedText,
        fontSize: FontSize.xs,
    },
    statsRow: {
        flexDirection: "row",
        gap: 10,
    },
    statCard: {
        flex: 1,
        backgroundColor: Colors.glassBg,
        borderRadius: Radius.xl,
        borderWidth: 1,
        borderColor: Colors.border,
        padding: 14,
        alignItems: "center",
        gap: 4,
    },
    statNum: {
        color: Colors.primary,
        fontSize: FontSize.xl,
        fontWeight: "700",
    },
    statLabel: {
        color: Colors.mutedText,
        fontSize: FontSize.xs,
    },
    badgesSection: {
        gap: 10,
    },
    sectionTitle: {
        color: Colors.foreground,
        fontSize: FontSize.md,
        fontWeight: "600",
    },
    badgeGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 10,
    },
    badgeCard: {
        width: "30%",
        backgroundColor: Colors.glassBg,
        borderRadius: Radius.xl,
        borderWidth: 1,
        borderColor: Colors.border,
        padding: 12,
        alignItems: "center",
        gap: 6,
    },
    badgeIcon: {
        width: 40,
        height: 40,
        borderRadius: 12,
        justifyContent: "center",
        alignItems: "center",
    },
    badgeLabel: {
        color: Colors.foreground,
        fontSize: FontSize.xs,
        fontWeight: "500",
        textAlign: "center",
    },
    ngoSection: {
        gap: 10,
    },
    ngoInfoCard: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        backgroundColor: Colors.glassBg,
        borderRadius: Radius.xl,
        borderWidth: 1,
        borderColor: Colors.border,
        padding: 14,
    },
    ngoName: {
        flex: 1,
        color: Colors.foreground,
        fontSize: FontSize.base,
        fontWeight: "500",
    },
    ngoStatusBadge: {
        borderRadius: 12,
        paddingHorizontal: 8,
        paddingVertical: 3,
    },
    ngoStatusText: {
        fontSize: FontSize.xs,
        fontWeight: "600",
    },
});
