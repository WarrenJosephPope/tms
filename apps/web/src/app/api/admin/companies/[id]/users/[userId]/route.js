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
 * PATCH /api/admin/companies/[id]/users/[userId]
 * Body: { action: "ban" | "unban" }
 * Bans or unbans a user within the specified company.
 */
export async function PATCH(request, { params }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    if (!(await requireAdmin(supabase, user))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { id: companyId, userId } = await params;
    const body = await request.json();
    const { action } = body;

    if (!["ban", "unban"].includes(action)) {
      return NextResponse.json({ error: "action must be 'ban' or 'unban'" }, { status: 400 });
    }

    const admin = await createAdminClient();

    // Verify the user_profile belongs to this company
    const { data: profile, error: profileError } = await admin
      .from("user_profiles")
      .select("id, is_active")
      .eq("id", userId)
      .eq("company_id", companyId)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: "User not found in this company" }, { status: 404 });
    }

    const isBanning = action === "ban";

    // Update profile is_active
    const { error: updateError } = await admin
      .from("user_profiles")
      .update({ is_active: !isBanning })
      .eq("id", userId);

    if (updateError) {
      console.error("Profile update error:", updateError);
      return NextResponse.json({ error: "Failed to update user status" }, { status: 500 });
    }

    // Update Supabase Auth ban status
    const { error: authError } = await admin.auth.admin.updateUserById(userId, {
      ban_duration: isBanning ? "87600h" : "none",
    });

    if (authError) {
      // Rollback profile change
      await admin.from("user_profiles").update({ is_active: isBanning }).eq("id", userId);
      console.error("Auth ban error:", authError);
      return NextResponse.json({ error: "Failed to update auth status" }, { status: 500 });
    }

    return NextResponse.json({ success: true, is_active: !isBanning });
  } catch (err) {
    console.error("PATCH /api/admin/companies/[id]/users/[userId]:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
