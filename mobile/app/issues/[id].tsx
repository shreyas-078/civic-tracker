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
    Dimensions,
    Platform,
    FlatList,
    TextInput,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { formatDistanceToNow } from "date-fns";
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
import { api, apiUpload, resolveUrl } from "@/lib/api";
import type { IssueCardData, CommentData } from "@/types";

const { width } = Dimensions.get("window");

export default function IssueDetailScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    const { user, isAuthenticated } = useAuth();

    const [issue, setIssue] = useState<IssueCardData | null>(null);
    const [comments, setComments] = useState<CommentData[]>([]);
    const [userVote, setUserVote] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);
    const [voting, setVoting] = useState(false);
    const [commentText, setCommentText] = useState("");
    const [sendingComment, setSendingComment] = useState(false);
    const [resolutionVote, setResolutionVote] = useState<string | null>(null);
    const [uploadingProof, setUploadingProof] = useState(false);
    // NGO-specific state
    const [ngoInfo, setNgoInfo] = useState<{
        id: string;
        categories: string[];
    } | null>(null);
    const [ngoActionLoading, setNgoActionLoading] = useState(false);

    const fetchIssue = useCallback(async () => {
        try {
            const data = await api(`/api/issues/${id}`);
            setIssue(data.issue);
            setUserVote(data.userVote);
            // Restore existing resolution vote from server
            if (data.userResolutionVote) {
                setResolutionVote(data.userResolutionVote);
            }
        } catch {
            Alert.alert("Error", "Failed to load issue");
            router.canGoBack() ? router.back() : router.replace("/(tabs)");
        } finally {
            setLoading(false);
        }
    }, [id]);

    const fetchComments = useCallback(async () => {
        try {
            const data = await api(`/api/issues/${id}/comments?sort=hot`);
            setComments(data.comments ?? []);
        } catch {}
    }, [id]);

    useEffect(() => {
        fetchIssue();
        fetchComments();
    }, [fetchIssue, fetchComments]);

    // Fetch NGO info once for NGO users so we know their id + categories
    useEffect(() => {
        if (user?.role !== "NGO") return;
        api("/api/ngos/mine")
            .then((data) => {
                if (data?.ngo?.status === "APPROVED") {
                    setNgoInfo({
                        id: data.ngo.id,
                        categories: data.ngo.categories ?? [],
                    });
                }
            })
            .catch(() => {});
    }, [user?.role]);

    // ── Vote ──────────────────────────────────────────────────────────────
    const handleVote = async () => {
        if (!isAuthenticated) {
            router.push("/auth/signin");
            return;
        }
        setVoting(true);
        try {
            // Send 0 to remove an existing upvote, 1 to upvote
            const value = userVote === 1 ? 0 : 1;
            const res = await api(`/api/issues/${id}/vote`, {
                method: "POST",
                body: { value },
            });
            // Use server-returned values for consistency
            setUserVote(res.userVote ?? null);
            setIssue((prev) =>
                prev
                    ? {
                          ...prev,
                          upvotes: res.upvotes,
                      }
                    : prev,
            );
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        } catch (err: any) {
            Alert.alert("Error", err.message ?? "Failed to vote");
        } finally {
            setVoting(false);
        }
    };

    // ── Comment ──────────────────────────────────────────────────────────
    const handleComment = async () => {
        if (!commentText.trim()) return;
        setSendingComment(true);
        try {
            await api(`/api/issues/${id}/comments`, {
                method: "POST",
                body: { content: commentText.trim() },
            });
            setCommentText("");
            await fetchComments();
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch {
            Alert.alert("Error", "Failed to post comment");
        } finally {
            setSendingComment(false);
        }
    };

    // ── Resolution Verification ──────────────────────────────────────────
    const handleResolutionVote = async (vote: "YES" | "NO" | "IDK") => {
        if (!isAuthenticated) {
            router.push("/auth/signin");
            return;
        }
        setResolutionVote(vote);
        try {
            await api(`/api/resolution/vote/${id}`, {
                method: "POST",
                body: { vote },
            });
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch {
            Alert.alert("Error", "Failed to submit verification");
            setResolutionVote(null);
        }
    };

    // ── Upload Resolution Proof ──────────────────────────────────────────
    const handleUploadProof = async () => {
        const result = await ImagePicker.launchCameraAsync({
            quality: 0.8,
        });
        if (result.canceled) return;

        setUploadingProof(true);
        try {
            const uri = result.assets[0].uri;
            const ext = uri.split(".").pop()?.toLowerCase() ?? "jpg";
            const mime = ext === "jpg" ? "image/jpeg" : `image/${ext}`;
            const formData = new FormData();
            formData.append("files", {
                uri,
                type: mime,
                name: `proof.${ext}`,
            } as any);

            const uploadRes = await apiUpload("/api/upload", formData);
            const urls = uploadRes.urls ?? [];

            await api(`/api/resolution/report-nearby`, {
                method: "POST",
                body: { issueId: id, resolutionProof: urls },
            });

            Alert.alert(
                "Success",
                "Resolution proof submitted! Awaiting community verification.",
            );
            await fetchIssue();
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (err: any) {
            Alert.alert("Error", err.message ?? "Failed to upload proof");
        } finally {
            setUploadingProof(false);
        }
    };

    // ── NGO: Claim Issue ─────────────────────────────────────────────────
    const handleNGOClaim = () => {
        if (!issue) return;
        Alert.alert(
            "Claim Issue",
            `Take responsibility for resolving:\n"${issue.title}"?`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Claim",
                    onPress: async () => {
                        setNgoActionLoading(true);
                        try {
                            await api(`/api/issues/${id}/status`, {
                                method: "PATCH",
                                body: { status: "ASSIGNED" },
                            });
                            Haptics.notificationAsync(
                                Haptics.NotificationFeedbackType.Success,
                            );
                            Alert.alert(
                                "Claimed!",
                                "The issue is now assigned to your NGO.",
                            );
                            await fetchIssue();
                        } catch (err: any) {
                            Alert.alert(
                                "Error",
                                err.message ?? "Failed to claim issue",
                            );
                        } finally {
                            setNgoActionLoading(false);
                        }
                    },
                },
            ],
        );
    };

    // ── NGO: Submit Resolution Proof ─────────────────────────────────────
    const handleNGOResolve = async () => {
        const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
        if (result.canceled) return;

        setNgoActionLoading(true);
        try {
            const uri = result.assets[0].uri;
            const ext = uri.split(".").pop()?.toLowerCase() ?? "jpg";
            const mime = ext === "jpg" ? "image/jpeg" : `image/${ext}`;
            const formData = new FormData();
            formData.append("files", {
                uri,
                type: mime,
                name: `proof.${ext}`,
            } as any);

            const uploadRes = await apiUpload("/api/upload", formData);
            // Resolve relative paths to absolute URLs — the status route validates
            // resolutionProof entries with z.string().url() which rejects relative paths.
            const urls: string[] = (uploadRes.urls ?? []).map(resolveUrl);

            if (urls.length === 0) throw new Error("Image upload failed");

            await api(`/api/issues/${id}/status`, {
                method: "PATCH",
                body: { status: "RESOLVED", resolutionProof: urls },
            });

            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert(
                "Resolved!",
                "You've marked this issue as resolved. Upvoters will be asked to verify.",
            );
            await fetchIssue();
        } catch (err: any) {
            Alert.alert("Error", err.message ?? "Failed to submit resolution");
        } finally {
            setNgoActionLoading(false);
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
    const isReporter = user?.id === issue.reporterId;
    const isNGOUser = user?.role === "NGO" && ngoInfo !== null;
    const isAssignedNGO =
        isNGOUser && (issue as any).assignedNGO?.id === ngoInfo?.id;
    const canClaimAsNGO =
        isNGOUser &&
        (issue.status === "VERIFIED" || issue.status === "REPORTED") &&
        !(issue as any).assignedNGOId &&
        (ngoInfo?.categories ?? []).includes(issue.category);
    // Citizen resolve button: show for non-NGO authenticated users
    const canResolve =
        isAuthenticated &&
        user?.role !== "NGO" &&
        issue.status !== "RESOLVED" &&
        issue.status !== "CLOSED";

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={() => router.canGoBack() ? router.back() : router.replace("/(tabs)")}
                    style={styles.backBtn}
                >
                    <Ionicons
                        name="arrow-back"
                        size={20}
                        color={Colors.foreground}
                    />
                </TouchableOpacity>
                <View style={styles.headerRight}>
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
                            style={[styles.statusText, { color: statusColor }]}
                        >
                            {StatusLabels[issue.status]}
                        </Text>
                    </View>
                </View>
            </View>

            <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.scrollContent}
            >
                {/* Image carousel */}
                {issue.imageUrls.length > 0 && (
                    <ScrollView
                        horizontal
                        pagingEnabled
                        showsHorizontalScrollIndicator={false}
                        style={styles.imageCarousel}
                    >
                        {issue.imageUrls.map((url, i) => (
                            <Image
                                key={i}
                                source={{ uri: resolveUrl(url) }}
                                style={styles.carouselImage}
                                resizeMode="cover"
                            />
                        ))}
                    </ScrollView>
                )}

                <View style={styles.body}>
                    {/* Category & title */}
                    <View style={styles.categoryRow}>
                        <Text style={styles.categoryText}>
                            {CategoryEmoji[issue.category]}{" "}
                            {CategoryLabels[issue.category]}
                        </Text>
                        {issue.priority >= 7 && (
                            <View style={styles.priorityBadge}>
                                <Ionicons
                                    name="alert-circle"
                                    size={12}
                                    color="#ef4444"
                                />
                                <Text style={styles.priorityText}>
                                    High Priority
                                </Text>
                            </View>
                        )}
                    </View>

                    <Text style={styles.title}>{issue.title}</Text>
                    <Text style={styles.description}>{issue.description}</Text>

                    {/* Meta row */}
                    <View style={styles.metaRow}>
                        <Text style={styles.metaText}>
                            {formatDistanceToNow(new Date(issue.createdAt), {
                                addSuffix: true,
                            })}
                        </Text>
                        <Text style={styles.metaDot}>·</Text>
                        <Text style={styles.metaText}>
                            {issue._count.comments} comments
                        </Text>
                        <Text style={styles.metaDot}>·</Text>
                        <Text style={styles.metaText}>
                            {issue.viewCount} views
                        </Text>
                    </View>

                    {/* Vote button */}
                    <View style={styles.voteRow}>
                        <TouchableOpacity
                            style={[
                                styles.voteButton,
                                userVote === 1 && styles.voteButtonActive,
                            ]}
                            onPress={handleVote}
                            disabled={voting}
                        >
                            <Ionicons
                                name={
                                    userVote === 1
                                        ? "arrow-up-circle"
                                        : "arrow-up-circle-outline"
                                }
                                size={22}
                                color={
                                    userVote === 1
                                        ? Colors.primary
                                        : Colors.foreground
                                }
                            />
                            <Text
                                style={[
                                    styles.voteCount,
                                    userVote === 1 && { color: Colors.primary },
                                ]}
                            >
                                {issue.upvotes}
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {/* Reporter */}
                    <TouchableOpacity
                        style={styles.reporterCard}
                        onPress={() =>
                            router.push(`/profile/${issue.reporterId}`)
                        }
                    >
                        <View style={styles.avatar}>
                            {issue.reporter.image ? (
                                <Image
                                    source={{ uri: issue.reporter.image }}
                                    style={styles.avatarImage}
                                />
                            ) : (
                                <Text style={styles.avatarLetter}>
                                    {issue.reporter.name?.[0] ?? "?"}
                                </Text>
                            )}
                        </View>
                        <View style={styles.reporterInfo}>
                            <Text style={styles.reporterName}>
                                {issue.reporter.name ?? "Anonymous"}
                            </Text>
                            <Text style={styles.reporterTrust}>
                                Trust: {issue.reporter.trustScore}
                            </Text>
                        </View>
                        <Ionicons
                            name="chevron-forward"
                            size={16}
                            color={Colors.mutedText}
                        />
                    </TouchableOpacity>

                    {/* Lifecycle Timeline */}
                    <View style={styles.timelineSection}>
                        <Text style={styles.sectionTitle}>Issue Progress</Text>
                        {(() => {
                            const hasNGO =
                                !!(issue as any).assignedNGOId ||
                                issue.status === "ASSIGNED";
                            const timelineSteps = [
                                "REPORTED",
                                ...(hasNGO ? ["ASSIGNED"] : []),
                                "RESOLVED",
                            ];
                            const statusOrder = [
                                "REPORTED",
                                "ASSIGNED",
                                "RESOLVED",
                                "CLOSED",
                            ];
                            const currentIdx = statusOrder.indexOf(
                                issue.status === "VERIFIED"
                                    ? "REPORTED"
                                    : issue.status,
                            );

                            return timelineSteps.map((s, i) => {
                                const stepIdx = statusOrder.indexOf(s);
                                const completed =
                                    stepIdx <= currentIdx ||
                                    (s === "REPORTED" &&
                                        issue.status === "VERIFIED");
                                const isCurrent =
                                    s === issue.status ||
                                    (s === "REPORTED" &&
                                        issue.status === "VERIFIED");

                                return (
                                    <View key={s} style={styles.timelineItem}>
                                        <View
                                            style={[
                                                styles.timelineDot,
                                                completed &&
                                                    styles.timelineDotCompleted,
                                            ]}
                                        >
                                            {completed ? (
                                                <Ionicons
                                                    name="checkmark"
                                                    size={12}
                                                    color={
                                                        Colors.primaryForeground
                                                    }
                                                />
                                            ) : (
                                                <View
                                                    style={
                                                        styles.timelineDotInner
                                                    }
                                                />
                                            )}
                                        </View>
                                        {i < timelineSteps.length - 1 && (
                                            <View
                                                style={[
                                                    styles.timelineLine,
                                                    completed &&
                                                        styles.timelineLineCompleted,
                                                ]}
                                            />
                                        )}
                                        <Text
                                            style={[
                                                styles.timelineLabel,
                                                isCurrent &&
                                                    styles.timelineLabelActive,
                                            ]}
                                        >
                                            {StatusLabels[s]}
                                        </Text>
                                    </View>
                                );
                            });
                        })()}

                        {/* Deadline */}
                        {issue.deadline &&
                            issue.status !== "RESOLVED" &&
                            issue.status !== "CLOSED" && (
                                <View style={styles.deadlineBanner}>
                                    <Ionicons
                                        name={
                                            new Date(issue.deadline) <
                                            new Date()
                                                ? "alert-circle"
                                                : "time"
                                        }
                                        size={14}
                                        color={
                                            new Date(issue.deadline) <
                                            new Date()
                                                ? "#ef4444"
                                                : Colors.mutedText
                                        }
                                    />
                                    <Text
                                        style={[
                                            styles.deadlineText,
                                            new Date(issue.deadline) <
                                                new Date() && {
                                                color: "#ef4444",
                                            },
                                        ]}
                                    >
                                        {new Date(issue.deadline) < new Date()
                                            ? "Deadline passed "
                                            : "Due "}
                                        {formatDistanceToNow(
                                            new Date(issue.deadline),
                                            { addSuffix: true },
                                        )}
                                    </Text>
                                </View>
                            )}
                    </View>

                    {/* Resolution Proof */}
                    {issue.status === "RESOLVED" &&
                        (issue as any).resolutionProof?.length > 0 && (
                            <View style={styles.resolutionSection}>
                                <Text style={styles.sectionTitle}>
                                    Resolution Proof
                                </Text>
                                <ScrollView
                                    horizontal
                                    showsHorizontalScrollIndicator={false}
                                    style={styles.proofScroll}
                                >
                                    {(
                                        (issue as any)
                                            .resolutionProof as string[]
                                    ).map((url, i) => (
                                        <Image
                                            key={i}
                                            source={{ uri: resolveUrl(url) }}
                                            style={styles.proofImage}
                                            resizeMode="cover"
                                        />
                                    ))}
                                </ScrollView>

                                {/* Verification voting */}
                                {!resolutionVote && (
                                    <View style={styles.verifyCard}>
                                        <Text style={styles.verifyTitle}>
                                            Has this been resolved?
                                        </Text>
                                        <Text style={styles.verifySubtext}>
                                            Help verify if the issue has
                                            actually been fixed.
                                        </Text>
                                        <View style={styles.verifyButtons}>
                                            <TouchableOpacity
                                                style={styles.verifyYes}
                                                onPress={() =>
                                                    handleResolutionVote("YES")
                                                }
                                            >
                                                <Ionicons
                                                    name="checkmark-circle"
                                                    size={18}
                                                    color={Colors.success}
                                                />
                                                <Text
                                                    style={styles.verifyBtnText}
                                                >
                                                    Yes
                                                </Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                style={styles.verifyNo}
                                                onPress={() =>
                                                    handleResolutionVote("NO")
                                                }
                                            >
                                                <Ionicons
                                                    name="close-circle"
                                                    size={18}
                                                    color={Colors.destructive}
                                                />
                                                <Text
                                                    style={styles.verifyBtnText}
                                                >
                                                    No
                                                </Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                style={styles.verifyIdk}
                                                onPress={() =>
                                                    handleResolutionVote("IDK")
                                                }
                                            >
                                                <Ionicons
                                                    name="help-circle"
                                                    size={18}
                                                    color={Colors.mutedText}
                                                />
                                                <Text
                                                    style={styles.verifyBtnText}
                                                >
                                                    Not sure
                                                </Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                )}
                                {resolutionVote && (
                                    <View style={styles.verifyDone}>
                                        <Ionicons
                                            name="checkmark-circle"
                                            size={16}
                                            color={Colors.success}
                                        />
                                        <Text style={styles.verifyDoneText}>
                                            Thanks for verifying!
                                        </Text>
                                    </View>
                                )}
                            </View>
                        )}

                    {/* Citizen: upload resolution proof (non-NGO users only) */}
                    {canResolve && (
                        <TouchableOpacity
                            style={styles.resolveButton}
                            onPress={handleUploadProof}
                            disabled={uploadingProof}
                        >
                            {uploadingProof ? (
                                <ActivityIndicator
                                    size="small"
                                    color={Colors.success}
                                />
                            ) : (
                                <>
                                    <Ionicons
                                        name="camera"
                                        size={20}
                                        color={Colors.success}
                                    />
                                    <Text style={styles.resolveText}>
                                        Upload Resolution Proof
                                    </Text>
                                </>
                            )}
                        </TouchableOpacity>
                    )}

                    {/* NGO: Claim Issue (visible when issue is VERIFIED and category matches) */}
                    {canClaimAsNGO && (
                        <TouchableOpacity
                            style={styles.ngoClaimButton}
                            onPress={handleNGOClaim}
                            disabled={ngoActionLoading}
                        >
                            {ngoActionLoading ? (
                                <ActivityIndicator
                                    size="small"
                                    color={Colors.primaryForeground}
                                />
                            ) : (
                                <>
                                    <Ionicons
                                        name="hand-right"
                                        size={20}
                                        color={Colors.primaryForeground}
                                    />
                                    <Text style={styles.ngoClaimText}>
                                        Claim This Issue
                                    </Text>
                                </>
                            )}
                        </TouchableOpacity>
                    )}

                    {/* NGO: Submit Resolution Proof (visible when this NGO is assigned) */}
                    {isAssignedNGO && issue.status === "ASSIGNED" && (
                        <TouchableOpacity
                            style={styles.ngoResolveButton}
                            onPress={handleNGOResolve}
                            disabled={ngoActionLoading}
                        >
                            {ngoActionLoading ? (
                                <ActivityIndicator
                                    size="small"
                                    color={Colors.white}
                                />
                            ) : (
                                <>
                                    <Ionicons
                                        name="checkmark-circle"
                                        size={20}
                                        color={Colors.white}
                                    />
                                    <Text style={styles.ngoResolveText}>
                                        Mark as Resolved
                                    </Text>
                                </>
                            )}
                        </TouchableOpacity>
                    )}

                    {/* Comments */}
                    <View style={styles.commentsSection}>
                        <Text style={styles.sectionTitle}>
                            Comments ({issue._count.comments})
                        </Text>

                        {comments.map((comment) => (
                            <View key={comment.id} style={styles.commentCard}>
                                <View style={styles.commentHeader}>
                                    <View style={styles.commentAvatar}>
                                        <Text style={styles.commentAvatarText}>
                                            {comment.author.name?.[0] ?? "?"}
                                        </Text>
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.commentAuthor}>
                                            {comment.author.name ?? "Anonymous"}
                                        </Text>
                                        <Text style={styles.commentTime}>
                                            {formatDistanceToNow(
                                                new Date(comment.createdAt),
                                                {
                                                    addSuffix: true,
                                                },
                                            )}
                                        </Text>
                                    </View>
                                </View>
                                <Text style={styles.commentContent}>
                                    {comment.content}
                                </Text>
                            </View>
                        ))}

                        {/* Comment input */}
                        {isAuthenticated && (
                            <View style={styles.commentInput}>
                                <View style={styles.commentInputInner}>
                                    <TextInput
                                        style={styles.commentTextInput}
                                        placeholder="Add a comment..."
                                        placeholderTextColor={Colors.mutedText}
                                        value={commentText}
                                        onChangeText={setCommentText}
                                        multiline
                                        maxLength={500}
                                    />
                                    <TouchableOpacity
                                        onPress={handleComment}
                                        disabled={sendingComment || !commentText.trim()}
                                        style={[
                                            styles.commentSendBtn,
                                            (!commentText.trim() || sendingComment) && styles.commentSendBtnDisabled,
                                        ]}
                                    >
                                        {sendingComment ? (
                                            <ActivityIndicator size="small" color={Colors.primaryForeground} />
                                        ) : (
                                            <Ionicons name="send" size={16} color={Colors.primaryForeground} />
                                        )}
                                    </TouchableOpacity>
                                </View>
                            </View>
                        )}
                    </View>
                </View>
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
    headerRight: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },
    statusBadge: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        borderRadius: 20,
        paddingHorizontal: 10,
        paddingVertical: 5,
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
    scroll: { flex: 1 },
    scrollContent: { paddingBottom: 40 },
    imageCarousel: { height: 220 },
    carouselImage: { width, height: 220 },
    body: { padding: 16, gap: 16 },
    categoryRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },
    categoryText: {
        color: Colors.secondaryText,
        fontSize: FontSize.sm,
    },
    priorityBadge: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        backgroundColor: Colors.destructiveDim,
        borderRadius: 12,
        paddingHorizontal: 8,
        paddingVertical: 3,
    },
    priorityText: {
        color: "#ef4444",
        fontSize: FontSize.xs,
        fontWeight: "600",
    },
    title: {
        color: Colors.foreground,
        fontSize: FontSize.xl,
        fontWeight: "700",
        lineHeight: 26,
    },
    description: {
        color: Colors.secondaryText,
        fontSize: FontSize.base,
        lineHeight: 22,
    },
    metaRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
    },
    metaText: {
        color: Colors.mutedText,
        fontSize: FontSize.xs,
    },
    metaDot: {
        color: Colors.mutedText,
        fontSize: FontSize.xs,
    },
    voteRow: {
        flexDirection: "row",
    },
    voteButton: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        backgroundColor: Colors.glassBg,
        borderRadius: Radius.lg,
        borderWidth: 1,
        borderColor: Colors.border,
        paddingHorizontal: 14,
        paddingVertical: 8,
    },
    voteButtonActive: {
        backgroundColor: Colors.primaryDim,
        borderColor: "rgba(245,158,11,0.3)",
    },
    voteCount: {
        color: Colors.foreground,
        fontSize: FontSize.base,
        fontWeight: "600",
    },
    reporterCard: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        backgroundColor: Colors.glassBg,
        borderRadius: Radius.xl,
        borderWidth: 1,
        borderColor: Colors.border,
        padding: 12,
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
    reporterInfo: { flex: 1 },
    reporterName: {
        color: Colors.foreground,
        fontSize: FontSize.base,
        fontWeight: "500",
    },
    reporterTrust: {
        color: Colors.mutedText,
        fontSize: FontSize.xs,
    },
    timelineSection: {
        gap: 8,
    },
    sectionTitle: {
        color: Colors.foreground,
        fontSize: FontSize.md,
        fontWeight: "600",
        marginBottom: 4,
    },
    timelineItem: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        height: 32,
    },
    timelineDot: {
        width: 22,
        height: 22,
        borderRadius: 11,
        borderWidth: 2,
        borderColor: Colors.border,
        backgroundColor: Colors.glassBg,
        justifyContent: "center",
        alignItems: "center",
    },
    timelineDotCompleted: {
        backgroundColor: Colors.primary,
        borderColor: Colors.primary,
    },
    timelineDotInner: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: Colors.mutedText,
    },
    timelineLine: {
        position: "absolute",
        left: 10,
        top: 24,
        width: 2,
        height: 8,
        backgroundColor: Colors.border,
    },
    timelineLineCompleted: {
        backgroundColor: Colors.primary,
    },
    timelineLabel: {
        color: Colors.mutedText,
        fontSize: FontSize.sm,
    },
    timelineLabelActive: {
        color: Colors.foreground,
        fontWeight: "600",
    },
    deadlineBanner: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        marginTop: 4,
    },
    deadlineText: {
        color: Colors.mutedText,
        fontSize: FontSize.xs,
    },
    resolutionSection: {
        gap: 12,
    },
    proofScroll: {},
    proofImage: {
        width: 160,
        height: 110,
        borderRadius: Radius.lg,
        marginRight: 8,
    },
    verifyCard: {
        backgroundColor: Colors.successDim,
        borderRadius: Radius.xl,
        borderWidth: 1,
        borderColor: "rgba(34,197,94,0.2)",
        padding: 14,
        gap: 8,
    },
    verifyTitle: {
        color: Colors.success,
        fontSize: FontSize.sm,
        fontWeight: "600",
    },
    verifySubtext: {
        color: Colors.mutedText,
        fontSize: FontSize.xs,
    },
    verifyButtons: {
        flexDirection: "row",
        gap: 8,
    },
    verifyYes: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 4,
        backgroundColor: Colors.glassBg,
        borderRadius: Radius.lg,
        borderWidth: 1,
        borderColor: Colors.border,
        paddingVertical: 10,
    },
    verifyNo: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 4,
        backgroundColor: Colors.glassBg,
        borderRadius: Radius.lg,
        borderWidth: 1,
        borderColor: Colors.border,
        paddingVertical: 10,
    },
    verifyIdk: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 4,
        backgroundColor: Colors.glassBg,
        borderRadius: Radius.lg,
        borderWidth: 1,
        borderColor: Colors.border,
        paddingVertical: 10,
    },
    verifyBtnText: {
        color: Colors.foreground,
        fontSize: FontSize.sm,
        fontWeight: "500",
    },
    verifyDone: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingVertical: 4,
    },
    verifyDoneText: {
        color: Colors.success,
        fontSize: FontSize.sm,
    },
    resolveButton: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        backgroundColor: Colors.successDim,
        borderRadius: Radius.xl,
        borderWidth: 1,
        borderColor: "rgba(34,197,94,0.2)",
        paddingVertical: 14,
    },
    resolveText: {
        color: Colors.success,
        fontSize: FontSize.md,
        fontWeight: "600",
    },
    ngoClaimButton: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        backgroundColor: Colors.primary,
        borderRadius: Radius.xl,
        paddingVertical: 14,
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 6,
    },
    ngoClaimText: {
        color: Colors.primaryForeground,
        fontSize: FontSize.md,
        fontWeight: "700",
    },
    ngoResolveButton: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        backgroundColor: Colors.success,
        borderRadius: Radius.xl,
        paddingVertical: 14,
        shadowColor: Colors.success,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 6,
    },
    ngoResolveText: {
        color: Colors.white,
        fontSize: FontSize.md,
        fontWeight: "700",
    },
    commentsSection: {
        gap: 12,
    },
    commentCard: {
        backgroundColor: Colors.glassBg,
        borderRadius: Radius.xl,
        borderWidth: 1,
        borderColor: Colors.border,
        padding: 12,
        gap: 8,
    },
    commentHeader: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
    },
    commentAvatar: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: Colors.primaryDim,
        justifyContent: "center",
        alignItems: "center",
    },
    commentAvatarText: {
        color: Colors.primary,
        fontSize: FontSize.xs,
        fontWeight: "600",
    },
    commentAuthor: {
        color: Colors.foreground,
        fontSize: FontSize.sm,
        fontWeight: "500",
    },
    commentTime: {
        color: Colors.mutedText,
        fontSize: FontSize["2xs"],
    },
    commentContent: {
        color: Colors.secondaryText,
        fontSize: FontSize.sm,
        lineHeight: 20,
    },
    commentInput: {
        marginTop: 4,
    },
    commentInputInner: {
        flexDirection: "row",
        alignItems: "flex-end",
        gap: 8,
        backgroundColor: Colors.glassBg,
        borderRadius: Radius.xl,
        borderWidth: 1,
        borderColor: Colors.border,
        paddingHorizontal: 14,
        paddingVertical: 12,
    },
    commentTextInput: {
        flex: 1,
        backgroundColor: Colors.glassBg,
        borderRadius: Radius.xl,
        borderWidth: 1,
        borderColor: Colors.border,
        paddingHorizontal: 14,
        paddingVertical: 10,
        color: Colors.foreground,
        fontSize: FontSize.sm,
        maxHeight: 100,
    },
    commentSendBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: Colors.primary,
        justifyContent: "center",
        alignItems: "center",
        marginBottom: 1,
    },
    commentSendBtnDisabled: {
        opacity: 0.4,
    },
});
