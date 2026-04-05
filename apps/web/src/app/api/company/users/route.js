import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

async function requireAccountOwner(supabase, user) {
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("company_id, user_type, shipper_role, transporter_role")
    .eq("id", user.id)
    .single();

  if (!profile) return null;

  const isOwner =
    (profile.user_type === "shipper" && profile.shipper_role === "account_owner") ||
    (profile.user_type === "transporter" && profile.transporter_role === "account_owner");

  return isOwner ? profile : null;
}

/**
 * GET /api/company/users
 * Returns all user profiles for the caller's company (account_owner only).
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const ownerProfile = await requireAccountOwner(supabase, user);
    if (!ownerProfile) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const admin = await createAdminClient();
    const { data: users, error } = await admin
      .from("user_profiles")
      .select("id, full_name, phone, email, user_type, shipper_role, transporter_role, is_active, created_at")
      .eq("company_id", ownerProfile.company_id)
      .order("created_at", { ascending: true });

    if (error) throw error;

    return NextResponse.json({ users: users ?? [] });
  } catch (err) {
    console.error("GET /api/company/users:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/company/users
 * Body: { full_name, phone, email?, role }
 * Creates a new user for the caller's company. Account owners cannot create another account_owner.
 */
export async function POST(request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const ownerProfile = await requireAccountOwner(supabase, user);
    if (!ownerProfile) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await request.json();
    const { full_name, phone, email, role } = body;

    if (!full_name?.trim() || !phone?.trim() || !role) {
      return NextResponse.json({ error: "full_name, phone, and role are required" }, { status: 400 });
    }

    // Account owners cannot create another account_owner
    const ALLOWED_ROLES = {
      shipper: ["operations_manager", "viewer"],
      transporter: ["fleet_manager", "driver"],
    };
    if (!ALLOWED_ROLES[ownerProfile.user_type]?.includes(role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }

    const admin = await createAdminClient();

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

    // Create the auth user
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
      ownerProfile.user_type === "shipper" ? "shipper_role" : "transporter_role";

    const { error: profileError } = await admin.from("user_profiles").insert({
      id: newUserId,
      company_id: ownerProfile.company_id,
      full_name: full_name.trim(),
      phone: formattedPhone,
      email: email?.trim() || null,
      user_type: ownerProfile.user_type,
      [roleField]: role,
    });

    if (profileError) {
      console.error("Profile insert error:", profileError);
      await admin.auth.admin.deleteUser(newUserId);
      return NextResponse.json({ error: "Failed to create user profile" }, { status: 500 });
    }

    return NextResponse.json({ success: true, user_id: newUserId }, { status: 201 });
  } catch (err) {
    console.error("POST /api/company/users:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
