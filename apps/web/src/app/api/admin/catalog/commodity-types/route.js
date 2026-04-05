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

/** GET /api/admin/catalog/commodity-types — list all */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    if (!(await requireAdmin(supabase, user))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const admin = await createAdminClient();
    const { data, error } = await admin
      .from("commodity_types")
      .select("*")
      .order("name");
    if (error) throw error;
    return NextResponse.json({ commodityTypes: data });
  } catch (err) {
    console.error("GET /api/admin/catalog/commodity-types:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/** POST /api/admin/catalog/commodity-types — create */
export async function POST(request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    if (!(await requireAdmin(supabase, user))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { name } = await request.json();
    if (!name?.trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 });

    const admin = await createAdminClient();
    const { data, error } = await admin
      .from("commodity_types")
      .insert({ name: name.trim() })
      .select()
      .single();
    if (error) {
      if (error.code === "23505") return NextResponse.json({ error: "A commodity type with this name already exists" }, { status: 409 });
      throw error;
    }
    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    console.error("POST /api/admin/catalog/commodity-types:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
