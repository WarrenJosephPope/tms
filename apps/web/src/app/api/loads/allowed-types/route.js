import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

/**
 * GET /api/loads/allowed-types
 * Returns the commodity types and vehicle types the calling shipper's company
 * is allowed to use. Falls back to all active types if no allotments are set.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("company_id, user_type")
      .eq("id", user.id)
      .single();

    if (!profile || profile.user_type !== "shipper") {
      return NextResponse.json({ error: "Only shippers can access allowed types" }, { status: 403 });
    }

    const admin = await createAdminClient();
    const companyId = profile.company_id;

    const [allottedCommodities, allottedVehicleTypes] = await Promise.all([
      admin.from("company_commodity_types").select("commodity_type_id").eq("company_id", companyId),
      admin.from("company_vehicle_types").select("vehicle_type_key").eq("company_id", companyId),
    ]);

    let commodities, vehicleTypes;

    if (allottedCommodities.data?.length > 0) {
      // Fetch only the allotted commodity types that are still active
      const ids = allottedCommodities.data.map((r) => r.commodity_type_id);
      const { data } = await admin
        .from("commodity_types")
        .select("id, name")
        .in("id", ids)
        .eq("is_active", true)
        .order("name");
      commodities = data ?? [];
    } else {
      // No allotments set — return all active types (allow-all default)
      const { data } = await admin
        .from("commodity_types")
        .select("id, name")
        .eq("is_active", true)
        .order("name");
      commodities = data ?? [];
    }

    if (allottedVehicleTypes.data?.length > 0) {
      // Fetch only the allotted vehicle types that are still active
      const keys = allottedVehicleTypes.data.map((r) => r.vehicle_type_key);
      const { data } = await admin
        .from("vehicle_type_refs")
        .select("key, label")
        .in("key", keys)
        .eq("is_active", true)
        .order("label");
      vehicleTypes = data ?? [];
    } else {
      // No allotments set — return all active types
      const { data } = await admin
        .from("vehicle_type_refs")
        .select("key, label")
        .eq("is_active", true)
        .order("label");
      vehicleTypes = data ?? [];
    }

    return NextResponse.json({ commodities, vehicleTypes });
  } catch (err) {
    console.error("GET /api/loads/allowed-types:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
