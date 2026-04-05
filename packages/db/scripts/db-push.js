#!/usr/bin/env node
/**
 * Reads Supabase connection vars from apps/supabase/.env and runs:
 *   supabase db push --db-url <url> [extra args]
 *
 * Usage:
 *   node scripts/db-push.js
 *   node scripts/db-push.js --include-all   # also reapply already-tracked migrations
 */

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const envPath = path.resolve(__dirname, "../../../apps/supabase/.env");

if (!fs.existsSync(envPath)) {
  console.error(`ERROR: Could not find .env at ${envPath}`);
  process.exit(1);
}

// Parse .env — handles values that contain '='
const env = {};
for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eqIdx = trimmed.indexOf("=");
  if (eqIdx === -1) continue;
  env[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim();
}

const password = env.POSTGRES_PASSWORD;
const tenantId = env.POOLER_TENANT_ID;
const host = "localhost";
const port = env.POSTGRES_PORT || "5432";
const db = env.POSTGRES_DB || "postgres";

if (!password) {
  console.error("ERROR: POSTGRES_PASSWORD not found in .env");
  process.exit(1);
}
if (!tenantId) {
  console.error("ERROR: POOLER_TENANT_ID not found in .env");
  process.exit(1);
}

// Supavisor requires the username format: postgres.<tenant-id>
const user = `postgres.${tenantId}`;
const dbUrl = `postgresql://${user}:${encodeURIComponent(password)}@${host}:${port}/${db}`;
const extraArgs = process.argv.slice(2).join(" ");
const cmd = `supabase db push --db-url "${dbUrl}" ${extraArgs}`.trim();

console.log(
  `Running: ${cmd.replace(encodeURIComponent(password), "****")}\n`
);

try {
  execSync(cmd, {
    stdio: "inherit",
    cwd: path.resolve(__dirname, ".."),
  });
} catch (err) {
  process.exit(err.status ?? 1);
}
