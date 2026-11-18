import { create } from "zustand";
import { api, setToken, clearToken, getToken } from "@/lib/api";
import type { UserRole } from "@/types";

interface User {
    id: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
    role: UserRole;
    trustScore: number;
}

interface AuthState {
    user: User | null;
    isLoading: boolean;
    isAuthenticated: boolean;
    signIn: (email: string, password: string) => Promise<void>;
    signUp: (name: string, email: string, password: string) => Promise<void>;
    signOut: () => Promise<void>;
    loadSession: () => Promise<void>;
}

export const useAuth = create<AuthState>((set) => ({
    user: null,
    isLoading: true,
    isAuthenticated: false,

    signIn: async (email: string, password: string) => {
        const data = await api("/api/auth/mobile/signin", {
            method: "POST",
            body: { email, password },
        });
        await setToken(data.token);
        set({ user: data.user, isAuthenticated: true });
    },

    signUp: async (name: string, email: string, password: string) => {
        const data = await api("/api/auth/signup", {
            method: "POST",
            body: { name, email, password },
        });
        await setToken(data.token);
        set({ user: data.user, isAuthenticated: true });
    },

    signOut: async () => {
        await clearToken();
        set({ user: null, isAuthenticated: false });
    },

    loadSession: async () => {
        try {
            const token = await getToken();
            if (!token) {
                set({ isLoading: false });
                return;
            }
            const data = await api("/api/auth/mobile/me");
            set({ user: data.user, isAuthenticated: true, isLoading: false });
        } catch {
            await clearToken();
            set({ user: null, isAuthenticated: false, isLoading: false });
        }
    },
}));
