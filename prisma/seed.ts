import { PrismaClient, UserRole, Category, IssueStatus } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import bcrypt from "bcryptjs";
import path from "node:path";
import fs from "node:fs";

// Load .env.local (Prisma CLI only auto-loads .env)
const envLocal = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envLocal)) {
    for (const line of fs.readFileSync(envLocal, "utf-8").split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eq = trimmed.indexOf("=");
        if (eq < 0) continue;
        const key = trimmed.slice(0, eq).trim();
        let val = trimmed.slice(eq + 1).trim();
        if (
            (val.startsWith('"') && val.endsWith('"')) ||
            (val.startsWith("'") && val.endsWith("'"))
        ) {
            val = val.slice(1, -1);
        }
        if (key && !process.env[key]) process.env[key] = val;
    }
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
    console.log("Seeding database...");

    // Hash a shared demo password for all seed users
    const demoPassword = await bcrypt.hash("password123", 12);

    // Create admin user
    const admin = await prisma.user.upsert({
        where: { email: "admin@civictrack.dev" },
        update: { password: demoPassword },
        create: {
            email: "admin@civictrack.dev",
            name: "CivicTrack Admin",
            password: demoPassword,
            role: UserRole.ADMIN,
            trustScore: 100,
        },
    });

    // Create a sample NGO user
    const ngoUser = await prisma.user.upsert({
        where: { email: "ngo@example.com" },
        update: { password: demoPassword },
        create: {
            email: "ngo@example.com",
            name: "Green City NGO",
            password: demoPassword,
            role: UserRole.NGO,
            trustScore: 80,
        },
    });

    // Create NGO profile
    await prisma.nGO.upsert({
        where: { userId: ngoUser.id },
        update: {},
        create: {
            userId: ngoUser.id,
            name: "Green City Initiative",
            description:
                "We work to improve civic infrastructure across the city. [Visit our website](https://greencity.example.com)",
            categories: [
                Category.ROAD,
                Category.SANITATION,
                Category.PUBLIC_SPACE,
            ],
            status: "APPROVED",
            approvedAt: new Date(),
        },
    });

    // Create a sample citizen
    const citizen = await prisma.user.upsert({
        where: { email: "citizen@example.com" },
        update: { password: demoPassword },
        create: {
            email: "citizen@example.com",
            name: "Raj Kumar",
            password: demoPassword,
            role: UserRole.CITIZEN,
            trustScore: 65,
            totalReports: 3,
        },
    });

    // Sample issues (near New Delhi, India)
    const issues = [
        {
            title: "Large pothole on MG Road near bus stop",
            description:
                "There is a massive pothole approximately 2ft wide near the bus stop on MG Road. Several bikes have had accidents here. Needs immediate repair.",
            category: Category.ROAD,
            status: IssueStatus.VERIFIED,
            lat: 28.6304,
            lng: 77.2177,
            address: "MG Road, New Delhi",
            upvotes: 12,
            priority: 8,
        },
        {
            title: "Street light not working for 2 weeks",
            description:
                "The street light at the corner of Park Street has been out for over 2 weeks. The area is very dark at night and it's unsafe for pedestrians.",
            category: Category.ELECTRICITY,
            status: IssueStatus.ASSIGNED,
            lat: 28.6289,
            lng: 77.209,
            address: "Park Street, New Delhi",
            upvotes: 8,
            priority: 6,
        },
        {
            title: "Open manhole near school — dangerous",
            description:
                "There's an open manhole cover right in front of City Public School. Children walk here daily and it's a serious safety hazard. Cover has been missing for 5 days.",
            category: Category.SANITATION,
            status: IssueStatus.REPORTED,
            lat: 28.6315,
            lng: 77.22,
            address: "Near City Public School, New Delhi",
            upvotes: 21,
            priority: 9,
        },
        {
            title: "Water pipe burst flooding footpath",
            description:
                "A water pipe has burst near the market and water is flooding the footpath. The road is becoming slippery and the water wastage is significant.",
            category: Category.WATER,
            status: IssueStatus.RESOLVED,
            lat: 28.627,
            lng: 77.215,
            address: "Main Market, New Delhi",
            upvotes: 5,
            priority: 7,
            resolvedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        },
    ];

    for (const issue of issues) {
        await prisma.issue.create({
            data: {
                ...issue,
                reporterId: citizen.id,
                imageUrls: [],
            },
        });
    }

    console.log("✅ Seed complete!");
    console.log(`Admin: ${admin.email}`);
    console.log(`NGO: ${ngoUser.email}`);
    console.log(`Citizen: ${citizen.email}`);
}

main()
    .catch(console.error)
    .finally(async () => {
        await prisma.$disconnect();
        await pool.end();
    });
