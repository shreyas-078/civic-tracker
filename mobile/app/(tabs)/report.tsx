import { useState, useEffect, useCallback, useRef } from "react";
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TextInput,
    TouchableOpacity,
    Image,
    ActivityIndicator,
    Alert,
    Dimensions,
    KeyboardAvoidingView,
    Platform,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
    Colors,
    CategoryEmoji,
    CategoryLabels,
    Radius,
    Spacing,
    FontSize,
} from "@/constants/theme";
import { useLocation } from "@/stores/location";
import { useAuth } from "@/stores/auth";
import { api, apiUpload } from "@/lib/api";
import { haversineKm } from "@/lib/geo";
import LeafletMap, { MapCircle } from "@/components/LeafletMap";
import type { IssueCategory } from "@/types";

const { width } = Dimensions.get("window");
const MAX_IMAGES = 5;
const MAX_REPORT_DISTANCE_KM = 2;

const CATEGORIES: { value: IssueCategory; emoji: string; label: string }[] = [
    { value: "ROAD", emoji: "🛣️", label: "Road" },
    { value: "WATER", emoji: "💧", label: "Water" },
    { value: "ELECTRICITY", emoji: "⚡", label: "Electric" },
    { value: "SANITATION", emoji: "🗑️", label: "Sanitation" },
    { value: "PUBLIC_SPACE", emoji: "🏙️", label: "Public" },
    { value: "ENVIRONMENT", emoji: "🌱", label: "Environ." },
    { value: "LOST_FOUND", emoji: "🔍", label: "Lost" },
    { value: "OTHER", emoji: "📌", label: "Other" },
];

const STEPS = ["Location", "Details", "Photos", "Review"];

