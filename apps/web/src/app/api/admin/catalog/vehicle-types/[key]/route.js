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
 * PATCH /api/admin/catalog/vehicle-types/[key]
 * Body: { label?: string, is_active?: boolean }
 * Note: keys are immutable as they must match the vehicle_type enum.
 */
export async function PATCH(request, { params }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    if (!(await requireAdmin(supabase, user))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { key } = await params;
    const body = await request.json();
    const updates = {};
    if (typeof body.label === "string") {
      if (!body.label.trim()) return NextResponse.json({ error: "Label cannot be empty" }, { status: 400 });
      updates.label = body.label.trim();
    }
    if (typeof body.is_active === "boolean") updates.is_active = body.is_active;
    if (Object.keys(updates).length === 0) return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });

    const admin = await createAdminClient();
    const { data, error } = await admin
      .from("vehicle_type_refs")
      .update(updates)
      .eq("key", key)
      .select()
      .single();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(data);
  } catch (err) {
    console.error("PATCH /api/admin/catalog/vehicle-types/[key]:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
