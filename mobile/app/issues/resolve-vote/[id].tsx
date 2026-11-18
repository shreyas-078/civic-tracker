import { useEffect, useState, useCallback } from "react";
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    Image,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    Platform,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import {
    Colors,
    StatusColors,
    StatusLabels,
    CategoryEmoji,
    CategoryLabels,
    Radius,
    FontSize,
} from "@/constants/theme";
import { useAuth } from "@/stores/auth";
import { api, resolveUrl } from "@/lib/api";
import type { IssueCardData } from "@/types";

export default function ResolutionVoteScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    const { isAuthenticated } = useAuth();

    const [issue, setIssue] = useState<IssueCardData | null>(null);
    const [loading, setLoading] = useState(true);
    const [voting, setVoting] = useState(false);
    const [voted, setVoted] = useState<string | null>(null);

    const fetchIssue = useCallback(async () => {
        try {
            const data = await api(`/api/issues/${id}`);
            setIssue(data.issue);
            // Restore existing resolution vote from server
            if (data.userResolutionVote) {
                setVoted(data.userResolutionVote);
            }
        } catch {
            Alert.alert("Error", "Failed to load issue");
            router.back();
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        fetchIssue();
    }, [fetchIssue]);

    const handleVote = async (vote: "YES" | "NO" | "IDK") => {
        if (!isAuthenticated) {
            router.push("/auth/signin");
            return;
        }
        setVoting(true);
        try {
            await api(`/api/resolution/vote/${id}`, {
                method: "POST",
                body: { vote },
            });
            setVoted(vote);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch {
            Alert.alert("Error", "Failed to submit vote");
        } finally {
            setVoting(false);
        }
    };

    if (loading || !issue) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color={Colors.primary} />
            </View>
        );
    }

    const statusColor = StatusColors[issue.status] ?? Colors.primary;

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
                <Text style={styles.headerTitle}>Resolution Check</Text>
                <View style={{ width: 36 }} />
            </View>

            <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.scrollContent}
            >
                {/* Question banner */}
                <View style={styles.questionBanner}>
                    <Ionicons
                        name="help-circle"
                        size={28}
                        color={Colors.primary}
                    />
                    <Text style={styles.questionText}>
                        Has this issue been resolved?
                    </Text>
                </View>

                {/* Issue card */}
                <View style={styles.issueCard}>
                    {/* Image */}
                    {issue.imageUrls.length > 0 && (
                        <Image
                            source={{ uri: resolveUrl(issue.imageUrls[0]) }}
                            style={styles.issueImage}
                            resizeMode="cover"
                        />
                    )}

                    {/* Status badge */}
                    <View style={styles.statusRow}>
                        <View
                            style={[
                                styles.statusBadge,
                                { backgroundColor: statusColor + "20" },
                            ]}
                        >
                            <View
                                style={[
                                    styles.statusDot,
                                    { backgroundColor: statusColor },
                                ]}
                            />
                            <Text
                                style={[
                                    styles.statusText,
                                    { color: statusColor },
                                ]}
                            >
                                {StatusLabels[issue.status]}
                            </Text>
                        </View>
                        <Text style={styles.categoryText}>
                            {CategoryEmoji[issue.category]}{" "}
                            {CategoryLabels[issue.category]}
                        </Text>
                    </View>

                    {/* Title */}
                    <Text style={styles.issueTitle}>{issue.title}</Text>

                    {/* Description */}
                    <Text style={styles.issueDescription}>
                        {issue.description}
                    </Text>

                    {/* Location */}
                    <View style={styles.locationRow}>
                        <Ionicons
                            name="location"
                            size={14}
                            color={Colors.primary}
                        />
                        <Text style={styles.locationText}>
                            {issue.address ??
                                `${issue.lat.toFixed(4)}, ${issue.lng.toFixed(4)}`}
                        </Text>
                    </View>

                    {/* Resolution proof images */}
                    {(issue as any).resolutionProof?.length > 0 && (
                        <View style={styles.proofSection}>
                            <Text style={styles.proofLabel}>
                                Resolution Proof
                            </Text>
                            <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                            >
                                {(
                                    (issue as any).resolutionProof as string[]
                                ).map((url, i) => (
                                    <Image
                                        key={i}
                                        source={{ uri: resolveUrl(url) }}
                                        style={styles.proofImage}
                                        resizeMode="cover"
                                    />
                                ))}
                            </ScrollView>
                        </View>
                    )}
                </View>

                {/* Vote Section */}
                {!voted ? (
                    <View style={styles.voteSection}>
                        <Text style={styles.votePrompt}>
                            Please verify if this issue has been resolved:
                        </Text>

                        <TouchableOpacity
                            style={styles.yesButton}
                            onPress={() => handleVote("YES")}
                            disabled={voting}
                            activeOpacity={0.8}
                        >
                            {voting ? (
                                <ActivityIndicator
                                    size="small"
                                    color={Colors.white}
                                />
                            ) : (
                                <>
                                    <Ionicons
                                        name="checkmark-circle"
                                        size={22}
                                        color={Colors.white}
                                    />
                                    <Text style={styles.yesButtonText}>
                                        Yes, it's resolved
                                    </Text>
                                </>
                            )}
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.noButton}
                            onPress={() => handleVote("NO")}
                            disabled={voting}
                            activeOpacity={0.8}
                        >
                            <Ionicons
                                name="close-circle"
                                size={22}
                                color={Colors.destructive}
                            />
                            <Text style={styles.noButtonText}>
                                No, still unresolved
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.ignoreButton}
                            onPress={() => handleVote("IDK")}
                            disabled={voting}
                            activeOpacity={0.8}
                        >
                            <Ionicons
                                name="remove-circle-outline"
                                size={22}
                                color={Colors.mutedText}
                            />
                            <Text style={styles.ignoreButtonText}>
                                Ignore / Not sure
                            </Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <View style={styles.votedCard}>
                        <Ionicons
                            name="checkmark-circle"
                            size={32}
                            color={Colors.success}
                        />
                        <Text style={styles.votedTitle}>
                            Thanks for your response!
                        </Text>
                        <Text style={styles.votedSub}>
                            {voted === "YES"
                                ? "You confirmed this issue is resolved."
                                : voted === "NO"
                                  ? "You indicated this issue is still unresolved."
                                  : "Your response has been noted."}
                        </Text>
                        <TouchableOpacity
                            style={styles.viewIssueBtn}
                            onPress={() => router.replace(`/issues/${id}`)}
                        >
                            <Text style={styles.viewIssueBtnText}>
                                View Full Issue
                            </Text>
                        </TouchableOpacity>
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
        fontSize: FontSize.md,
        fontWeight: "600",
    },
    scroll: { flex: 1 },
    scrollContent: { padding: 16, gap: 16, paddingBottom: 40 },
    questionBanner: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        backgroundColor: Colors.primaryMuted,
        borderRadius: Radius["2xl"],
        borderWidth: 1,
        borderColor: "rgba(245,158,11,0.15)",
        padding: 16,
    },
    questionText: {
        flex: 1,
        color: Colors.primary,
        fontSize: FontSize.lg,
        fontWeight: "700",
    },
    issueCard: {
        backgroundColor: Colors.glassBg,
        borderRadius: Radius["2xl"],
        borderWidth: 1,
        borderColor: Colors.border,
        overflow: "hidden",
    },
    issueImage: {
        width: "100%",
        height: 180,
    },
    statusRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        paddingHorizontal: 16,
        paddingTop: 14,
    },
    statusBadge: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        borderRadius: 20,
        paddingHorizontal: 10,
        paddingVertical: 4,
    },
    statusDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    statusText: {
        fontSize: FontSize.xs,
        fontWeight: "600",
    },
    categoryText: {
        color: Colors.secondaryText,
        fontSize: FontSize.sm,
    },
    issueTitle: {
        color: Colors.foreground,
        fontSize: FontSize.xl,
        fontWeight: "700",
        lineHeight: 26,
        paddingHorizontal: 16,
        paddingTop: 10,
    },
    issueDescription: {
        color: Colors.secondaryText,
        fontSize: FontSize.base,
        lineHeight: 22,
        paddingHorizontal: 16,
        paddingTop: 6,
    },
    locationRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: 16,
        paddingTop: 10,
        paddingBottom: 16,
    },
    locationText: {
        color: Colors.mutedText,
        fontSize: FontSize.sm,
    },
    proofSection: {
        paddingHorizontal: 16,
        paddingBottom: 16,
        gap: 8,
    },
    proofLabel: {
        color: Colors.success,
        fontSize: FontSize.sm,
        fontWeight: "600",
    },
    proofImage: {
        width: 140,
        height: 100,
        borderRadius: Radius.lg,
        marginRight: 8,
    },
    voteSection: {
        gap: 12,
    },
    votePrompt: {
        color: Colors.secondaryText,
        fontSize: FontSize.base,
        textAlign: "center",
        marginBottom: 4,
    },
    yesButton: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        backgroundColor: Colors.success,
        borderRadius: Radius.xl,
        paddingVertical: 16,
        shadowColor: Colors.success,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 6,
    },
    yesButtonText: {
        color: Colors.white,
        fontSize: FontSize.md,
        fontWeight: "700",
    },
    noButton: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        backgroundColor: Colors.destructiveDim,
        borderRadius: Radius.xl,
        borderWidth: 1,
        borderColor: "rgba(239, 68, 68, 0.2)",
        paddingVertical: 16,
    },
    noButtonText: {
        color: Colors.destructive,
        fontSize: FontSize.md,
        fontWeight: "600",
    },
    ignoreButton: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        backgroundColor: Colors.glassBg,
        borderRadius: Radius.xl,
        borderWidth: 1,
        borderColor: Colors.border,
        paddingVertical: 16,
    },
    ignoreButtonText: {
        color: Colors.mutedText,
        fontSize: FontSize.md,
        fontWeight: "500",
    },
    votedCard: {
        alignItems: "center",
        backgroundColor: Colors.successDim,
        borderRadius: Radius["2xl"],
        borderWidth: 1,
        borderColor: "rgba(34,197,94,0.2)",
        padding: 24,
        gap: 8,
    },
    votedTitle: {
        color: Colors.success,
        fontSize: FontSize.lg,
        fontWeight: "700",
    },
    votedSub: {
        color: Colors.secondaryText,
        fontSize: FontSize.sm,
        textAlign: "center",
    },
    viewIssueBtn: {
        marginTop: 8,
        backgroundColor: Colors.glassBg,
        borderRadius: Radius.lg,
        borderWidth: 1,
        borderColor: Colors.border,
        paddingHorizontal: 20,
        paddingVertical: 10,
    },
    viewIssueBtnText: {
        color: Colors.foreground,
        fontSize: FontSize.sm,
        fontWeight: "500",
    },
});