export default function ReportScreen() {
    const router = useRouter();
    const { location } = useLocation();
    const { isAuthenticated, user } = useAuth();

    const [step, setStep] = useState(0);
    const [pinLocation, setPinLocation] = useState({
        lat: location?.lat ?? 28.6139,
        lng: location?.lng ?? 77.209,
    });
    const [category, setCategory] = useState<IssueCategory>("ROAD");
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [bounty, setBounty] = useState("");
    const [images, setImages] = useState<string[]>([]);
    const [submitting, setSubmitting] = useState(false);
    const [analyzing, setAnalyzing] = useState(false);

    useEffect(() => {
        if (location) {
            setPinLocation({ lat: location.lat, lng: location.lng });
        }
    }, [location]);

    // Redirect if not authenticated
    useEffect(() => {
        if (!isAuthenticated) {
            router.replace("/auth/signin");
        }
    }, [isAuthenticated]);

    const isPersonal = category === "LOST_FOUND";

    // ── Image picker ──────────────────────────────────────────────────
    const pickImage = useCallback(
        async (useCamera: boolean) => {
            if (images.length >= MAX_IMAGES) {
                Alert.alert(
                    "Limit reached",
                    `Maximum ${MAX_IMAGES} photos allowed`,
                );
                return;
            }

            const picker = useCamera
                ? ImagePicker.launchCameraAsync
                : ImagePicker.launchImageLibraryAsync;

            const result = await picker({
                mediaTypes: ["images"],
                quality: 0.8,
                allowsMultipleSelection: !useCamera,
                selectionLimit: MAX_IMAGES - images.length,
            });

            if (!result.canceled) {
                const newUris = result.assets.map((a) => a.uri);
                setImages((prev) => [...prev, ...newUris].slice(0, MAX_IMAGES));
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }
        },
        [images],
    );

    const removeImage = (index: number) => {
        setImages((prev) => prev.filter((_, i) => i !== index));
    };

    // ── Upload images ──────────────────────────────────────────────────
    async function uploadImages(): Promise<string[]> {
        if (images.length === 0) return [];

        const formData = new FormData();
        images.forEach((uri, i) => {
            const ext = uri.split(".").pop()?.toLowerCase() ?? "jpg";
            const mime = ext === "jpg" ? "image/jpeg" : `image/${ext}`;
            formData.append("files", {
                uri,
                type: mime,
                name: `photo_${i}.${ext}`,
            } as any);
        });

        const data = await apiUpload("/api/upload", formData);
        return data.urls ?? [];
    }

    // ── Submit ──────────────────────────────────────────────────────────
    async function handleSubmit() {
        if (!title.trim() || title.length < 10) {
            Alert.alert("Validation", "Title must be at least 10 characters");
            return;
        }
        if (!description.trim() || description.length < 20) {
            Alert.alert(
                "Validation",
                "Description must be at least 20 characters",
            );
            return;
        }

        // Geofence check
        if (location) {
            const dist = haversineKm(
                location.lat,
                location.lng,
                pinLocation.lat,
                pinLocation.lng,
            );
            if (dist > MAX_REPORT_DISTANCE_KM) {
                Alert.alert(
                    "Too far",
                    "Report location must be within 2km of your current location.",
                );
                return;
            }
        }

        setSubmitting(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        try {
            // 1. Upload images
            const uploadedUrls = await uploadImages();

            // 2. AI Analysis + image moderation (server-side, in one LLaVA call)
            let aiAnalysis = null;
            setAnalyzing(true);
            try {
                const aiRes = await api("/api/ai/analyze-issue", {
                    method: "POST",
                    body: {
                        title,
                        imageUrls: uploadedUrls,
                        description,
                        lat: pinLocation.lat,
                        lng: pinLocation.lng,
                    },
                });
                aiAnalysis = aiRes;

                // Block here if image moderation failed — before creating the issue
                if (aiRes.imageModerationPassed === false) {
                    setSubmitting(false);
                    setAnalyzing(false);
                    Haptics.notificationAsync(
                        Haptics.NotificationFeedbackType.Error,
                    );
                    Alert.alert(
                        "Image Not Accepted",
                        aiRes.imageModerationReason
                            ? aiRes.imageModerationReason
                            : "Your photo does not appear to show the reported issue. Please attach a photo that clearly shows the problem you are describing.",
                    );
                    return;
                }
            } catch {
                // AI failure is non-blocking — submission proceeds without analysis
            }
            setAnalyzing(false);

            // 3. Create issue
            const result = await api("/api/issues", {
                method: "POST",
                body: {
                    title: title.trim(),
                    description: description.trim(),
                    category,
                    lat: pinLocation.lat,
                    lng: pinLocation.lng,
                    imageUrls: uploadedUrls,
                    isPersonal,
                    bounty: isPersonal && bounty ? parseInt(bounty) : undefined,
                    userLat: location?.lat,
                    userLng: location?.lng,
                    aiAnalysis,
                },
            });

            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

            // Reset form immediately so returning to this tab starts fresh
            const resetLat = location?.lat ?? 28.6139;
            const resetLng = location?.lng ?? 77.209;
            setStep(0);
            setTitle("");
            setDescription("");
            setBounty("");
            setCategory("ROAD");
            setImages([]);
            setPinLocation({ lat: resetLat, lng: resetLng });

            if (result.isDuplicate && result.redirectTo) {
                Alert.alert(
                    "Merged",
                    "Your report was merged with an existing issue.",
                );
                router.replace(`/issues/${result.redirectTo.split("/").pop()}`);
                return;
            }

            Alert.alert("Success", "Issue reported successfully!", [
                {
                    text: "View Issue",
                    onPress: () => router.replace(`/issues/${result.id}`),
                },
                { text: "OK", onPress: () => router.back() },
            ]);
        } catch (err: any) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            Alert.alert("Error", err.message ?? "Something went wrong");
        } finally {
            setSubmitting(false);
            setAnalyzing(false);
        }
    }

    // ── Step navigation ──────────────────────────────────────────────────
    const canNext = () => {
        if (step === 0) return true;
        if (step === 1) return title.length >= 10 && description.length >= 20;
        if (step === 2) return true; // photos optional
        return true;
    };

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={() =>
                        step > 0 ? setStep(step - 1) : router.back()
                    }
                    style={styles.backButton}
                >
                    <Ionicons
                        name={step > 0 ? "arrow-back" : "close"}
                        size={20}
                        color={Colors.foreground}
                    />
                </TouchableOpacity>
                <View style={styles.headerCenter}>
                    <Text style={styles.headerTitle}>Report Issue</Text>
                    {/* Progress dots */}
                    <View style={styles.progressRow}>
                        {STEPS.map((_, i) => (
                            <View
                                key={i}
                                style={[
                                    styles.progressDot,
                                    i <= step && styles.progressDotActive,
                                ]}
                            />
                        ))}
                    </View>
                </View>
                <Text style={styles.stepLabel}>{step + 1}/4</Text>
            </View>

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.content}
                keyboardShouldPersistTaps="handled"
            >
                {/* ── Step 0: Location ── */}
                {step === 0 && (
                    <View style={styles.stepContainer}>
                        <Text style={styles.stepTitle}>
                            Where is the issue?
                        </Text>
                        <Text style={styles.stepSub}>
                            Drag the pin to the exact location of the issue.
                        </Text>

                        <View style={styles.mapContainer}>
                            <LeafletMap
                                center={[pinLocation.lat, pinLocation.lng]}
                                zoom={15}
                                showUserLocation={!!location}
                                userLat={location?.lat}
                                userLng={location?.lng}
                                draggablePin
                                pinLat={pinLocation.lat}
                                pinLng={pinLocation.lng}
                                circles={
                                    location
                                        ? [
                                              {
                                                  lat: location.lat,
                                                  lng: location.lng,
                                                  radiusKm: 2,
                                                  fillColor:
                                                      "rgba(245, 158, 11, 0.05)",
                                                  strokeColor:
                                                      "rgba(245, 158, 11, 0.15)",
                                              },
                                          ]
                                        : []
                                }
                                lockToCircle={!!location}
                                onPinDrag={(lat, lng) => {
                                    setPinLocation({ lat, lng });
                                    Haptics.impactAsync(
                                        Haptics.ImpactFeedbackStyle.Light,
                                    );
                                }}
                                style={styles.miniMap}
                            />
                        </View>

                        <View style={styles.coordsBadge}>
                            <Ionicons
                                name="location"
                                size={12}
                                color={Colors.primary}
                            />
                            <Text style={styles.coordsText}>
                                {pinLocation.lat.toFixed(5)},{" "}
                                {pinLocation.lng.toFixed(5)}
                            </Text>
                        </View>
                    </View>
                )}

                {/* ── Step 1: Details ── */}
                {step === 1 && (
                    <View style={styles.stepContainer}>
                        <Text style={styles.stepTitle}>Describe the issue</Text>

                        {/* Category selector */}
                        <Text style={styles.label}>Category</Text>
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            style={styles.categoryScroll}
                        >
                            {CATEGORIES.map((cat) => (
                                <TouchableOpacity
                                    key={cat.value}
                                    style={[
                                        styles.categoryChip,
                                        category === cat.value &&
                                            styles.categoryChipActive,
                                    ]}
                                    onPress={() => {
                                        setCategory(cat.value);
                                        Haptics.selectionAsync();
                                    }}
                                >
                                    <Text style={styles.categoryEmoji}>
                                        {cat.emoji}
                                    </Text>
                                    <Text
                                        style={[
                                            styles.categoryLabel,
                                            category === cat.value &&
                                                styles.categoryLabelActive,
                                        ]}
                                    >
                                        {cat.label}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>

                        <Text style={styles.label}>Title</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="e.g. Large pothole on MG Road"
                            placeholderTextColor={Colors.mutedText}
                            value={title}
                            onChangeText={setTitle}
                            maxLength={200}
                        />
                        {title.length > 0 && title.length < 10 && (
                            <Text style={styles.error}>
                                At least 10 characters
                            </Text>
                        )}

                        <Text style={styles.label}>Description</Text>
                        <TextInput
                            style={[styles.input, styles.textArea]}
                            placeholder="Describe the issue — landmarks, severity, how long it's been there..."
                            placeholderTextColor={Colors.mutedText}
                            value={description}
                            onChangeText={setDescription}
                            multiline
                            numberOfLines={4}
                            maxLength={2000}
                            textAlignVertical="top"
                        />
                        {description.length > 0 && description.length < 20 && (
                            <Text style={styles.error}>
                                At least 20 characters
                            </Text>
                        )}

                        {isPersonal && (
                            <View style={styles.bountyContainer}>
                                <Text style={styles.label}>
                                    Bounty (₹) — optional
                                </Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="0"
                                    placeholderTextColor={Colors.mutedText}
                                    value={bounty}
                                    onChangeText={setBounty}
                                    keyboardType="numeric"
                                />
                            </View>
                        )}
                    </View>
                )}

                {/* ── Step 2: Photos ── */}
                {step === 2 && (
                    <View style={styles.stepContainer}>
                        <Text style={styles.stepTitle}>Add photos</Text>
                        <Text style={styles.stepSub}>
                            Photos help verify the issue. Up to {MAX_IMAGES}{" "}
                            photos.
                        </Text>

                        <View style={styles.imageGrid}>
                            {images.map((uri, i) => (
                                <View key={i} style={styles.imageThumb}>
                                    <Image
                                        source={{ uri }}
                                        style={styles.thumbImage}
                                    />
                                    <TouchableOpacity
                                        style={styles.removeImage}
                                        onPress={() => removeImage(i)}
                                    >
                                        <Ionicons
                                            name="close"
                                            size={14}
                                            color={Colors.white}
                                        />
                                    </TouchableOpacity>
                                </View>
                            ))}

                            {images.length < MAX_IMAGES && (
                                <>
                                    <TouchableOpacity
                                        style={styles.addImageBtn}
                                        onPress={() => pickImage(true)}
                                    >
                                        <Ionicons
                                            name="camera"
                                            size={28}
                                            color={Colors.primary}
                                        />
                                        <Text style={styles.addImageText}>
                                            Camera
                                        </Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={styles.addImageBtn}
                                        onPress={() => pickImage(false)}
                                    >
                                        <Ionicons
                                            name="images"
                                            size={28}
                                            color={Colors.primary}
                                        />
                                        <Text style={styles.addImageText}>
                                            Gallery
                                        </Text>
                                    </TouchableOpacity>
                                </>
                            )}
                        </View>

                        <TouchableOpacity
                            style={styles.skipLink}
                            onPress={() => setStep(3)}
                        >
                            <Text style={styles.skipText}>Skip photos →</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* ── Step 3: Review ── */}
                {step === 3 && (
                    <View style={styles.stepContainer}>
                        <Text style={styles.stepTitle}>Review your report</Text>

                        <View style={styles.reviewCard}>
                            <View style={styles.reviewRow}>
                                <Text style={styles.reviewLabel}>Category</Text>
                                <Text style={styles.reviewValue}>
                                    {CategoryEmoji[category]}{" "}
                                    {CategoryLabels[category]}
                                </Text>
                            </View>
                            <View style={styles.reviewRow}>
                                <Text style={styles.reviewLabel}>Title</Text>
                                <Text style={styles.reviewValue}>{title}</Text>
                            </View>
                            <View style={styles.reviewRow}>
                                <Text style={styles.reviewLabel}>
                                    Description
                                </Text>
                                <Text
                                    style={styles.reviewValue}
                                    numberOfLines={3}
                                >
                                    {description}
                                </Text>
                            </View>
                            <View style={styles.reviewRow}>
                                <Text style={styles.reviewLabel}>Location</Text>
                                <Text style={styles.reviewValue}>
                                    {pinLocation.lat.toFixed(4)},{" "}
                                    {pinLocation.lng.toFixed(4)}
                                </Text>
                            </View>
                            <View style={styles.reviewRow}>
                                <Text style={styles.reviewLabel}>Photos</Text>
                                <Text style={styles.reviewValue}>
                                    {images.length} attached
                                </Text>
                            </View>
                            {isPersonal && bounty && (
                                <View style={styles.reviewRow}>
                                    <Text style={styles.reviewLabel}>
                                        Bounty
                                    </Text>
                                    <Text style={styles.reviewValue}>
                                        ₹{bounty}
                                    </Text>
                                </View>
                            )}
                        </View>

                        {analyzing && (
                            <View style={styles.analyzingBanner}>
                                <ActivityIndicator
                                    size="small"
                                    color={Colors.primary}
                                />
                                <Text style={styles.analyzingText}>
                                    AI is analyzing your report...
                                </Text>
                            </View>
                        )}
                    </View>
                )}
            </ScrollView>

            {/* Bottom action */}
            <View style={styles.bottomBar}>
                {step < 3 ? (
                    <TouchableOpacity
                        style={[
                            styles.nextButton,
                            !canNext() && styles.buttonDisabled,
                        ]}
                        onPress={() => {
                            if (canNext()) {
                                setStep(step + 1);
                                Haptics.impactAsync(
                                    Haptics.ImpactFeedbackStyle.Light,
                                );
                            }
                        }}
                        disabled={!canNext()}
                        activeOpacity={0.8}
                    >
                        <Text style={styles.nextButtonText}>Continue</Text>
                        <Ionicons
                            name="arrow-forward"
                            size={18}
                            color={Colors.primaryForeground}
                        />
                    </TouchableOpacity>
                ) : (
                    <TouchableOpacity
                        style={[
                            styles.submitButton,
                            submitting && styles.buttonDisabled,
                        ]}
                        onPress={handleSubmit}
                        disabled={submitting}
                        activeOpacity={0.8}
                    >
                        {submitting ? (
                            <ActivityIndicator
                                size="small"
                                color={Colors.primaryForeground}
                            />
                        ) : (
                            <>
                                <Ionicons
                                    name="checkmark-circle"
                                    size={20}
                                    color={Colors.primaryForeground}
                                />
                                <Text style={styles.submitButtonText}>
                                    Submit Report
                                </Text>
                            </>
                        )}
                    </TouchableOpacity>
                )}
            </View>
        </KeyboardAvoidingView>
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
        paddingTop: Platform.OS === "ios" ? 56 : 40,
        paddingHorizontal: 16,
        paddingBottom: 12,
        backgroundColor: Colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
    },
    backButton: {
        width: 36,
        height: 36,
        borderRadius: 10,
        justifyContent: "center",
        alignItems: "center",
    },
    headerCenter: {
        flex: 1,
        marginLeft: 8,
    },
    headerTitle: {
        color: Colors.foreground,
        fontSize: FontSize.md,
        fontWeight: "600",
    },
    progressRow: {
        flexDirection: "row",
        gap: 4,
        marginTop: 6,
    },
    progressDot: {
        flex: 1,
        height: 3,
        borderRadius: 2,
        backgroundColor: "rgba(255,255,255,0.06)",
    },
    progressDotActive: {
        backgroundColor: Colors.primary,
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.4,
        shadowRadius: 4,
    },
    stepLabel: {
        color: Colors.mutedText,
        fontSize: FontSize.xs,
        fontWeight: "500",
    },
    scrollView: {
        flex: 1,
    },
    content: {
        padding: 16,
        paddingBottom: 140,
    },
    stepContainer: {
        gap: 12,
    },
    stepTitle: {
        color: Colors.foreground,
        fontSize: FontSize.lg,
        fontWeight: "600",
    },
    stepSub: {
        color: Colors.mutedText,
        fontSize: FontSize.sm,
    },
    mapContainer: {
        height: 220,
        borderRadius: Radius["2xl"],
        overflow: "hidden",
        borderWidth: 1,
        borderColor: Colors.border,
    },
    miniMap: {
        flex: 1,
    },
    coordsBadge: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        backgroundColor: Colors.glassBg,
        borderRadius: Radius.lg,
        borderWidth: 1,
        borderColor: Colors.border,
        paddingHorizontal: 12,
        paddingVertical: 8,
        alignSelf: "flex-start",
    },
    coordsText: {
        color: Colors.mutedText,
        fontSize: FontSize.xs,
    },
    label: {
        color: Colors.secondaryText,
        fontSize: FontSize.sm,
        marginTop: 4,
    },
    categoryScroll: {
        marginHorizontal: -4,
    },
    categoryChip: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        backgroundColor: Colors.glassBg,
        borderRadius: Radius.lg,
        borderWidth: 1,
        borderColor: Colors.border,
        paddingHorizontal: 12,
        paddingVertical: 8,
        marginHorizontal: 4,
    },
    categoryChipActive: {
        backgroundColor: Colors.primaryDim,
        borderColor: "rgba(245,158,11,0.3)",
    },
    categoryEmoji: {
        fontSize: 16,
    },
    categoryLabel: {
        color: Colors.secondaryText,
        fontSize: FontSize.sm,
        fontWeight: "500",
    },
    categoryLabelActive: {
        color: Colors.primary,
    },
    input: {
        backgroundColor: Colors.glassBg,
        borderRadius: Radius.lg,
        borderWidth: 1,
        borderColor: Colors.border,
        paddingHorizontal: 14,
        paddingVertical: 12,
        color: Colors.foreground,
        fontSize: FontSize.base,
    },
    textArea: {
        minHeight: 100,
    },
    error: {
        color: "#ef4444",
        fontSize: FontSize.xs,
        marginTop: -6,
    },
    bountyContainer: {
        gap: 4,
    },
    imageGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 10,
    },
    imageThumb: {
        width: (width - 52) / 3,
        height: (width - 52) / 3,
        borderRadius: Radius.lg,
        overflow: "hidden",
        position: "relative",
    },
    thumbImage: {
        width: "100%",
        height: "100%",
    },
    removeImage: {
        position: "absolute",
        top: 4,
        right: 4,
        width: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: "rgba(0,0,0,0.7)",
        justifyContent: "center",
        alignItems: "center",
    },
    addImageBtn: {
        width: (width - 52) / 3,
        height: (width - 52) / 3,
        borderRadius: Radius.lg,
        borderWidth: 1,
        borderColor: Colors.border,
        borderStyle: "dashed",
        justifyContent: "center",
        alignItems: "center",
        gap: 4,
    },
    addImageText: {
        color: Colors.mutedText,
        fontSize: FontSize.xs,
    },
    skipLink: {
        alignSelf: "center",
        paddingVertical: 8,
    },
    skipText: {
        color: Colors.secondaryText,
        fontSize: FontSize.sm,
    },
    reviewCard: {
        backgroundColor: Colors.glassBg,
        borderRadius: Radius["2xl"],
        borderWidth: 1,
        borderColor: Colors.border,
        padding: 16,
        gap: 12,
    },
    reviewRow: {
        gap: 2,
    },
    reviewLabel: {
        color: Colors.mutedText,
        fontSize: FontSize.xs,
        fontWeight: "500",
        textTransform: "uppercase",
        letterSpacing: 0.5,
    },
    reviewValue: {
        color: Colors.foreground,
        fontSize: FontSize.base,
    },
    analyzingBanner: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        backgroundColor: Colors.primaryMuted,
        borderRadius: Radius.lg,
        paddingHorizontal: 14,
        paddingVertical: 10,
    },
    analyzingText: {
        color: Colors.primary,
        fontSize: FontSize.sm,
    },
    bottomBar: {
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        padding: 16,
        paddingBottom: Platform.OS === "ios" ? 36 : 24,
        backgroundColor: Colors.surface,
        borderTopWidth: 1,
        borderTopColor: Colors.border,
        elevation: 8,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
    },
    nextButton: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        backgroundColor: Colors.primary,
        borderRadius: Radius.lg,
        paddingVertical: 14,
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 6,
    },
    nextButtonText: {
        color: Colors.primaryForeground,
        fontSize: FontSize.md,
        fontWeight: "600",
    },
    submitButton: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        backgroundColor: Colors.success,
        borderRadius: Radius.lg,
        paddingVertical: 14,
        shadowColor: Colors.success,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 6,
    },
    submitButtonText: {
        color: Colors.white,
        fontSize: FontSize.md,
        fontWeight: "600",
    },
    buttonDisabled: {
        opacity: 0.5,
    },
});
