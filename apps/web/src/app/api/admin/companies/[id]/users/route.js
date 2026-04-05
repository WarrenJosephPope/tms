import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

async function requireAdmin(supabase, user) {
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("user_type")
    .eq("id", user.id)
    .single();
  return profile?.user_type === "admin";
}

/**
 * GET /api/admin/companies/[id]/users
 * Returns all user profiles for a given company.
 */
export async function GET(request, { params }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    if (!(await requireAdmin(supabase, user))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { id: companyId } = await params;
    const admin = await createAdminClient();

    const { data: users, error } = await admin
      .from("user_profiles")
      .select("id, full_name, phone, email, user_type, shipper_role, transporter_role, admin_role, is_active, created_at")
      .eq("company_id", companyId)
      .order("created_at", { ascending: true });

    if (error) throw error;

    return NextResponse.json({ users: users ?? [] });
  } catch (err) {
    console.error("GET /api/admin/companies/[id]/users:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/admin/companies/[id]/users
 * Body: { full_name, phone, email?, role }
 * Creates a new auth user + user_profile for the company.
 */
export async function POST(request, { params }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    if (!(await requireAdmin(supabase, user))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { id: companyId } = await params;
    const body = await request.json();
    const { full_name, phone, email, role } = body;

    if (!full_name?.trim() || !phone?.trim() || !role) {
      return NextResponse.json({ error: "full_name, phone, and role are required" }, { status: 400 });
    }

    const admin = await createAdminClient();

    // Verify the company exists and get its user_type
    const { data: company, error: companyError } = await admin
      .from("companies")
      .select("id, user_type")
      .eq("id", companyId)
      .single();

    if (companyError || !company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    // Validate role against company user_type
    const VALID_ROLES = {
      shipper: ["account_owner", "operations_manager", "viewer"],
      transporter: ["account_owner", "fleet_manager", "driver"],
    };
    if (!VALID_ROLES[company.user_type]?.includes(role)) {
      return NextResponse.json({ error: "Invalid role for this company type" }, { status: 400 });
    }

    // Normalize phone to E.164
    const formattedPhone = phone.trim().startsWith("+")
      ? phone.trim()
      : `+91${phone.trim().replace(/\D/g, "")}`;

    // Check phone is not already registered
    const { data: existingUsers } = await admin.auth.admin.listUsers();
    const phoneAlreadyExists = existingUsers?.users?.some((u) => u.phone === formattedPhone);
    if (phoneAlreadyExists) {
      return NextResponse.json({ error: "A user with this phone number already exists" }, { status: 409 });
    }

    // Create the auth user (phone-only account, OTP login)
    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      phone: formattedPhone,
      phone_confirm: true,
      email: email?.trim() || undefined,
      email_confirm: email?.trim() ? true : undefined,
      user_metadata: { full_name: full_name.trim() },
    });

    if (authError) {
      console.error("Auth createUser error:", authError);
      return NextResponse.json({ error: authError.message || "Failed to create auth user" }, { status: 500 });
    }

    const newUserId = authData.user.id;
    const roleField =
      company.user_type === "shipper" ? "shipper_role" : "transporter_role";

    // Create the user_profile
    const { error: profileError } = await admin.from("user_profiles").insert({
      id: newUserId,
      company_id: companyId,
      full_name: full_name.trim(),
      phone: formattedPhone,
      email: email?.trim() || null,
      user_type: company.user_type,
      [roleField]: role,
    });

    if (profileError) {
      console.error("Profile insert error:", profileError);
      // Clean up the auth user if profile creation fails
      await admin.auth.admin.deleteUser(newUserId);
      return NextResponse.json({ error: "Failed to create user profile" }, { status: 500 });
    }

    return NextResponse.json({ success: true, user_id: newUserId }, { status: 201 });
  } catch (err) {
    console.error("POST /api/admin/companies/[id]/users:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
