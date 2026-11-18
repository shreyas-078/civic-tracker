"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RotateCcw } from "lucide-react";

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error(error);
    }, [error]);

    return (
        <div className="flex flex-col items-center justify-center min-h-screen gap-6 text-center px-4">
            <div className="relative">
                <div className="absolute inset-0 bg-destructive/20 rounded-full blur-2xl scale-150" />
                <div className="relative glass rounded-2xl p-5">
                    <AlertTriangle className="h-10 w-10 text-red-400" />
                </div>
            </div>
            <div className="space-y-2">
                <h1 className="text-2xl font-bold tracking-tight">
                    Something went wrong
                </h1>
                <p className="text-muted-foreground max-w-sm text-sm">
                    {error.message || "An unexpected error occurred."}
                </p>
            </div>
            <Button onClick={reset} className="gap-2">
                <RotateCcw className="h-4 w-4" />
                Try again
            </Button>
        </div>
    );
}
