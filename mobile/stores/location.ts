import { create } from "zustand";
import * as Location from "expo-location";

interface LocationState {
    location: { lat: number; lng: number } | null;
    isLoading: boolean;
    error: string | null;
    requestLocation: () => Promise<void>;
    requestBackgroundLocation: () => Promise<void>;
}

export const useLocation = create<LocationState>((set) => ({
    location: null,
    isLoading: true,
    error: null,

    requestLocation: async () => {
        try {
            const { status } =
                await Location.requestForegroundPermissionsAsync();
            if (status !== "granted") {
                set({ error: "Location permission denied", isLoading: false });
                return;
            }

            // Try last known position first (instant)
            const last = await Location.getLastKnownPositionAsync();
            if (last) {
                set({
                    location: {
                        lat: last.coords.latitude,
                        lng: last.coords.longitude,
                    },
                    isLoading: false,
                    error: null,
                });
            }

            // Then get fresh position with timeout
            const loc = await Promise.race([
                Location.getCurrentPositionAsync({
                    accuracy: Location.Accuracy.Balanced,
                }),
                new Promise<null>((resolve) =>
                    setTimeout(() => resolve(null), 8000),
                ),
            ]);

            if (loc) {
                set({
                    location: {
                        lat: loc.coords.latitude,
                        lng: loc.coords.longitude,
                    },
                    isLoading: false,
                    error: null,
                });
            } else if (!last) {
                // Neither worked — use default and stop loading
                set({ isLoading: false, error: "Location timed out" });
            }
        } catch (err) {
            set({
                error: "Failed to get location",
                isLoading: false,
            });
        }
    },

    requestBackgroundLocation: async () => {
        const { status } = await Location.requestBackgroundPermissionsAsync();
        if (status !== "granted") {
            console.warn("Background location permission denied");
        }
    },
}));
