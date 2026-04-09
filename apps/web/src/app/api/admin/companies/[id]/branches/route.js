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
 * GET /api/admin/companies/[id]/branches
 * Lists all branches for the given company.
 */
export async function GET(request, { params }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    if (!(await requireAdmin(supabase, user))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { id: companyId } = await params;
    const admin = await createAdminClient();

    const { data, error } = await admin
      .from("company_branches")
      .select("id, name, address_line1, city, state, pincode, lat, lng, is_active, created_at")
      .eq("company_id", companyId)
      .order("name");

    if (error) throw error;
    return NextResponse.json(data ?? []);
  } catch (err) {
    console.error("GET /api/admin/companies/[id]/branches:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/admin/companies/[id]/branches
 * Body: { name, address_line1, city, state, pincode, lat, lng }
 * Creates a new branch for the company.
 */
export async function POST(request, { params }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    if (!(await requireAdmin(supabase, user))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { id: companyId } = await params;
    const body = await request.json();
    const { name, address_line1, city, state, pincode, lat, lng } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: "Branch name is required" }, { status: 400 });
    }

    const admin = await createAdminClient();
    const { data, error } = await admin
      .from("company_branches")
      .insert({
        company_id:    companyId,
        name:          name.trim(),
        address_line1: address_line1?.trim() || null,
        city:          city?.trim() || null,
        state:         state?.trim() || null,
        pincode:       pincode?.trim() || null,
        lat:           lat != null ? Number(lat) : null,
        lng:           lng != null ? Number(lng) : null,
      })
      .select("id, name, address_line1, city, state, pincode, lat, lng, is_active, created_at")
      .single();

    if (error) throw error;
    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    console.error("POST /api/admin/companies/[id]/branches:", err);
    return NextResponse.json({ error: "Failed to create branch" }, { status: 500 });
  }
}
