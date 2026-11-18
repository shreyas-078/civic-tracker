"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
    Building2,
    Upload,
    X,
    Loader2,
    CheckCircle,
    Clock,
    ArrowLeft,
    ExternalLink,
    AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

const CATEGORIES = [
    { value: "ROAD", label: "Road", emoji: "\u{1F6E3}\uFE0F" },
    { value: "WATER", label: "Water", emoji: "\u{1F4A7}" },
    { value: "ELECTRICITY", label: "Electricity", emoji: "\u26A1" },
    { value: "SANITATION", label: "Sanitation", emoji: "\u{1F5D1}\uFE0F" },
    { value: "PUBLIC_SPACE", label: "Public Space", emoji: "\u{1F3D9}\uFE0F" },
    { value: "ENVIRONMENT", label: "Environment", emoji: "\u{1F331}" },
    { value: "OTHER", label: "Other", emoji: "\u{1F4CC}" },
];

export default function NGOApplyPage() {
    const { data: session, status: authStatus } = useSession();
    const router = useRouter();

    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [website, setWebsite] = useState("");
    const [phone, setPhone] = useState("");
    const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
    const [proofFile, setProofFile] = useState<File | null>(null);
    const [proofPreview, setProofPreview] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [existingNgo, setExistingNgo] = useState<any>(null);
    const [checkingExisting, setCheckingExisting] = useState(true);

    // Redirect if not authenticated
    useEffect(() => {
        if (authStatus === "unauthenticated") {
            router.push("/auth/signin?callbackUrl=/ngos/apply");
        }
    }, [authStatus, router]);

    // Check if user already has an NGO application
    useEffect(() => {
        if (!session?.user?.id) return;
        fetch("/api/ngos/mine")
            .then((r) => (r.ok ? r.json() : null))
            .then((data) => {
                if (data?.ngo) setExistingNgo(data.ngo);
            })
            .catch(() => {})
            .finally(() => setCheckingExisting(false));
    }, [session?.user?.id]);

    function toggleCategory(cat: string) {
        setSelectedCategories((prev) =>
            prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat],
        );
    }

    function handleProofSelect(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 10 * 1024 * 1024) {
            toast.error("File must be under 10MB");
            return;
        }
        setProofFile(file);
        setProofPreview(URL.createObjectURL(file));
    }

    async function uploadProof(): Promise<string | undefined> {
        if (!proofFile) return undefined;
        setUploading(true);
        try {
            const formData = new FormData();
            formData.append("files", proofFile);
            const res = await fetch("/api/upload", {
                method: "POST",
                body: formData,
            });
            if (!res.ok) throw new Error();
            const data = await res.json();
            return data.urls?.[0];
        } catch {
            toast.error("Proof upload failed");
            return undefined;
        } finally {
            setUploading(false);
        }
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();

        if (selectedCategories.length === 0) {
            toast.error("Select at least one category");
            return;
        }
        if (name.length < 3) {
            toast.error("Organization name must be at least 3 characters");
            return;
        }
        if (description.length < 20) {
            toast.error("Description must be at least 20 characters");
            return;
        }

        setSubmitting(true);
        try {
            const proofUrl = await uploadProof();

            const res = await fetch("/api/ngos/apply", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name,
                    description,
                    website: website || undefined,
                    phone: phone || undefined,
                    proofUrl,
                    categories: selectedCategories,
                }),
            });

            if (!res.ok) {
                const err = await res.json();
                toast.error(err.error ?? "Failed to submit application");
                return;
            }

            toast.success(
                "Application submitted! An admin will review it shortly.",
            );
            router.push("/ngos");
        } catch {
            toast.error("Something went wrong. Please try again.");
        } finally {
            setSubmitting(false);
        }
    }

    if (authStatus === "loading" || checkingExisting) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
        );
    }

    // Already applied — show status
    if (existingNgo) {
        const statusConfig: Record<
            string,
            { icon: typeof CheckCircle; label: string; className: string }
        > = {
            PENDING: {
                icon: Clock,
                label: "Pending Review",
                className: "bg-amber-500/15 text-amber-400 border-amber-500/20",
            },
            APPROVED: {
                icon: CheckCircle,
                label: "Approved",
                className:
                    "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
            },
            BLACKLISTED: {
                icon: AlertTriangle,
                label: "Suspended",
                className: "bg-red-500/15 text-red-400 border-red-500/20",
            },
        };
        const s = statusConfig[existingNgo.status] ?? statusConfig.PENDING;
        const StatusIcon = s.icon;

        return (
            <div className="min-h-screen max-w-lg mx-auto px-4 py-8 pb-24">
                <Link
                    href="/ngos"
                    className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
                >
                    <ArrowLeft className="h-4 w-4" /> Back to NGOs
                </Link>

                <div className="glass rounded-2xl p-6 text-center">
                    <div className="h-14 w-14 rounded-2xl glass-amber flex items-center justify-center mx-auto mb-4">
                        <Building2 className="h-7 w-7 text-primary" />
                    </div>
                    <h1 className="font-display italic text-xl font-bold mb-2">
                        {existingNgo.name}
                    </h1>
                    <Badge
                        variant="outline"
                        className={cn("gap-1.5 mb-4", s.className)}
                    >
                        <StatusIcon className="h-3 w-3" />
                        {s.label}
                    </Badge>
                    <p className="text-sm text-muted-foreground">
                        {existingNgo.status === "PENDING"
                            ? "Your application is being reviewed by an admin. You'll be notified when a decision is made."
                            : existingNgo.status === "APPROVED"
                              ? "Your NGO is approved! You can now claim and resolve civic issues."
                              : "Your NGO has been suspended. Please contact support."}
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen max-w-lg mx-auto px-4 py-8 pb-24">
            <Link
                href="/ngos"
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
            >
                <ArrowLeft className="h-4 w-4" /> Back to NGOs
            </Link>

            <div className="flex items-center gap-3 mb-6">
                <div className="relative h-10 w-10 rounded-2xl glass-amber flex items-center justify-center">
                    <div className="absolute inset-0 bg-primary/20 rounded-2xl blur-xl" />
                    <Building2 className="h-5 w-5 text-primary relative" />
                </div>
                <div>
                    <h1 className="font-display italic text-2xl font-bold tracking-tight">
                        Register as NGO
                    </h1>
                    <p className="text-xs text-muted-foreground mt-0.5">
                        Apply to claim and resolve civic issues in your area
                    </p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
                {/* Organization Name */}
                <div className="space-y-1.5">
                    <Label className="text-sm text-muted-foreground">
                        Organization Name
                    </Label>
                    <Input
                        placeholder="e.g. Green City Foundation"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                        minLength={3}
                        maxLength={200}
                    />
                </div>

                {/* Description */}
                <div className="space-y-1.5">
                    <Label className="text-sm text-muted-foreground">
                        Description
                    </Label>
                    <Textarea
                        placeholder="Describe your organization's mission, areas of work, and experience..."
                        rows={4}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        required
                        minLength={20}
                        maxLength={5000}
                    />
                    <p className="text-2xs text-muted-foreground">
                        {description.length}/5000
                    </p>
                </div>

                {/* Categories */}
                <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">
                        Issue Categories You Handle
                    </Label>
                    <div className="flex flex-wrap gap-2">
                        {CATEGORIES.map((c) => {
                            const active = selectedCategories.includes(c.value);
                            return (
                                <button
                                    key={c.value}
                                    type="button"
                                    onClick={() => toggleCategory(c.value)}
                                    className={cn(
                                        "px-3 py-2 rounded-lg text-xs transition-all",
                                        active
                                            ? "glass-amber text-primary font-medium"
                                            : "glass text-muted-foreground hover:text-foreground hover:bg-white/[0.05]",
                                    )}
                                >
                                    <span className="mr-1">{c.emoji}</span>
                                    {c.label}
                                </button>
                            );
                        })}
                    </div>
                    {selectedCategories.length === 0 && (
                        <p className="text-2xs text-muted-foreground">
                            Select at least one category
                        </p>
                    )}
                </div>

                {/* Website */}
                <div className="space-y-1.5">
                    <Label className="text-sm text-muted-foreground">
                        Website{" "}
                        <span className="text-muted-foreground/50">
                            (optional)
                        </span>
                    </Label>
                    <Input
                        type="url"
                        placeholder="https://yourorg.com"
                        value={website}
                        onChange={(e) => setWebsite(e.target.value)}
                    />
                </div>

                {/* Phone */}
                <div className="space-y-1.5">
                    <Label className="text-sm text-muted-foreground">
                        Phone{" "}
                        <span className="text-muted-foreground/50">
                            (optional)
                        </span>
                    </Label>
                    <Input
                        placeholder="+91 98765 43210"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        maxLength={20}
                    />
                </div>

                {/* Proof Upload */}
                <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">
                        Proof of Registration
                    </Label>
                    <p className="text-2xs text-muted-foreground">
                        Upload a registration certificate, government ID, or
                        other proof (PDF/image, max 10MB)
                    </p>
                    {proofPreview ? (
                        <div className="glass rounded-xl p-3 flex items-center gap-3">
                            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                                <ExternalLink className="h-4 w-4 text-primary" />
                            </div>
                            <p className="text-sm flex-1 truncate">
                                {proofFile?.name}
                            </p>
                            <button
                                type="button"
                                onClick={() => {
                                    setProofFile(null);
                                    setProofPreview(null);
                                }}
                                className="p-1 rounded-full hover:bg-white/[0.08] transition-colors"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                    ) : (
                        <label className="flex flex-col items-center justify-center py-8 rounded-xl border-2 border-dashed border-white/[0.1] cursor-pointer hover:border-primary/40 hover:bg-primary/5 transition-all">
                            <Upload className="h-6 w-6 text-muted-foreground mb-1.5" />
                            <span className="text-xs text-muted-foreground">
                                Click to upload proof
                            </span>
                            <input
                                type="file"
                                accept="image/*,.pdf"
                                className="hidden"
                                onChange={handleProofSelect}
                            />
                        </label>
                    )}
                </div>

                {/* Submit */}
                <Button
                    type="submit"
                    className="w-full gap-2"
                    size="lg"
                    disabled={
                        submitting ||
                        uploading ||
                        selectedCategories.length === 0
                    }
                >
                    {submitting || uploading ? (
                        <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            {uploading ? "Uploading proof..." : "Submitting..."}
                        </>
                    ) : (
                        <>
                            <Building2 className="h-4 w-4" />
                            Submit Application
                        </>
                    )}
                </Button>
            </form>
        </div>
    );
}
