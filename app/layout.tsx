import type { Metadata, Viewport } from "next";
import { Fraunces, DM_Sans, DM_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { Providers } from "@/components/providers";
import { BottomNav } from "@/components/Navigation";
import { ClientShell } from "@/components/ClientShell";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";

const fraunces = Fraunces({
    subsets: ["latin"],
    variable: "--font-fraunces",
    display: "swap",
    axes: ["SOFT", "WONK", "opsz"],
});

const dmSans = DM_Sans({
    subsets: ["latin"],
    variable: "--font-dm-sans",
    display: "swap",
    weight: ["300", "400", "500", "600", "700"],
});

const dmMono = DM_Mono({
    subsets: ["latin"],
    variable: "--font-dm-mono",
    display: "swap",
    weight: ["300", "400", "500"],
});

export const metadata: Metadata = {
    title: "CiviTrack — Report. Verify. Resolve.",
    description:
        "A community-powered platform to report and track civic issues like potholes, broken streetlights, water leaks, and more.",
    manifest: "/manifest.json",
    appleWebApp: {
        capable: true,
        statusBarStyle: "default",
        title: "CiviTrack",
    },
    formatDetection: { telephone: false },
};

export const viewport: Viewport = {
    themeColor: "#0c0a07",
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html
            lang="en"
            className={`${fraunces.variable} ${dmSans.variable} ${dmMono.variable}`}
            suppressHydrationWarning
        >
            <head>
                <link rel="icon" href="/favicon.ico" />
                <link rel="apple-touch-icon" href="/icons/icon.svg" />
            </head>
            <body className="min-h-screen bg-background font-sans antialiased noise-overlay">
                <Providers>
                    <ClientShell>{children}</ClientShell>
                    <BottomNav />
                </Providers>
                <Toaster
                    richColors
                    position="top-center"
                    toastOptions={{
                        className:
                            "glass-strong !rounded-xl !border-white/10 !text-foreground",
                    }}
                />
                <ServiceWorkerRegister />
            </body>
        </html>
    );
}
