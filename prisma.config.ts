import path from "node:path";
import fs from "node:fs";
import { defineConfig } from "prisma/config";

// Prisma CLI only auto-loads .env, not .env.local. Load it manually.
const envLocal = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envLocal)) {
  for (const line of fs.readFileSync(envLocal, "utf-8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val  = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (key && !process.env[key]) process.env[key] = val;
  }
}

export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  // PrismaConfig.datasource.url is what `prisma migrate` reads.
  // The PrismaPg driver adapter lives only in lib/prisma.ts (runtime only).
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
