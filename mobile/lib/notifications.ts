import * as Device from "expo-device";
import { Platform } from "react-native";
import { api } from "@/lib/api";
import Constants from "expo-constants";

// Lazy-load expo-notifications to avoid module-level crash in Expo Go
// (PushTokenAutoRegistration side-effect throws on import in Expo Go SDK 53+)
let Notifications: any = null;
try {
    Notifications = require("expo-notifications");
} catch (e) {
    console.warn("expo-notifications require failed:", e);
}

// Set handler lazily — don't call at module init to avoid Expo Go crash
let handlerSet = false;
function ensureNotificationHandler() {
    if (handlerSet || !Notifications) return;
    try {
        Notifications.setNotificationHandler({
            handleNotification: async () => ({
                shouldShowAlert: true,
                shouldPlaySound: true,
                shouldSetBadge: true,
                shouldShowBanner: true,
                shouldShowList: true,
            }),
        });
        handlerSet = true;
    } catch (e) {
        console.warn("setNotificationHandler failed (Expo Go):", e);
    }
}

export async function registerForPushNotifications(): Promise<string | null> {
    if (!Notifications) return null;
    ensureNotificationHandler();
    try {
        if (!Device.isDevice) {
            console.warn("Push notifications require a physical device");
            return null;
        }

        // Check existing permissions
        const { status: existingStatus } =
            await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;

        if (existingStatus !== "granted") {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
        }

        if (finalStatus !== "granted") {
            return null;
        }

        // Android channel setup
        if (Platform.OS === "android") {
            await Notifications.setNotificationChannelAsync("default", {
                name: "Default",
                importance: Notifications.AndroidImportance.HIGH,
                vibrationPattern: [0, 250, 250, 250],
                lightColor: "#f59e0b",
            });

            await Notifications.setNotificationChannelAsync("resolution", {
                name: "Resolution Checks",
                description:
                    "Notifications about issue resolution verification",
                importance: Notifications.AndroidImportance.HIGH,
                vibrationPattern: [0, 250, 250, 250],
                lightColor: "#22c55e",
            });
        }

        if (!Notifications) return null;

        const projectId = Constants.expoConfig?.extra?.eas?.projectId;
        const token = (
            await Notifications.getExpoPushTokenAsync({
                projectId,
            })
        ).data;

        return token;
    } catch (e) {
        // Push token registration fails in Expo Go (SDK 53+)
        console.warn("Push notification registration unavailable:", e);
        return null;
    }
}

/**
 * Register the push token with the backend server
 */
export async function registerPushTokenWithServer(
    expoPushToken: string,
    lat?: number,
    lng?: number,
) {
    try {
        await api("/api/push/expo-subscribe", {
            method: "POST",
            body: { token: expoPushToken, lat, lng },
        });
    } catch (err) {
        console.error("Failed to register push token:", err);
    }
}

/**
 * Handle a notification tap — extract the deep link
 */
export function getNotificationDeepLink(notification: any): string | null {
    const data = notification.request.content.data;
    if (data?.issueId) {
        // Resolution-related notifications go to the dedicated vote screen
        const resolutionTypes = [
            "RESOLUTION_VERIFY_REQUEST",
            "RESOLUTION_NEARBY_CHECK",
            "RESOLUTION_DEADLINE_CHECK",
        ];
        if (data.type && resolutionTypes.includes(data.type)) {
            return `/issues/resolve-vote/${data.issueId}`;
        }
        return `/issues/${data.issueId}`;
    }
    if (data?.url) {
        return data.url as string;
    }
    return null;
}

/**
 * Schedule a local notification (for deadline checks)
 */
export async function scheduleLocalNotification(params: {
    title: string;
    body: string;
    data?: Record<string, any>;
    delaySeconds?: number;
    channelId?: string;
}) {
    if (!Notifications) return;
    await Notifications.scheduleNotificationAsync({
        content: {
            title: params.title,
            body: params.body,
            data: params.data ?? {},
            sound: true,
            ...(Platform.OS === "android" && params.channelId
                ? { channelId: params.channelId }
                : {}),
        },
        trigger: params.delaySeconds
            ? {
                  seconds: params.delaySeconds,
                  type: Notifications.SchedulableTriggerInputTypes
                      .TIME_INTERVAL,
              }
            : null,
    });
}
