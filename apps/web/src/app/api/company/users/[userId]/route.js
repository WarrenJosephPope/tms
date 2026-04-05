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
 * PATCH /api/company/users/[userId]
 * Body: { action: "ban" | "unban" }
 * Bans or unbans a user in the caller's company. Cannot ban yourself or another account_owner.
 */
export async function PATCH(request, { params }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const ownerProfile = await requireAccountOwner(supabase, user);
    if (!ownerProfile) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { userId } = await params;

    if (userId === user.id) {
      return NextResponse.json({ error: "You cannot ban yourself" }, { status: 400 });
    }

    const body = await request.json();
    const { action } = body;

    if (!["ban", "unban"].includes(action)) {
      return NextResponse.json({ error: "action must be 'ban' or 'unban'" }, { status: 400 });
    }

    const admin = await createAdminClient();

    // Verify the user_profile belongs to this company and is not an account_owner
    const { data: targetProfile, error: profileError } = await admin
      .from("user_profiles")
      .select("id, is_active, shipper_role, transporter_role")
      .eq("id", userId)
      .eq("company_id", ownerProfile.company_id)
      .single();

    if (profileError || !targetProfile) {
      return NextResponse.json({ error: "User not found in your company" }, { status: 404 });
    }

    // Prevent banning another account_owner
    const isTargetOwner =
      targetProfile.shipper_role === "account_owner" ||
      targetProfile.transporter_role === "account_owner";
    if (isTargetOwner) {
      return NextResponse.json({ error: "Cannot ban another account owner" }, { status: 403 });
    }

    const isBanning = action === "ban";

    const { error: updateError } = await admin
      .from("user_profiles")
      .update({ is_active: !isBanning })
      .eq("id", userId);

    if (updateError) {
      console.error("Profile update error:", updateError);
      return NextResponse.json({ error: "Failed to update user status" }, { status: 500 });
    }

    const { error: authError } = await admin.auth.admin.updateUserById(userId, {
      ban_duration: isBanning ? "87600h" : "none",
    });

    if (authError) {
      await admin.from("user_profiles").update({ is_active: isBanning }).eq("id", userId);
      console.error("Auth ban error:", authError);
      return NextResponse.json({ error: "Failed to update auth status" }, { status: 500 });
    }

    return NextResponse.json({ success: true, is_active: !isBanning });
  } catch (err) {
    console.error("PATCH /api/company/users/[userId]:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
