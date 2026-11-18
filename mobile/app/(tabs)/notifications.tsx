import { useEffect, useState, useCallback } from "react";
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    ActivityIndicator,
    Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { formatDistanceToNow } from "date-fns";
import { Colors, Radius, FontSize } from "@/constants/theme";
import { useAuth } from "@/stores/auth";
import { api } from "@/lib/api";
import type { NotificationData } from "@/types";

const NOTIF_ICONS: Record<string, string> = {
    ISSUE_VERIFIED: "checkmark-circle",
    ISSUE_ASSIGNED: "briefcase",
    ISSUE_RESOLVED: "checkmark-done-circle",
    RESOLUTION_VERIFY_REQUEST: "help-circle",
    RESOLUTION_NEARBY_CHECK: "location",
    RESOLUTION_DEADLINE_CHECK: "time",
    COMMENT_REPLY: "chatbubble",
    VOTE_MILESTONE: "trending-up",
    BADGE_AWARDED: "ribbon",
    NGO_APPLICATION_UPDATE: "business",
    DEADLINE_WARNING: "alert-circle",
    DUPLICATE_DETECTED: "copy",
};

export default function NotificationsScreen() {
    const router = useRouter();
    const { user, isAuthenticated } = useAuth();
    const [notifications, setNotifications] = useState<NotificationData[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchNotifications = useCallback(async () => {
        if (!user) return;
        try {
            const data = await api(`/api/notifications/${user.id}`);
            setNotifications(data.notifications ?? []);
        } catch {
            console.error("Failed to fetch notifications");
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        fetchNotifications();
    }, [fetchNotifications]);

    const markAllRead = async () => {
        if (!user) return;
        try {
            await api(`/api/notifications/${user.id}`, { method: "PATCH" });
            setNotifications((prev) =>
                prev.map((n) => ({ ...n, isRead: true })),
            );
        } catch {}
    };

    if (!isAuthenticated) {
        return (
            <View style={styles.center}>
                <Ionicons
                    name="notifications-off-outline"
                    size={48}
                    color={Colors.mutedText}
                />
                <Text style={styles.emptyText}>
                    Sign in to see notifications
                </Text>
                <TouchableOpacity
                    style={styles.signInBtn}
                    onPress={() => router.push("/auth/signin")}
                >
                    <Text style={styles.signInBtnText}>Sign In</Text>
                </TouchableOpacity>
            </View>
        );
    }

    const renderNotification = ({ item }: { item: NotificationData }) => {
        const iconName = NOTIF_ICONS[item.type] ?? "notifications";
        const isResolution =
            item.type === "RESOLUTION_VERIFY_REQUEST" ||
            item.type === "RESOLUTION_NEARBY_CHECK" ||
            item.type === "RESOLUTION_DEADLINE_CHECK";

        return (
            <TouchableOpacity
                style={[styles.notifCard, !item.isRead && styles.notifUnread]}
                onPress={() => {
                    if (item.issue?.id) {
                        // Resolution-related notifications go to the dedicated vote screen
                        const resolutionTypes = [
                            "RESOLUTION_VERIFY_REQUEST",
                            "RESOLUTION_NEARBY_CHECK",
                            "RESOLUTION_DEADLINE_CHECK",
                        ];
                        if (resolutionTypes.includes(item.type)) {
                            router.push(
                                `/issues/resolve-vote/${item.issue.id}` as any,
                            );
                        } else {
                            router.push(`/issues/${item.issue.id}`);
                        }
                    }
                }}
                activeOpacity={0.7}
            >
                <View
                    style={[
                        styles.notifIcon,
                        isResolution && styles.notifIconResolution,
                    ]}
                >
                    <Ionicons
                        name={iconName as any}
                        size={18}
                        color={isResolution ? Colors.success : Colors.primary}
                    />
                </View>
                <View style={styles.notifBody}>
                    <Text style={styles.notifTitle}>{item.title}</Text>
                    <Text style={styles.notifText} numberOfLines={2}>
                        {item.body}
                    </Text>
                    <Text style={styles.notifTime}>
                        {formatDistanceToNow(new Date(item.createdAt), {
                            addSuffix: true,
                        })}
                    </Text>
                </View>
                {!item.isRead && <View style={styles.unreadDot} />}
            </TouchableOpacity>
        );
    };

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Notifications</Text>
                {notifications.some((n) => !n.isRead) && (
                    <TouchableOpacity onPress={markAllRead}>
                        <Text style={styles.markRead}>Mark all read</Text>
                    </TouchableOpacity>
                )}
            </View>

            {loading ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={Colors.primary} />
                </View>
            ) : (
                <FlatList
                    data={notifications}
                    keyExtractor={(item) => item.id}
                    renderItem={renderNotification}
                    contentContainerStyle={styles.list}
                    showsVerticalScrollIndicator={false}
                    ListEmptyComponent={
                        <View style={styles.empty}>
                            <Ionicons
                                name="notifications-outline"
                                size={48}
                                color={Colors.mutedText}
                            />
                            <Text style={styles.emptyText}>
                                No notifications yet
                            </Text>
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
    headerTitle: {
        color: Colors.foreground,
        fontSize: FontSize["2xl"],
        fontWeight: "700",
    },
    markRead: {
        color: Colors.primary,
        fontSize: FontSize.sm,
        fontWeight: "500",
    },
    center: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        gap: 12,
    },
    list: {
        padding: 16,
    },
    notifCard: {
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 12,
        backgroundColor: Colors.glassBg,
        borderRadius: Radius.xl,
        borderWidth: 1,
        borderColor: Colors.border,
        padding: 14,
        marginBottom: 8,
    },
    notifUnread: {
        backgroundColor: Colors.primaryMuted,
        borderColor: "rgba(245,158,11,0.1)",
    },
    notifIcon: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: Colors.primaryDim,
        justifyContent: "center",
        alignItems: "center",
    },
    notifIconResolution: {
        backgroundColor: Colors.successDim,
    },
    notifBody: {
        flex: 1,
        gap: 2,
    },
    notifTitle: {
        color: Colors.foreground,
        fontSize: FontSize.base,
        fontWeight: "600",
    },
    notifText: {
        color: Colors.secondaryText,
        fontSize: FontSize.sm,
        lineHeight: 19,
    },
    notifTime: {
        color: Colors.mutedText,
        fontSize: FontSize.xs,
        marginTop: 2,
    },
    unreadDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: Colors.primary,
        marginTop: 4,
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
    signInBtn: {
        backgroundColor: Colors.primary,
        borderRadius: Radius.lg,
        paddingHorizontal: 24,
        paddingVertical: 10,
        marginTop: 8,
    },
    signInBtnText: {
        color: Colors.primaryForeground,
        fontSize: FontSize.base,
        fontWeight: "600",
    },
});
