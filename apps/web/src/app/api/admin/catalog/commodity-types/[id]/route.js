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

/** PATCH /api/admin/catalog/commodity-types/[id] — update name or toggle is_active */
export async function PATCH(request, { params }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    if (!(await requireAdmin(supabase, user))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { id } = await params;
    const body = await request.json();
    const updates = {};
    if (typeof body.name === "string") {
      if (!body.name.trim()) return NextResponse.json({ error: "Name cannot be empty" }, { status: 400 });
      updates.name = body.name.trim();
    }
    if (typeof body.is_active === "boolean") updates.is_active = body.is_active;
    if (Object.keys(updates).length === 0) return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });

    const admin = await createAdminClient();
    const { data, error } = await admin
      .from("commodity_types")
      .update(updates)
      .eq("id", id)
      .select()
      .single();
    if (error) {
      if (error.code === "23505") return NextResponse.json({ error: "A commodity type with this name already exists" }, { status: 409 });
      throw error;
    }
    if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(data);
  } catch (err) {
    console.error("PATCH /api/admin/catalog/commodity-types/[id]:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/** DELETE /api/admin/catalog/commodity-types/[id] */
export async function DELETE(request, { params }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    if (!(await requireAdmin(supabase, user))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { id } = await params;
    const admin = await createAdminClient();
    const { error } = await admin.from("commodity_types").delete().eq("id", id);
    if (error) throw error;
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error("DELETE /api/admin/catalog/commodity-types/[id]:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
