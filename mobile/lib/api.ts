import * as SecureStore from "expo-secure-store";
import { API_BASE_URL } from "@/constants/theme";

const TOKEN_KEY = "civictrack_token";

let cachedToken: string | null = null;

export async function getToken(): Promise<string | null> {
    if (cachedToken) return cachedToken;
    cachedToken = await SecureStore.getItemAsync(TOKEN_KEY);
    return cachedToken;
}

export async function setToken(token: string) {
    cachedToken = token;
    await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function clearToken() {
    cachedToken = null;
    await SecureStore.deleteItemAsync(TOKEN_KEY);
}

/** Resolve a potentially relative URL (e.g. /uploads/xxx.jpg) to an absolute URL */
export function resolveUrl(url: string): string {
    if (!url) return url;
    if (url.startsWith("http://") || url.startsWith("https://")) return url;
    return `${API_BASE_URL}${url.startsWith("/") ? "" : "/"}${url}`;
}

type FetchOptions = {
    method?: string;
    body?: any;
    headers?: Record<string, string>;
};

export async function api<T = any>(
    path: string,
    options: FetchOptions = {},
): Promise<T> {
    const token = await getToken();

    const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "x-client": "mobile",
        ...options.headers,
    };

    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
    }

    const url = `${API_BASE_URL}${path}`;

    const res = await fetch(url, {
        method: options.method ?? "GET",
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined,
    });

    if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error ?? `Request failed: ${res.status}`);
    }

    return res.json();
}

export async function apiUpload(
    path: string,
    formData: FormData,
): Promise<any> {
    const token = await getToken();

    const headers: Record<string, string> = {};
    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
    }

    const url = `${API_BASE_URL}${path}`;

    const res = await fetch(url, {
        method: "POST",
        headers,
        body: formData,
    });

    if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error ?? `Upload failed: ${res.status}`);
    }

    return res.json();
}
