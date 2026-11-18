import Link from "next/link";
import { Button } from "@/components/ui/button";
import { MapPin, ArrowLeft } from "lucide-react";

export default function NotFound() {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen gap-6 text-center px-4">
            <div className="relative">
                <div className="absolute inset-0 bg-primary/15 rounded-full blur-3xl scale-150" />
                <div className="relative glass rounded-2xl p-5">
                    <MapPin className="h-10 w-10 text-muted-foreground" />
                </div>
            </div>
            <div className="space-y-2">
                <h1 className="text-6xl font-bold gradient-text">404</h1>
                <p className="text-muted-foreground text-lg">
                    This page doesn&apos;t exist on our map.
                </p>
            </div>
            <Button render={<Link href="/map" />} className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to Map
            </Button>
        </div>
    );
}
