"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ImageIcon, Loader2, ShieldAlert, ShieldCheck } from "lucide-react";

interface Settings {
    imageModerationEnabled: boolean;
}

export function AdminSettings() {
    const [settings, setSettings] = useState<Settings | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [savedAt, setSavedAt] = useState<Date | null>(null);

    useEffect(() => {
        fetch("/api/admin/settings")
            .then((r) => r.json())
            .then((d) => setSettings(d.settings))
            .catch(() => setError("Failed to load settings"))
            .finally(() => setLoading(false));
    }, []);

    const toggle = async (key: keyof Settings, value: boolean) => {
        if (!settings || saving) return;
        setSaving(true);
        setError(null);
        const optimistic = { ...settings, [key]: value };
        setSettings(optimistic);
        try {
            const res = await fetch("/api/admin/settings", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(
                    key === "imageModerationEnabled"
                        ? { imageModerationEnabled: value }
                        : {},
                ),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? "Save failed");
            setSettings(data.settings);
            setSavedAt(new Date());
        } catch (err: any) {
            setSettings(settings); // revert
            setError(err.message ?? "Failed to save");
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center gap-2 text-muted-foreground py-8">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading settings…
            </div>
        );
    }

    if (!settings) {
        return (
            <p className="text-destructive text-sm">
                {error ?? "Failed to load settings"}
            </p>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2 mb-1">
                <p className="text-sm text-muted-foreground">
                    These settings apply immediately to all new report submissions.
                    They reset to defaults on server restart.
                </p>
            </div>

            {/* Image Moderation Toggle */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                        <ImageIcon className="h-4 w-4 text-amber-400" />
                        Image Relevance Moderation
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <p className="text-sm font-medium">
                                Reject unrelated photos
                            </p>
                            <p className="text-xs text-muted-foreground max-w-sm">
                                Uses LLaVA to verify that attached images actually
                                show evidence of the described issue. Disable during
                                demonstrations if LLaVA is slow or unavailable.
                            </p>
                        </div>
                        <div className="flex items-center gap-3 ml-4 shrink-0">
                            {saving && (
                                <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                            )}
                            <button
                                type="button"
                                onClick={() =>
                                    toggle(
                                        "imageModerationEnabled",
                                        !settings.imageModerationEnabled,
                                    )
                                }
                                disabled={saving}
                                className={[
                                    "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50",
                                    settings.imageModerationEnabled
                                        ? "bg-emerald-500"
                                        : "bg-zinc-700",
                                ].join(" ")}
                                aria-checked={settings.imageModerationEnabled}
                                role="switch"
                            >
                                <span
                                    className={[
                                        "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200",
                                        settings.imageModerationEnabled
                                            ? "translate-x-5"
                                            : "translate-x-0",
                                    ].join(" ")}
                                />
                            </button>
                            <Badge
                                className={
                                    settings.imageModerationEnabled
                                        ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/20"
                                        : "bg-zinc-500/10 text-zinc-400 border-zinc-500/10"
                                }
                            >
                                {settings.imageModerationEnabled ? (
                                    <ShieldCheck className="h-3 w-3 mr-1" />
                                ) : (
                                    <ShieldAlert className="h-3 w-3 mr-1" />
                                )}
                                {settings.imageModerationEnabled
                                    ? "Enabled"
                                    : "Disabled"}
                            </Badge>
                        </div>
                    </div>

                    {!settings.imageModerationEnabled && (
                        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-400 flex items-start gap-2">
                            <ShieldAlert className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                            <span>
                                Image moderation is disabled. Users can submit
                                photos unrelated to their reported issue. Text
                                profanity filtering is still active.
                            </span>
                        </div>
                    )}

                    {error && (
                        <p className="text-xs text-destructive">{error}</p>
                    )}
                    {savedAt && !error && (
                        <p className="text-xs text-muted-foreground">
                            Saved at {savedAt.toLocaleTimeString()}
                        </p>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
