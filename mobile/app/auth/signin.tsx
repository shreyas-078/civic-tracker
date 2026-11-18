import { useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    Alert,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Colors, Radius, FontSize, Spacing } from "@/constants/theme";
import { useAuth } from "@/stores/auth";

export default function SignInScreen() {
    const router = useRouter();
    const { signIn, signUp } = useAuth();
    const [mode, setMode] = useState<"signin" | "signup">("signin");
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async () => {
        if (!email.trim() || !password.trim()) {
            Alert.alert("Required", "Please enter email and password");
            return;
        }
        if (mode === "signup" && !name.trim()) {
            Alert.alert("Required", "Please enter your name");
            return;
        }

        setLoading(true);
        try {
            if (mode === "signin") {
                await signIn(email.trim(), password.trim());
            } else {
                await signUp(name.trim(), email.trim(), password.trim());
            }
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            if (router.canGoBack()) {
                router.back();
            } else {
                router.replace("/");
            }
        } catch (err: any) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            Alert.alert("Error", err.message ?? "Authentication failed");
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            {/* Close button must be outside KeyboardAvoidingView — absolutely positioned
                children inside KAV crash Fabric (New Architecture) with addViewAt index 0. */}
            <TouchableOpacity
                style={styles.closeBtn}
                onPress={() =>
                    router.canGoBack() ? router.back() : router.replace("/")
                }
            >
                <Ionicons name="close" size={24} color={Colors.foreground} />
            </TouchableOpacity>

            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === "ios" ? "padding" : "height"}
            >
            <View style={styles.content}>
                {/* Logo */}
                <View style={styles.logoContainer}>
                    <View style={styles.logoCircle}>
                        <Ionicons
                            name="location"
                            size={32}
                            color={Colors.primary}
                        />
                    </View>
                    <Text style={styles.brandName}>CiviTrack</Text>
                    <Text style={styles.brandTag}>
                        Report. Verify. Resolve.
                    </Text>
                </View>

                {/* Form */}
                <View style={styles.form}>
                    {mode === "signup" && (
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Name</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="Your full name"
                                placeholderTextColor={Colors.mutedText}
                                value={name}
                                onChangeText={setName}
                                autoCapitalize="words"
                            />
                        </View>
                    )}

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Email</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="you@example.com"
                            placeholderTextColor={Colors.mutedText}
                            value={email}
                            onChangeText={setEmail}
                            keyboardType="email-address"
                            autoCapitalize="none"
                            autoComplete="email"
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Password</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="••••••••"
                            placeholderTextColor={Colors.mutedText}
                            value={password}
                            onChangeText={setPassword}
                            secureTextEntry
                        />
                    </View>

                    <TouchableOpacity
                        style={[
                            styles.submitBtn,
                            loading && styles.submitBtnDisabled,
                        ]}
                        onPress={handleSubmit}
                        disabled={loading}
                        activeOpacity={0.8}
                    >
                        {loading ? (
                            <ActivityIndicator
                                size="small"
                                color={Colors.primaryForeground}
                            />
                        ) : (
                            <Text style={styles.submitBtnText}>
                                {mode === "signin"
                                    ? "Sign In"
                                    : "Create Account"}
                            </Text>
                        )}
                    </TouchableOpacity>

                    {/* Demo accounts */}
                    <View style={styles.demoSection}>
                        <Text style={styles.demoLabel}>Demo accounts:</Text>
                        {[
                            {
                                label: "Citizen",
                                email: "citizen@example.com",
                            },
                            { label: "Admin", email: "admin@civictrack.dev" },
                            { label: "NGO", email: "ngo@example.com" },
                        ].map((demo) => (
                            <TouchableOpacity
                                key={demo.email}
                                style={styles.demoBtn}
                                onPress={() => {
                                    setEmail(demo.email);
                                    setPassword("password123");
                                    setMode("signin");
                                }}
                            >
                                <Text style={styles.demoBtnText}>
                                    {demo.label}: {demo.email}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* Toggle mode */}
                <TouchableOpacity
                    onPress={() =>
                        setMode(mode === "signin" ? "signup" : "signin")
                    }
                    style={styles.toggleLink}
                >
                    <Text style={styles.toggleText}>
                        {mode === "signin"
                            ? "Don't have an account? Sign Up"
                            : "Already have an account? Sign In"}
                    </Text>
                </TouchableOpacity>
            </View>
            </KeyboardAvoidingView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    closeBtn: {
        position: "absolute",
        top: Platform.OS === "ios" ? 56 : 40,
        right: 16,
        zIndex: 10,
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: "center",
        alignItems: "center",
    },
    content: {
        flex: 1,
        justifyContent: "center",
        paddingHorizontal: 24,
        gap: 32,
    },
    logoContainer: {
        alignItems: "center",
        gap: 8,
    },
    logoCircle: {
        width: 72,
        height: 72,
        borderRadius: 20,
        backgroundColor: Colors.primaryDim,
        justifyContent: "center",
        alignItems: "center",
        marginBottom: 4,
    },
    brandName: {
        color: Colors.foreground,
        fontSize: FontSize["3xl"],
        fontWeight: "700",
    },
    brandTag: {
        color: Colors.mutedText,
        fontSize: FontSize.sm,
    },
    form: {
        gap: 16,
    },
    inputGroup: {
        gap: 4,
    },
    label: {
        color: Colors.secondaryText,
        fontSize: FontSize.sm,
        fontWeight: "500",
        marginLeft: 2,
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
    submitBtn: {
        backgroundColor: Colors.primary,
        borderRadius: Radius.lg,
        paddingVertical: 14,
        alignItems: "center",
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 6,
        marginTop: 4,
    },
    submitBtnDisabled: {
        opacity: 0.6,
    },
    submitBtnText: {
        color: Colors.primaryForeground,
        fontSize: FontSize.md,
        fontWeight: "600",
    },
    demoSection: {
        gap: 6,
        marginTop: 4,
    },
    demoLabel: {
        color: Colors.mutedText,
        fontSize: FontSize.xs,
    },
    demoBtn: {
        paddingVertical: 4,
    },
    demoBtnText: {
        color: Colors.secondaryText,
        fontSize: FontSize.xs,
    },
    toggleLink: {
        alignItems: "center",
        paddingVertical: 8,
    },
    toggleText: {
        color: Colors.primary,
        fontSize: FontSize.sm,
        fontWeight: "500",
    },
});
