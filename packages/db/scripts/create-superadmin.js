#!/usr/bin/env node
/**
 * Creates a superadmin auth user, admin company, and user_profile.
 *
 * Reads Supabase connection vars from apps/supabase/.env.
 *
 * Usage:
 *   node scripts/create-superadmin.js \
 *     --email admin@eparivahan.in \
 *     --password "SecurePass123!" \
 *     --name "Admin User" \
 *     --phone "+91XXXXXXXXXX"
 *
 * Optional flags:
 *   --company-name  "eParivahan Platform"   (default shown)
 *   --role          super_admin             (default; or support_agent / finance_manager)
 */

const fs   = require("fs");
const path = require("path");

// ---------------------------------------------------------------------------
// Parse CLI args  (--key value)
// ---------------------------------------------------------------------------
function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith("--")) {
        args[key] = next;
        i++;
      } else {
        args[key] = true;
      }
    }
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));

const email       = args["email"];
const password    = args["password"];
const fullName    = args["name"];
const phone       = args["phone"];
const companyName = args["company-name"] || "eParivahan Platform";
const adminRole   = args["role"]         || "super_admin";

if (!email || !password || !fullName || !phone) {
  console.error(
    "Usage: node scripts/create-superadmin.js \\\n" +
    '  --email admin@eparivahan.in \\\n' +
    '  --password "SecurePass123!" \\\n' +
    '  --name "Admin User" \\\n' +
    '  --phone "+91XXXXXXXXXX"'
  );
  process.exit(1);
}

if (!["super_admin", "support_agent", "finance_manager"].includes(adminRole)) {
  console.error("--role must be one of: super_admin, support_agent, finance_manager");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Load .env from apps/supabase/.env
// ---------------------------------------------------------------------------
const envPath = path.resolve(__dirname, "../../../apps/supabase/.env");

if (!fs.existsSync(envPath)) {
  console.error(`ERROR: Could not find .env at ${envPath}`);
  console.error("Copy apps/supabase/.env.example to apps/supabase/.env and fill in your values.");
  process.exit(1);
}

const envVars = {};
for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eqIdx = trimmed.indexOf("=");
  if (eqIdx === -1) continue;
  envVars[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim();
}

const supabaseUrl    = envVars["SUPABASE_PUBLIC_URL"] || "http://localhost:8000";
const serviceRoleKey = envVars["SERVICE_ROLE_KEY"] || envVars["SUPABASE_SECRET_KEY"];

if (!serviceRoleKey) {
  console.error("ERROR: SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY) not found in .env");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  console.log(`\nCreating superadmin: ${email}\n`);

  // 1. Create auth user
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    phone,
    email_confirm: true,
    phone_confirm: true,
  });

  if (authError) {
    console.error("Failed to create auth user:", authError.message);
    process.exit(1);
  }

  const userId = authData.user.id;
  console.log(`✓ Auth user created:  ${userId}`);

  // 2. Upsert admin company (idempotent — safe to re-run)
  const { data: company, error: companyError } = await supabase
    .from("companies")
    .upsert(
      {
        name:       companyName,
        user_type:  "admin",
        phone:      phone,
        email:      email,
        kyc_status: "approved",
        is_active:  true,
      },
      {
        onConflict:        "name,user_type",
        ignoreDuplicates:  false,
      }
    )
    .select("id")
    .single();

  if (companyError) {
    console.error("Failed to upsert admin company:", companyError.message);
    // Clean up the auth user we just created
    await supabase.auth.admin.deleteUser(userId);
    process.exit(1);
  }

  const companyId = company.id;
  console.log(`✓ Admin company ready: ${companyId}`);

  // 3. Insert user_profile
  const { error: profileError } = await supabase
    .from("user_profiles")
    .insert({
      id:         userId,
      company_id: companyId,
      full_name:  fullName,
      phone:      phone,
      email:      email,
      user_type:  "admin",
      admin_role: adminRole,
    });

  if (profileError) {
    console.error("Failed to insert user_profile:", profileError.message);
    await supabase.auth.admin.deleteUser(userId);
    process.exit(1);
  }

  console.log(`✓ user_profile created: role = ${adminRole}`);
  console.log(`\nDone. You can now log in with:\n  Email:    ${email}\n  Password: (as provided)\n`);
}

main();
