"use client";

// Ambient background is now handled via CSS mesh-orb classes in globals.css.
// This component is kept for backward-compatibility but no longer needed
// on most pages (the landing page handles its own background).
export function AnimatedBackground() {
    return (
        <div
            className="fixed inset-0 -z-10 overflow-hidden pointer-events-none"
            aria-hidden="true"
        >
            <div className="mesh-orb mesh-orb-1" />
            <div className="mesh-orb mesh-orb-2" />
        </div>
    );
}
