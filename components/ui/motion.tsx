"use client";

import { motion, type HTMLMotionProps, type Variants } from "framer-motion";
import { forwardRef } from "react";

// ─── Reusable animation variants ─────────────────────────────────────────────

export const fadeInUp: Variants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
        opacity: 1,
        y: 0,
        transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] },
    },
};

export const fadeIn: Variants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 0.4, ease: "easeOut" } },
};

export const scaleIn: Variants = {
    hidden: { opacity: 0, scale: 0.95 },
    visible: {
        opacity: 1,
        scale: 1,
        transition: { duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] },
    },
};

export const staggerContainer: Variants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: { staggerChildren: 0.06, delayChildren: 0.1 },
    },
};

export const staggerItem: Variants = {
    hidden: { opacity: 0, y: 16 },
    visible: {
        opacity: 1,
        y: 0,
        transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] },
    },
};

// ─── Spring hover preset ──────────────────────────────────────────────────────

export const springHover = {
    whileHover: {
        scale: 1.02,
        transition: { type: "spring", stiffness: 400, damping: 17 },
    },
    whileTap: {
        scale: 0.98,
        transition: { type: "spring", stiffness: 400, damping: 17 },
    },
};

// ─── Motion wrapper components ────────────────────────────────────────────────

export const MotionDiv = motion.div;
export const MotionSpan = motion.span;
export const MotionSection = motion.section;

export function StaggerContainer({
    children,
    className,
    ...props
}: HTMLMotionProps<"div"> & { children: React.ReactNode }) {
    return (
        <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
            className={className}
            {...props}
        >
            {children}
        </motion.div>
    );
}

export function StaggerItem({
    children,
    className,
    ...props
}: HTMLMotionProps<"div"> & { children: React.ReactNode }) {
    return (
        <motion.div variants={staggerItem} className={className} {...props}>
            {children}
        </motion.div>
    );
}

export function FadeInView({
    children,
    className,
    delay = 0,
    ...props
}: HTMLMotionProps<"div"> & { children: React.ReactNode; delay?: number }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
                duration: 0.5,
                delay,
                ease: [0.25, 0.46, 0.45, 0.94],
            }}
            className={className}
            {...props}
        >
            {children}
        </motion.div>
    );
}
