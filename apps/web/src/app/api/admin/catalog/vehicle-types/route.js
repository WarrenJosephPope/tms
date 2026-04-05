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

/** GET /api/admin/catalog/vehicle-types — list all */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    if (!(await requireAdmin(supabase, user))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const admin = await createAdminClient();
    const { data, error } = await admin
      .from("vehicle_type_refs")
      .select("*")
      .order("label");
    if (error) throw error;
    return NextResponse.json({ vehicleTypes: data });
  } catch (err) {
    console.error("GET /api/admin/catalog/vehicle-types:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
