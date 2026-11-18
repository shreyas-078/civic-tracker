"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ShieldCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
    issueId: string;
    status: string;
    userRole?: string;
}

export function AdminVerifyButton({ issueId, status, userRole }: Props) {
    // Admin verification removed — issues are auto-verified on creation
    return null;
}
