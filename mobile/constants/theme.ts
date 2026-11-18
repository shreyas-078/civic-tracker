// ─── CivicTrack Design Tokens ─────────────────────────────────────────────────
// Matches the web app's "Warm Charcoal + Saffron" dark editorial theme

export const Colors = {
    // Core palette
    background: "#0c0a07",
    surface: "#141210",
    card: "#171412",
    elevated: "#1c1916",

    // Text
    foreground: "#ede8df",
    secondaryText: "#a09789",
    mutedText: "#706a60",

    // Primary (Amber/Saffron)
    primary: "#f59e0b",
    primaryDim: "rgba(245, 158, 11, 0.15)",
    primaryMuted: "rgba(245, 158, 11, 0.08)",
    primaryForeground: "#0c0a07",

    // Status colors
    statusReported: "#ef4444",
    statusVerified: "#f59e0b",
    statusAssigned: "#8b5cf6",
    statusResolved: "#22c55e",
    statusClosed: "#6b7280",

    // Semantic
    success: "#22c55e",
    successDim: "rgba(34, 197, 94, 0.15)",
    warning: "#f59e0b",
    warningDim: "rgba(245, 158, 11, 0.15)",
    destructive: "#ef4444",
    destructiveDim: "rgba(239, 68, 68, 0.15)",

    // Border & Glass
    border: "rgba(255, 255, 255, 0.07)",
    borderSubtle: "rgba(255, 255, 255, 0.04)",
    glassBg: "rgba(255, 255, 255, 0.03)",
    glassStrong: "rgba(255, 255, 255, 0.05)",
    glassAmber: "rgba(245, 158, 11, 0.06)",

    // Misc
    white: "#ffffff",
    black: "#000000",
    overlay: "rgba(0, 0, 0, 0.6)",
} as const;

export const StatusColors: Record<string, string> = {
    REPORTED: Colors.statusReported,
    VERIFIED: Colors.statusVerified,
    ASSIGNED: Colors.statusAssigned,
    RESOLVED: Colors.statusResolved,
    CLOSED: Colors.statusClosed,
};

export const CategoryEmoji: Record<string, string> = {
    ROAD: "🛣️",
    WATER: "💧",
    ELECTRICITY: "⚡",
    SANITATION: "🗑️",
    PUBLIC_SPACE: "🏙️",
    ENVIRONMENT: "🌱",
    LOST_FOUND: "🔍",
    OTHER: "📌",
};

export const CategoryLabels: Record<string, string> = {
    ROAD: "Road / Pothole",
    WATER: "Water / Drainage",
    ELECTRICITY: "Electricity / Lighting",
    SANITATION: "Sanitation / Garbage",
    PUBLIC_SPACE: "Public Space / Park",
    ENVIRONMENT: "Environment",
    LOST_FOUND: "Lost & Found",
    OTHER: "Other",
};

export const StatusLabels: Record<string, string> = {
    REPORTED: "Reported",
    VERIFIED: "Verified",
    ASSIGNED: "Assigned",
    RESOLVED: "Resolved",
    CLOSED: "Closed",
};

export const Spacing = {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    "2xl": 24,
    "3xl": 32,
    "4xl": 40,
} as const;

export const Radius = {
    sm: 6,
    md: 8,
    lg: 10,
    xl: 14,
    "2xl": 18,
    full: 9999,
} as const;

export const FontSize = {
    "2xs": 10,
    xs: 12,
    sm: 13,
    base: 14,
    md: 15,
    lg: 17,
    xl: 20,
    "2xl": 24,
    "3xl": 30,
    "4xl": 36,
} as const;

// API base URL — change this to your deployed Next.js server
export const API_BASE_URL = __DEV__
    ? "http://10.175.17.252:3000" // Your local network IP
    : "https://your-production-url.vercel.app";
