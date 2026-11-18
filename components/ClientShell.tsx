"use client";

import { usePathname } from "next/navigation";

// Pages that don't need bottom nav padding
const NO_PADDING_PATHS = ["/", "/auth"];

export function ClientShell({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const needsPadding = !NO_PADDING_PATHS.some((p) =>
        p === "/" ? pathname === "/" : pathname.startsWith(p)
    );

    return (
        <div className={needsPadding ? "pb-20" : undefined}>
            {children}
        </div>
    );
}
