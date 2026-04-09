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
 * PATCH /api/admin/companies/[id]/branches/[branchId]
 * Body: { name?, is_active? }
 * Updates a branch (rename or toggle active status).
 */
export async function PATCH(request, { params }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    if (!(await requireAdmin(supabase, user))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { branchId } = await params;
    const body = await request.json();

    const patch = {};
    if (body.name !== undefined) patch.name = body.name.trim();
    if (body.is_active !== undefined) patch.is_active = Boolean(body.is_active);

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }

    const admin = await createAdminClient();
    const { data, error } = await admin
      .from("company_branches")
      .update(patch)
      .eq("id", branchId)
      .select("id, name, address_line1, city, state, pincode, lat, lng, is_active")
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (err) {
    console.error("PATCH /api/admin/companies/[id]/branches/[branchId]:", err);
    return NextResponse.json({ error: "Failed to update branch" }, { status: 500 });
  }
}
