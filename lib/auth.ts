import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Google from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import Credentials from "next-auth/providers/credentials";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { authConfig } from "@/auth.config";

// Predefined demo accounts — for local/demo use only.
const DEMO_ACCOUNTS = [
    {
        email: "demo@civictrack.local",
        password: "demo",
        name: "Demo Citizen",
        role: UserRole.CITIZEN,
        trustScore: 50,
    },
    {
        email: "admin@civictrack.local",
        password: "admin",
        name: "Demo Admin",
        role: UserRole.ADMIN,
        trustScore: 100,
    },
    {
        email: "ngo@civictrack.local",
        password: "ngo",
        name: "Demo NGO",
        role: UserRole.NGO,
        trustScore: 80,
    },
] as const;

export const { handlers, auth, signIn, signOut } = NextAuth({
    ...authConfig,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    adapter: PrismaAdapter(prisma) as any,
    providers: [
        Google({
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        }),
        Credentials({
            id: "demo-credentials",
            name: "Demo Login",
            credentials: {
                email: { label: "Email", type: "email" },
                password: { label: "Password", type: "password" },
            },
            async authorize(credentials) {
                const email = credentials?.email as string | undefined;
                const password = credentials?.password as string | undefined;
                if (!email || !password) return null;

                // Demo logins are off unless explicitly enabled (local development only).
                if (process.env.ENABLE_DEMO_LOGIN !== "true") return null;

                const demo = DEMO_ACCOUNTS.find(
                    (a) => a.email === email && a.password === password,
                );
                if (!demo) return null;

                // Upsert so the user always exists in the DB for session creation.
                const user = await prisma.user.upsert({
                    where: { email: demo.email },
                    update: {},
                    create: {
                        email: demo.email,
                        name: demo.name,
                        role: demo.role,
                        trustScore: demo.trustScore,
                        emailVerified: new Date(),
                    },
                });

                return { id: user.id, email: user.email, name: user.name };
            },
        }),
        Credentials({
            id: "credentials",
            name: "Email & Password",
            credentials: {
                email: { label: "Email", type: "email" },
                password: { label: "Password", type: "password" },
            },
            async authorize(credentials) {
                const email = credentials?.email as string | undefined;
                const password = credentials?.password as string | undefined;
                if (!email || !password) return null;

                const user = await prisma.user.findUnique({
                    where: { email },
                    select: { id: true, email: true, name: true, password: true },
                });

                if (!user?.password) return null;

                const valid = await bcrypt.compare(password, user.password);
                if (!valid) return null;

                return { id: user.id, email: user.email, name: user.name };
            },
        }),
    ],
    callbacks: {
        async jwt({ token, user }) {
            if (user) {
                token.sub = user.id;
                token.id = user.id;
                // Fetch fresh role & trustScore from DB so the token stays accurate.
                const dbUser = await prisma.user.findUnique({
                    where: { id: user.id },
                    select: { role: true, trustScore: true },
                });
                if (dbUser) {
                    token.role = dbUser.role;
                    token.trustScore = dbUser.trustScore;
                }
            }
            return token;
        },
        session({ session, token }) {
            if (session.user) {
                session.user.id = (token.sub ?? token.id) as string;
                (session.user as any).role = token.role;
                (session.user as any).trustScore = token.trustScore;
            }
            return session;
        },
    },
    pages: {
        signIn: "/auth/signin",
        error: "/auth/error",
    },
    session: { strategy: "jwt" },
});
