import { useEffect } from "react";
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Image,
    ScrollView,
    Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Colors, Radius, FontSize } from "@/constants/theme";
import { useAuth } from "@/stores/auth";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function AccountScreen() {
    const router = useRouter();
    const { user, isAuthenticated, signOut } = useAuth();
    const insets = useSafeAreaInsets();

    useEffect(() => {
        if (!isAuthenticated) {
            router.replace("/auth/signin");
        }
    }, [isAuthenticated]);

    const handleSignOut = () => {
        Alert.alert("Sign Out", "Are you sure you want to sign out?", [
            { text: "Cancel", style: "cancel" },
            {
                text: "Sign Out",
                style: "destructive",
                onPress: async () => {
                    await signOut();
                    router.replace("/auth/signin");
                },
            },
        ]);
    };

    if (!user) return null;

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Account</Text>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                {/* Profile card */}
                <TouchableOpacity
                    style={styles.profileCard}
                    onPress={() => router.push(`/profile/${user.id}`)}
                    activeOpacity={0.7}
                >
                    <View style={styles.avatar}>
                        {user.image ? (
                            <Image
                                source={{ uri: user.image }}
                                style={styles.avatarImage}
                            />
                        ) : (
                            <Text style={styles.avatarLetter}>
                                {user.name?.[0] ?? "?"}
                            </Text>
                        )}
                    </View>
                    <View style={styles.profileInfo}>
                        <Text style={styles.profileName}>
                            {user.name ?? "Anonymous"}
                        </Text>
                        <Text style={styles.profileEmail}>
                            {user.email ?? ""}
                        </Text>
                    </View>
                    <Ionicons
                        name="chevron-forward"
                        size={18}
                        color={Colors.mutedText}
                    />
                </TouchableOpacity>

                {/* Menu items */}
                <View style={styles.menuSection}>
                    <TouchableOpacity
                        style={styles.menuItem}
                        onPress={() => router.push(`/profile/${user.id}`)}
                    >
                        <Ionicons
                            name="person-outline"
                            size={20}
                            color={Colors.foreground}
                        />
                        <Text style={styles.menuLabel}>View Profile</Text>
                        <Ionicons
                            name="chevron-forward"
                            size={16}
                            color={Colors.mutedText}
                        />
                    </TouchableOpacity>

                    {user.role === "ADMIN" && (
                        <TouchableOpacity
                            style={[styles.menuItem, styles.menuItemBorder]}
                            onPress={() => router.push("/admin" as any)}
                        >
                            <Ionicons
                                name="shield-checkmark-outline"
                                size={20}
                                color={Colors.primary}
                            />
                            <Text style={[styles.menuLabel, { color: Colors.primary }]}>
                                Admin Panel
                            </Text>
                            <Ionicons
                                name="chevron-forward"
                                size={16}
                                color={Colors.mutedText}
                            />
                        </TouchableOpacity>
                    )}
                </View>

                {/* Sign out */}
                <TouchableOpacity
                    style={styles.signOutButton}
                    onPress={handleSignOut}
                >
                    <Ionicons
                        name="log-out-outline"
                        size={20}
                        color="#ef4444"
                    />
                    <Text style={styles.signOutText}>Sign Out</Text>
                </TouchableOpacity>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    header: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
    },
    headerTitle: {
        fontSize: FontSize["2xl"],
        fontWeight: "700",
        color: Colors.foreground,
    },
    content: {
        padding: 16,
        gap: 16,
    },
    profileCard: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: Colors.card,
        borderRadius: Radius.xl,
        padding: 16,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    avatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: Colors.primaryDim,
        justifyContent: "center",
        alignItems: "center",
        overflow: "hidden",
    },
    avatarImage: {
        width: 48,
        height: 48,
        borderRadius: 24,
    },
    avatarLetter: {
        fontSize: 20,
        fontWeight: "700",
        color: Colors.primary,
    },
    profileInfo: {
        flex: 1,
        marginLeft: 12,
    },
    profileName: {
        fontSize: FontSize.lg,
        fontWeight: "600",
        color: Colors.foreground,
    },
    profileEmail: {
        fontSize: FontSize.sm,
        color: Colors.mutedText,
        marginTop: 2,
    },
    menuSection: {
        backgroundColor: Colors.card,
        borderRadius: Radius.xl,
        borderWidth: 1,
        borderColor: Colors.border,
        overflow: "hidden",
    },
    menuItem: {
        flexDirection: "row",
        alignItems: "center",
        padding: 14,
        gap: 12,
    },
    menuItemBorder: {
        borderTopWidth: 1,
        borderTopColor: Colors.border,
    },
    menuLabel: {
        flex: 1,
        fontSize: FontSize.base,
        color: Colors.foreground,
    },
    signOutButton: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        backgroundColor: "rgba(239, 68, 68, 0.08)",
        borderRadius: Radius.xl,
        padding: 14,
        borderWidth: 1,
        borderColor: "rgba(239, 68, 68, 0.15)",
    },
    signOutText: {
        fontSize: FontSize.base,
        fontWeight: "600",
        color: "#ef4444",
    },
});
