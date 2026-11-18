import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
    "group/badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-all duration-200 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&>svg]:pointer-events-none [&>svg]:size-3!",
    {
        variants: {
            variant: {
                default:
                    "bg-primary/15 text-primary border-primary/20 [a]:hover:bg-primary/25",
                secondary:
                    "bg-white/[0.05] text-secondary-foreground border-white/[0.08] [a]:hover:bg-white/[0.08]",
                destructive:
                    "bg-destructive/15 text-red-400 border-destructive/20 [a]:hover:bg-destructive/25",
                outline:
                    "border-white/[0.08] text-foreground bg-transparent [a]:hover:bg-white/[0.05]",
                ghost: "border-transparent bg-transparent hover:bg-white/[0.05] hover:text-foreground",
                link: "border-transparent text-primary underline-offset-4 hover:underline",
            },
        },
        defaultVariants: {
            variant: "default",
        },
    },
);

function Badge({
    className,
    variant = "default",
    render,
    ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
    return useRender({
        defaultTagName: "span",
        props: mergeProps<"span">(
            {
                className: cn(badgeVariants({ variant }), className),
            },
            props,
        ),
        render,
        state: {
            slot: "badge",
            variant,
        },
    });
}

export { Badge, badgeVariants };
