import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

/**
 * PATCH /api/company/branches/[id]
 * Body: { name?, is_active? }
 * Updates a branch. Restricted to account_owner.
 */
export async function PATCH(request, { params }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("company_id, user_type, shipper_role")
      .eq("id", user.id)
      .single();

    if (!profile || profile.user_type !== "shipper") {
      return NextResponse.json({ error: "Shippers only" }, { status: 403 });
    }
    if (profile.shipper_role !== "account_owner") {
      return NextResponse.json({ error: "Only account owners can update branches" }, { status: 403 });
    }

    const { id: branchId } = await params;
    const body = await request.json();

    const patch = {};
    if (body.name !== undefined) patch.name = body.name.trim();
    // is_active can only be changed by admins — silently ignore if sent by a shipper

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }

    const admin = await createAdminClient();

    // Verify the branch belongs to this company before updating
    const { data: branch } = await admin
      .from("company_branches")
      .select("id, company_id")
      .eq("id", branchId)
      .single();

    if (!branch || branch.company_id !== profile.company_id) {
      return NextResponse.json({ error: "Branch not found" }, { status: 404 });
    }

    const { data, error } = await admin
      .from("company_branches")
      .update(patch)
      .eq("id", branchId)
      .select("id, name, address_line1, city, state, pincode, lat, lng, is_active")
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (err) {
    console.error("PATCH /api/company/branches/[id]:", err);
    return NextResponse.json({ error: "Failed to update branch" }, { status: 500 });
  }
}
