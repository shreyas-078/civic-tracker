import { useEffect, useState, useCallback } from "react";
import {
    View,
    StyleSheet,
    Text,
    TouchableOpacity,
    ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Colors, StatusColors, CategoryEmoji, Radius } from "@/constants/theme";
import { useLocation } from "@/stores/location";
import { useAuth } from "@/stores/auth";
import { api } from "@/lib/api";
import LeafletMap, { MapMarker, MapCircle } from "@/components/LeafletMap";
import type { IssuePinData } from "@/types";

const DEFAULT_CENTER: [number, number] = [28.6139, 77.209]; // [lat, lng]
const DEFAULT_ZOOM = 13;

export default function MapScreen() {
    const router = useRouter();
    const { location, requestLocation, isLoading: locLoading } = useLocation();
    const { isAuthenticated } = useAuth();

    const [issues, setIssues] = useState<IssuePinData[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchIssues = useCallback(async () => {
        // Only fetch once we have the user's actual location
        if (!location) return;
        try {
            const data = await api(
                `/api/issues?lat=${location.lat}&lng=${location.lng}&radiusKm=5&limit=200`,
            );
            setIssues(data.issues ?? []);
        } catch (err) {
            console.error("Failed to fetch issues:", err);
        } finally {
            setLoading(false);
        }
    }, [location]);

    useEffect(() => {
        fetchIssues();
    }, [fetchIssues]);

    // Live polling — refresh issues every 10 seconds so new reports appear instantly
    useEffect(() => {
        if (!location) return;
        const interval = setInterval(() => {
            fetchIssues();
        }, 10_000);
        return () => clearInterval(interval);
    }, [fetchIssues, location]);

    if (locLoading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color={Colors.primary} />
                <Text style={styles.loadingText}>Finding your location...</Text>
            </View>
        );
    }

    const center: [number, number] = location
        ? [location.lat, location.lng]
        : DEFAULT_CENTER;

    const markers: MapMarker[] = issues.map((issue) => ({
        id: issue.id,
        lat: issue.lat,
        lng: issue.lng,
        color: StatusColors[issue.status] ?? Colors.primary,
        emoji: CategoryEmoji[issue.category] ?? "📌",
    }));

    const circles: MapCircle[] = location
        ? [
              {
                  lat: location.lat,
                  lng: location.lng,
                  radiusKm: 2,
                  fillColor: "rgba(245, 158, 11, 0.06)",
                  strokeColor: "rgba(245, 158, 11, 0.2)",
              },
          ]
        : [];

    return (
        <View style={styles.container}>
            <LeafletMap
                center={center}
                zoom={DEFAULT_ZOOM}
                markers={markers}
                circles={circles}
                showUserLocation={!!location}
                userLat={location?.lat}
                userLng={location?.lng}
                onMarkerPress={(id) => router.push(`/issues/${id}`)}
                style={styles.map}
            />

            {/* Top bar overlay */}
            <View style={styles.topBar}>
                <View style={styles.topBarInner}>
                    <Ionicons
                        name="location"
                        size={14}
                        color={Colors.primary}
                    />
                    <Text style={styles.topBarText}>
                        {issues.length} issues nearby
                    </Text>
                </View>
            </View>

            {/* Report FAB */}
            {isAuthenticated && (
                <TouchableOpacity
                    style={styles.reportFab}
                    onPress={() => router.push("/report")}
                    activeOpacity={0.8}
                >
                    <Ionicons
                        name="add"
                        size={28}
                        color={Colors.primaryForeground}
                    />
                </TouchableOpacity>
            )}

            {/* Sign in prompt for non-authenticated users */}
            {!isAuthenticated && (
                <TouchableOpacity
                    style={styles.signInBanner}
                    onPress={() => router.push("/auth/signin")}
                    activeOpacity={0.8}
                >
                    <Ionicons
                        name="log-in-outline"
                        size={18}
                        color={Colors.primary}
                    />
                    <Text style={styles.signInText}>
                        Sign in to report issues
                    </Text>
                </TouchableOpacity>
            )}
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
    loadingText: {
        color: Colors.mutedText,
        fontSize: 13,
    },
    map: {
        flex: 1,
    },
    topBar: {
        position: "absolute",
        top: 60,
        left: 16,
        right: 16,
    },
    topBarInner: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        backgroundColor: "rgba(12, 10, 7, 0.88)",
        borderRadius: Radius["2xl"],
        borderWidth: 1,
        borderColor: Colors.border,
        paddingHorizontal: 14,
        paddingVertical: 10,
        alignSelf: "flex-start",
    },
    topBarText: {
        color: Colors.foreground,
        fontSize: 13,
        fontWeight: "500",
    },
    locateButton: {
        display: "none",
    },
    reportFab: {
        position: "absolute",
        bottom: 24,
        right: 20,
        width: 56,
        height: 56,
        borderRadius: 16,
        backgroundColor: Colors.primary,
        justifyContent: "center",
        alignItems: "center",
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
        elevation: 8,
    },
    signInBanner: {
        position: "absolute",
        bottom: 24,
        left: 16,
        right: 16,
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        backgroundColor: "rgba(12, 10, 7, 0.92)",
        borderRadius: Radius.xl,
        borderWidth: 1,
        borderColor: Colors.border,
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    signInText: {
        color: Colors.foreground,
        fontSize: 14,
        fontWeight: "500",
    },
});
