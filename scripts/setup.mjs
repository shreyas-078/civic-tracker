#!/usr/bin/env node
// One-command local setup. Works on Linux, macOS and Windows.
// It installs npm packages and writes .env.local. It never installs system
// software and never asks for administrator rights.
//
//   npm run setup            install, configure, migrate
//   npm run setup -- --seed  also load demo data
//   npm run setup -- --skip-db  skip the database steps

import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(root);

const args = new Set(process.argv.slice(2));
const isWin = process.platform === "win32";
const DEFAULT_DB_URL = "postgresql://civic:civic@localhost:5432/civic_tracker";

const say = (m) => console.log(m);
const step = (m) => say(`\n== ${m}`);
const ok = (m) => say(`   ok    ${m}`);
const warn = (m) => say(`   warn  ${m}`);
const fail = (m) => {
  say(`   FAIL  ${m}`);
  process.exit(1);
};

function run(cmd, cmdArgs, { quiet = false } = {}) {
  const r = spawnSync(cmd, cmdArgs, {
    cwd: root,
    stdio: quiet ? "pipe" : "inherit",
    shell: isWin,
    encoding: "utf8",
  });
  return { code: r.status ?? 1, out: `${r.stdout ?? ""}${r.stderr ?? ""}` };
}

// 1. Node version
step("Node.js");
const major = Number(process.versions.node.split(".")[0]);
if (major < 20) fail(`Node ${process.versions.node} found. Install Node 20 or newer from https://nodejs.org.`);
ok(`Node ${process.versions.node}`);

// 2. Dependencies
step("npm install");
if (run("npm", ["install"]).code !== 0) fail("npm install failed. Fix the error above and run again.");
ok("dependencies installed");

// 3. .env.local
step(".env.local");
const envPath = path.join(root, ".env.local");
if (!fs.existsSync(envPath)) {
  fs.copyFileSync(path.join(root, ".env.example"), envPath);
  ok("created from .env.example");
} else {
  ok("already exists, keeping your values");
}

let env = fs.readFileSync(envPath, "utf8");
const get = (key) => {
  const m = env.match(new RegExp(`^${key}=(.*)$`, "m"));
  return m ? m[1].replace(/\s+#.*$/, "").trim().replace(/^["']|["']$/g, "") : "";
};
const set = (key, value) => {
  const line = `${key}="${value}"`;
  const re = new RegExp(`^${key}=.*$`, "m");
  env = re.test(env) ? env.replace(re, () => line) : `${env.trimEnd()}\n${line}\n`;
  fs.writeFileSync(envPath, env);
};

// 4. Generated secrets
step("Secrets");
for (const key of ["NEXTAUTH_SECRET", "CRON_SECRET"]) {
  if (get(key)) ok(`${key} already set`);
  else {
    set(key, randomBytes(32).toString("base64"));
    ok(`${key} generated`);
  }
}
if (get("VAPID_PUBLIC_KEY") && get("VAPID_PRIVATE_KEY")) {
  ok("VAPID keys already set");
} else {
  try {
    const webpush = createRequire(import.meta.url)("web-push");
    const keys = webpush.generateVAPIDKeys();
    set("VAPID_PUBLIC_KEY", keys.publicKey);
    set("VAPID_PRIVATE_KEY", keys.privateKey);
    set("NEXT_PUBLIC_VAPID_PUBLIC_KEY", keys.publicKey);
    ok("VAPID keys generated");
  } catch {
    warn("could not generate VAPID keys. Run: npx web-push generate-vapid-keys");
  }
}

// 5. Database
if (args.has("--skip-db")) {
  step("Database");
  warn("skipped (--skip-db)");
} else {
  step("Database");
  const current = get("DATABASE_URL");
  if (!current || /user:.*@localhost:5432\/civic_tracker/.test(current)) {
    set("DATABASE_URL", DEFAULT_DB_URL);
    ok("DATABASE_URL set to the docker-compose default");
  } else {
    ok("DATABASE_URL already set, keeping it");
  }

  step("Prisma");
  if (run("npx", ["prisma", "generate"]).code !== 0) fail("prisma generate failed.");
  ok("client generated");

  const migrate = run("npx", ["prisma", "migrate", "deploy"], { quiet: true });
  if (migrate.code !== 0) {
    say(migrate.out.split("\n").slice(-12).join("\n"));
    warn("could not reach the database. Start one, then run: npx prisma migrate deploy");
    warn("  With Docker:  docker compose up -d   (then run this setup again)");
    warn("  Without it:   point DATABASE_URL in .env.local at any PostgreSQL 14+ server");
  } else {
    ok("migrations applied");
    if (args.has("--seed")) {
      if (run("npm", ["run", "prisma:seed"]).code === 0) ok("demo data loaded");
      else warn("seeding failed. Run: npm run prisma:seed");
    }
  }
}

// 6. What is still missing
step("Still to fill in .env.local");
env = fs.readFileSync(envPath, "utf8");
const optional = {
  GOOGLE_CLIENT_ID: "Google sign-in",
  GOOGLE_CLIENT_SECRET: "Google sign-in",
  NEXT_PUBLIC_MAPBOX_TOKEN: "map display",
};
let missing = 0;
for (const [key, why] of Object.entries(optional)) {
  if (!get(key)) {
    warn(`${key} is empty (${why})`);
    missing++;
  }
}
if (!missing) ok("nothing missing");

say("\nDone. Start the app with:  npm run dev   then open http://localhost:3000\n");
