import { Tabs } from "expo-router";
import { Platform } from "react-native";
import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "@/constants/theme";
import { useAuth } from "@/stores/auth";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function TabLayout() {
    const { isAuthenticated } = useAuth();
    const insets = useSafeAreaInsets();

    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                tabBarActiveTintColor: Colors.primary,
                tabBarInactiveTintColor: Colors.mutedText,
                tabBarStyle: {
                    backgroundColor: "rgba(12, 10, 7, 0.95)",
                    borderTopColor: Colors.border,
                    borderTopWidth: 1,
                    height: 56 + insets.bottom,
                    paddingBottom: insets.bottom,
                    paddingTop: 8,
                    elevation: 0,
                    shadowOpacity: 0,
                },
                tabBarLabelStyle: {
                    fontSize: 10,
                    fontWeight: "500",
                },
            }}
        >
            <Tabs.Screen
                name="index"
                options={{
                    title: "Map",
                    tabBarIcon: ({ color, size }) => (
                        <Ionicons name="map" size={size} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="leaderboard"
                options={{
                    title: "Leaders",
                    tabBarIcon: ({ color, size }) => (
                        <Ionicons name="trophy" size={size} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="report"
                options={{
                    title: "Report",
                    href: isAuthenticated ? "/report" : null,
                    tabBarIcon: ({ color, focused }) => (
                        <View
                            style={{
                                width: 32,
                                height: 32,
                                borderRadius: 10,
                                backgroundColor: focused
                                    ? Colors.primaryDim
                                    : "rgba(255,255,255,0.07)",
                                borderWidth: 1,
                                borderColor: focused
                                    ? "rgba(245,158,11,0.3)"
                                    : "rgba(255,255,255,0.1)",
                                justifyContent: "center",
                                alignItems: "center",
                                marginBottom: -4,
                            }}
                        >
                            <Ionicons
                                name="add"
                                size={20}
                                color={focused ? Colors.primary : color}
                            />
                        </View>
                    ),
                }}
            />
            <Tabs.Screen
                name="ngos"
                options={{
                    title: "NGOs",
                    tabBarIcon: ({ color, size }) => (
                        <Ionicons name="business" size={size} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="notifications"
                options={{
                    title: "Alerts",
                    tabBarIcon: ({ color, size }) => (
                        <Ionicons
                            name="notifications"
                            size={size}
                            color={color}
                        />
                    ),
                }}
            />
            <Tabs.Screen
                name="account"
                options={{
                    title: "Account",
                    tabBarIcon: ({ color, size }) => (
                        <Ionicons
                            name="person-circle"
                            size={size}
                            color={color}
                        />
                    ),
                }}
            />
        </Tabs>
    );
}
