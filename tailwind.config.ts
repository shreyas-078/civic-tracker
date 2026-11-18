import type { Config } from "tailwindcss";

const config: Config = {
    darkMode: ["class"],
    content: [
        "./pages/**/*.{js,ts,jsx,tsx,mdx}",
        "./components/**/*.{js,ts,jsx,tsx,mdx}",
        "./app/**/*.{js,ts,jsx,tsx,mdx}",
    ],
    theme: {
        extend: {
            fontFamily: {
                display: ["var(--font-fraunces)", "Georgia", "serif"],
                sans: ["var(--font-dm-sans)", "system-ui", "sans-serif"],
                mono: ["var(--font-dm-mono)", "Menlo", "monospace"],
            },
            fontSize: {
                "2xs": ["0.65rem", { lineHeight: "0.875rem" }],
            },
            colors: {
                background: "hsl(var(--background))",
                foreground: "hsl(var(--foreground))",
                card: {
                    DEFAULT: "hsl(var(--card))",
                    foreground: "hsl(var(--card-foreground))",
                },
                popover: {
                    DEFAULT: "hsl(var(--popover))",
                    foreground: "hsl(var(--popover-foreground))",
                },
                primary: {
                    DEFAULT: "hsl(var(--primary))",
                    foreground: "hsl(var(--primary-foreground))",
                },
                secondary: {
                    DEFAULT: "hsl(var(--secondary))",
                    foreground: "hsl(var(--secondary-foreground))",
                },
                muted: {
                    DEFAULT: "hsl(var(--muted))",
                    foreground: "hsl(var(--muted-foreground))",
                },
                accent: {
                    DEFAULT: "hsl(var(--accent))",
                    foreground: "hsl(var(--accent-foreground))",
                },
                destructive: {
                    DEFAULT: "hsl(var(--destructive))",
                    foreground: "hsl(var(--destructive-foreground))",
                },
                success: {
                    DEFAULT: "hsl(var(--success))",
                    foreground: "hsl(var(--success-foreground))",
                },
                warning: {
                    DEFAULT: "hsl(var(--warning))",
                    foreground: "hsl(var(--warning-foreground))",
                },
                border: "hsl(var(--border))",
                input: "hsl(var(--input))",
                ring: "hsl(var(--ring))",
                status: {
                    reported: "#f59e0b",
                    verified: "#3b82f6",
                    assigned: "#8b5cf6",
                    resolved: "#22c55e",
                    closed: "#6b7280",
                },
            },
            borderRadius: {
                lg: "var(--radius)",
                md: "calc(var(--radius) - 2px)",
                sm: "calc(var(--radius) - 4px)",
                xl: "calc(var(--radius) + 4px)",
                "2xl": "calc(var(--radius) + 8px)",
            },
            zIndex: {
                map: "0",
                pin: "10",
                drawer: "50",
                modal: "60",
            },
            boxShadow: {
                glass: "inset 0 1px 0 0 rgba(255,255,255,0.04), 0 4px 24px -4px rgba(0,0,0,0.5)",
                "glass-lg": "inset 0 1px 0 0 rgba(255,255,255,0.05), 0 8px 40px -8px rgba(0,0,0,0.6)",
                glow: "0 0 24px -4px hsl(var(--primary) / 0.3)",
                "glow-lg": "0 0 48px -8px hsl(var(--primary) / 0.4)",
                "amber-glow": "0 0 32px -8px rgba(245,158,11,0.5)",
            },
            keyframes: {
                "fade-up": {
                    from: { opacity: "0", transform: "translateY(20px)" },
                    to: { opacity: "1", transform: "translateY(0)" },
                },
                "fade-in": {
                    from: { opacity: "0" },
                    to: { opacity: "1" },
                },
                "scale-in": {
                    from: { opacity: "0", transform: "scale(0.96)" },
                    to: { opacity: "1", transform: "scale(1)" },
                },
                "slide-right": {
                    from: { opacity: "0", transform: "translateX(-20px)" },
                    to: { opacity: "1", transform: "translateX(0)" },
                },
                pulse: {
                    "0%, 100%": { opacity: "1" },
                    "50%": { opacity: "0.5" },
                },
                "pin-ripple": {
                    "0%": { transform: "scale(1)", opacity: "0.6" },
                    "100%": { transform: "scale(2.5)", opacity: "0" },
                },
                "float-slow": {
                    "0%, 100%": { transform: "translateY(0px)" },
                    "50%": { transform: "translateY(-14px)" },
                },
                "float-slow-2": {
                    "0%, 100%": { transform: "translateY(0px) rotate(0deg)" },
                    "33%": { transform: "translateY(-10px) rotate(2deg)" },
                    "66%": { transform: "translateY(-6px) rotate(-1deg)" },
                },
                shimmer: {
                    "0%": { backgroundPosition: "-200% 0" },
                    "100%": { backgroundPosition: "200% 0" },
                },
                ticker: {
                    from: { transform: "translateX(0)" },
                    to: { transform: "translateX(-50%)" },
                },
                "orb-1": {
                    "0%, 100%": { transform: "translate(0,0) scale(1)" },
                    "33%": { transform: "translate(40px,-60px) scale(1.1)" },
                    "66%": { transform: "translate(-20px,30px) scale(0.95)" },
                },
                "orb-2": {
                    "0%, 100%": { transform: "translate(0,0) scale(1)" },
                    "33%": { transform: "translate(-50px,40px) scale(1.05)" },
                    "66%": { transform: "translate(30px,-40px) scale(0.9)" },
                },
                "spin-slow": {
                    from: { transform: "rotate(0deg)" },
                    to: { transform: "rotate(360deg)" },
                },
            },
            animation: {
                "fade-up": "fade-up 0.65s ease-out both",
                "fade-in": "fade-in 0.5s ease-out both",
                "scale-in": "scale-in 0.4s ease-out both",
                "slide-right": "slide-right 0.5s ease-out both",
                "pin-pulse": "pulse 2.2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
                "pin-ripple": "pin-ripple 1.5s ease-out infinite",
                "float-slow": "float-slow 4.5s ease-in-out infinite",
                "float-slow-2": "float-slow-2 6s ease-in-out infinite",
                shimmer: "shimmer 2.2s linear infinite",
                ticker: "ticker 35s linear infinite",
                "orb-1": "orb-1 22s ease-in-out infinite",
                "orb-2": "orb-2 28s ease-in-out infinite",
                "spin-slow": "spin-slow 3s linear infinite",
            },
            backgroundImage: {
                shimmer: "linear-gradient(90deg, transparent, rgba(245,158,11,0.06), transparent)",
                "dot-grid": "radial-gradient(circle, rgba(245,158,11,0.1) 1px, transparent 1px)",
                "cross-grid": "linear-gradient(rgba(245,158,11,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(245,158,11,0.04) 1px, transparent 1px)",
            },
            backgroundSize: {
                "dot-grid": "40px 40px",
                "cross-grid": "40px 40px",
            },
        },
    },
    plugins: [],
};
export default config;
