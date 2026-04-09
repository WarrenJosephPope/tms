import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

/**
 * GET /api/company/branches
 *
 * Returns all active branches for the calling shipper's company.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("company_id, user_type")
      .eq("id", user.id)
      .single();

    if (!profile || profile.user_type !== "shipper") {
      return NextResponse.json({ error: "Shippers only" }, { status: 403 });
    }

    const { data, error } = await supabase
      .from("company_branches")
      .select("id, name, address_line1, city, state, pincode, lat, lng")
      .eq("company_id", profile.company_id)
      .eq("is_active", true)
      .order("name");

    if (error) {
      console.error("GET /api/company/branches error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data ?? []);
  } catch (err) {
    console.error("GET /api/company/branches error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/company/branches
 *
 * Creates a new branch. Restricted to account_owner.
 * Body: { name, address_line1, city, state, pincode, lat, lng }
 */
export async function POST(request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("company_id, user_type, shipper_role")
      .eq("id", user.id)
      .single();

    if (!profile || profile.user_type !== "shipper") {
      return NextResponse.json({ error: "Shippers only" }, { status: 403 });
    }
    if (profile.shipper_role !== "account_owner") {
      return NextResponse.json({ error: "Only account owners can create branches" }, { status: 403 });
    }

    const body = await request.json();
    const { name, address_line1, city, state, pincode, lat, lng } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: "Branch name is required" }, { status: 400 });
    }

    const admin = await createAdminClient();
    const { data, error } = await admin
      .from("company_branches")
      .insert({
        company_id:    profile.company_id,
        name:          name.trim(),
        address_line1: address_line1?.trim() || null,
        city:          city?.trim() || null,
        state:         state?.trim() || null,
        pincode:       pincode?.trim() || null,
        lat:           lat != null ? Number(lat) : null,
        lng:           lng != null ? Number(lng) : null,
      })
      .select("id, name, address_line1, city, state, pincode, lat, lng")
      .single();

    if (error) {
      console.error("POST /api/company/branches insert error:", error);
      return NextResponse.json({ error: "Failed to create branch" }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    console.error("POST /api/company/branches error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
