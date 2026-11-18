import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
    return (
        <div
            data-slot="skeleton"
            className={cn(
                "rounded-xl bg-white/[0.04] relative overflow-hidden",
                "after:absolute after:inset-0 after:bg-shimmer after:bg-[length:200%_100%] after:animate-shimmer",
                className,
            )}
            {...props}
        />
    );
}

export { Skeleton };
