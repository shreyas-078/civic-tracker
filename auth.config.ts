import type { NextAuthConfig } from "next-auth";

// Edge-compatible auth config (no Prisma, no Nodemailer).
// Used only by middleware.ts — lib/auth.ts has the full config.
export const authConfig: NextAuthConfig = {
    providers: [], // providers added in lib/auth.ts
    pages: {
        signIn: "/auth/signin",
        error: "/auth/error",
    },
    callbacks: {
        // Let the custom middleware function handle route protection logic
        authorized() {
            return true;
        },
        // Map custom JWT claims so middleware can read role from req.auth.user
        session({ session, token }) {
            if (session.user && token) {
                session.user.id = (token.sub ?? token.id) as string;
                (session.user as any).role = token.role;
                (session.user as any).trustScore = token.trustScore;
            }
            return session;
        },
    },
};
