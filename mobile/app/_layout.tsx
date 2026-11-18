import { useEffect, useRef } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View, ActivityIndicator } from "react-native";
import * as SplashScreen from "expo-splash-screen";
import { useRouter } from "expo-router";
import { Colors } from "@/constants/theme";
import { useAuth } from "@/stores/auth";
import { useLocation } from "@/stores/location";
import {
    registerForPushNotifications,
    registerPushTokenWithServer,
    getNotificationDeepLink,
} from "@/lib/notifications";

SplashScreen.preventAutoHideAsync();

// Lazy-load expo-notifications to avoid Expo Go crash
let Notifications: any = null;
try {
    Notifications = require("expo-notifications");
} catch {}

export default function RootLayout() {
    const { loadSession, isLoading, isAuthenticated } = useAuth();
    const { requestLocation } = useLocation();
    const router = useRouter();
    const notificationResponseListener = useRef<any>();

    useEffect(() => {
        async function init() {
            try {
                await loadSession();
                await requestLocation();
            } catch (e) {
                console.warn("Init error:", e);
            } finally {
                await SplashScreen.hideAsync();
            }
        }
        init();
    }, []);

    // Register push notifications when authenticated
    useEffect(() => {
        if (!isAuthenticated) return;

        (async () => {
            try {
                const token = await registerForPushNotifications();
                if (token) {
                    const loc = useLocation.getState().location;
                    await registerPushTokenWithServer(
                        token,
                        loc?.lat,
                        loc?.lng,
                    );
                }
            } catch (e) {
                console.warn("Push registration failed (Expo Go?):", e);
            }
        })();
    }, [isAuthenticated]);

    // Handle notification taps
    useEffect(() => {
        if (!Notifications) return;

        // Handle cold-start: check if the app was opened by tapping a notification
        Notifications.getLastNotificationResponseAsync?.()
            .then((response: any) => {
                if (response) {
                    const deepLink = getNotificationDeepLink(
                        response.notification,
                    );
                    if (deepLink) {
                        // Small delay to ensure the router/navigator is mounted
                        setTimeout(() => router.push(deepLink as any), 500);
                    }
                }
            })
            .catch(() => {});

        // Handle warm-start: listen for notification taps while the app is running
        try {
            notificationResponseListener.current =
                Notifications.addNotificationResponseReceivedListener(
                    (response: any) => {
                        const deepLink = getNotificationDeepLink(
                            response.notification,
                        );
                        if (deepLink) {
                            router.push(deepLink as any);
                        }
                    },
                );
        } catch (e) {
            console.warn("Notification listener setup failed:", e);
        }

        return () => {
            if (notificationResponseListener.current) {
                try {
                    Notifications.removeNotificationSubscription(
                        notificationResponseListener.current,
                    );
                } catch {}
            }
        };
    }, []);

    if (isLoading) {
        return (
            <View
                style={{
                    flex: 1,
                    backgroundColor: Colors.background,
                    justifyContent: "center",
                    alignItems: "center",
                }}
            >
                <ActivityIndicator size="large" color={Colors.primary} />
            </View>
        );
    }

    return (
        <>
            <StatusBar style="light" backgroundColor={Colors.background} />
            <Stack
                screenOptions={{
                    headerShown: false,
                    contentStyle: { backgroundColor: Colors.background },
                    animation: "slide_from_right",
                }}
            >
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen name="issues/[id]" />
                <Stack.Screen name="issues/resolve-vote/[id]" />
                <Stack.Screen
                    name="auth/signin"
                    options={{
                        // "modal" presentation crashes on New Architecture (Fabric) with
                        // react-native-screens 4.x — use a card with bottom animation instead.
                        presentation: "card",
                        animation: "slide_from_bottom",
                        gestureDirection: "vertical",
                    }}
                />
                <Stack.Screen name="profile/[id]" />
                <Stack.Screen name="admin" />
            </Stack>
        </>
    );
}
