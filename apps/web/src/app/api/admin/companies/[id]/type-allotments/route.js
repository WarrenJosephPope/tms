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
 * GET /api/admin/companies/[id]/type-allotments
 * Returns the commodity type IDs and vehicle type keys allotted to a company,
 * alongside the full catalogs so the admin UI can render checkboxes.
 */
export async function GET(request, { params }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    if (!(await requireAdmin(supabase, user))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { id: companyId } = await params;
    const admin = await createAdminClient();

    const [allCommodities, allVehicleTypes, allottedCommodities, allottedVehicleTypes] = await Promise.all([
      admin.from("commodity_types").select("id, name, is_active").order("name"),
      admin.from("vehicle_type_refs").select("key, label, is_active").order("label"),
      admin.from("company_commodity_types").select("commodity_type_id").eq("company_id", companyId),
      admin.from("company_vehicle_types").select("vehicle_type_key").eq("company_id", companyId),
    ]);

    if (allCommodities.error) throw allCommodities.error;
    if (allVehicleTypes.error) throw allVehicleTypes.error;

    return NextResponse.json({
      allCommodities: allCommodities.data,
      allVehicleTypes: allVehicleTypes.data,
      allottedCommodityIds: (allottedCommodities.data ?? []).map((r) => r.commodity_type_id),
      allottedVehicleKeys: (allottedVehicleTypes.data ?? []).map((r) => r.vehicle_type_key),
    });
  } catch (err) {
    console.error("GET /api/admin/companies/[id]/type-allotments:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * PUT /api/admin/companies/[id]/type-allotments
 * Body: { commodityTypeIds: string[], vehicleTypeKeys: string[] }
 * Replaces all allotments for the company (delete-then-insert).
 * Empty arrays = "allow all" fallback behaviour.
 */
export async function PUT(request, { params }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    if (!(await requireAdmin(supabase, user))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { id: companyId } = await params;
    const { commodityTypeIds = [], vehicleTypeKeys = [] } = await request.json();

    if (!Array.isArray(commodityTypeIds) || !Array.isArray(vehicleTypeKeys)) {
      return NextResponse.json({ error: "commodityTypeIds and vehicleTypeKeys must be arrays" }, { status: 400 });
    }

    const admin = await createAdminClient();

    // Delete existing allotments
    await Promise.all([
      admin.from("company_commodity_types").delete().eq("company_id", companyId),
      admin.from("company_vehicle_types").delete().eq("company_id", companyId),
    ]);

    // Insert new allotments (skip if arrays are empty)
    const insertPromises = [];
    if (commodityTypeIds.length > 0) {
      insertPromises.push(
        admin.from("company_commodity_types").insert(
          commodityTypeIds.map((id) => ({ company_id: companyId, commodity_type_id: id }))
        )
      );
    }
    if (vehicleTypeKeys.length > 0) {
      insertPromises.push(
        admin.from("company_vehicle_types").insert(
          vehicleTypeKeys.map((key) => ({ company_id: companyId, vehicle_type_key: key }))
        )
      );
    }

    const results = await Promise.all(insertPromises);
    for (const result of results) {
      if (result.error) throw result.error;
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("PUT /api/admin/companies/[id]/type-allotments:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
