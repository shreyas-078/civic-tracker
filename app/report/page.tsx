"use client";

import { Smartphone, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FadeInView } from "@/components/ui/motion";

export default function ReportPage() {
    return (
        <div className="flex min-h-[80vh] items-center justify-center px-4">
            <FadeInView className="max-w-md w-full text-center space-y-8">
                {/* Icon */}
                <div className="mx-auto w-20 h-20 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                    <Smartphone className="h-10 w-10 text-primary" />
                </div>

                {/* Title */}
                <div className="space-y-3">
                    <h1 className="font-display text-3xl font-semibold tracking-tight">
                        Report from the App
                    </h1>
                    <p className="text-muted-foreground text-base leading-relaxed">
                        Issue reporting has moved to the CiviTrack mobile app.
                        Download it to report issues with GPS verification,
                        camera capture, and proximity-based resolution tracking.
                    </p>
                </div>

                {/* App store buttons */}
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <Button
                        size="lg"
                        className="gap-2 rounded-xl"
                        onClick={() =>
                            window.open(
                                "https://apps.apple.com/app/civictracker",
                                "_blank",
                            )
                        }
                    >
                        App Store
                        <ArrowRight className="h-4 w-4" />
                    </Button>
                    <Button
                        size="lg"
                        variant="outline"
                        className="gap-2 rounded-xl"
                        onClick={() =>
                            window.open(
                                "https://play.google.com/store/apps/details?id=com.civictracker.app",
                                "_blank",
                            )
                        }
                    >
                        Google Play
                        <ArrowRight className="h-4 w-4" />
                    </Button>
                </div>

                {/* Features */}
                <div className="grid grid-cols-3 gap-4 pt-4">
                    {[
                        { label: "GPS Verified", emoji: "📍" },
                        { label: "Camera Proof", emoji: "📸" },
                        { label: "Nearby Alerts", emoji: "🔔" },
                    ].map((f) => (
                        <div
                            key={f.label}
                            className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3"
                        >
                            <div className="text-2xl mb-1">{f.emoji}</div>
                            <div className="text-xs text-muted-foreground">
                                {f.label}
                            </div>
                        </div>
                    ))}
                </div>
            </FadeInView>
        </div>
    );
}
