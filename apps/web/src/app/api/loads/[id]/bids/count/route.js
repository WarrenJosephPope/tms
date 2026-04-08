import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

/**
 * GET /api/loads/[id]/bids/count
 *
 * Returns the total number of active bids on a load.
 * Only accessible by the shipper who owns the load — used during the
 * blind-bidding phase to show "X sealed bids received" without revealing
 * transporter identities or amounts.
 *
 * Shape: { count: number }
 */
export async function GET(request, { params }) {
  try {
    const { id: loadId } = await params;
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

    // Verify the load belongs to this shipper's company (RLS enforces this on the
    // loads table, so a 404 here means unauthorized or non-existent).
    const { data: load } = await supabase
      .from("loads")
      .select("id")
      .eq("id", loadId)
      .eq("shipper_company_id", profile.company_id)
      .single();

    if (!load) {
      return NextResponse.json({ error: "Load not found" }, { status: 404 });
    }

    // Use admin client because get_load_active_bid_count bypasses RLS intentionally.
    const admin = await createAdminClient();
    const { data, error } = await admin.rpc("get_load_active_bid_count", {
      p_load_id: loadId,
    });

    if (error) {
      console.error("get_load_active_bid_count error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ count: data ?? 0 });
  } catch (err) {
    console.error("GET /api/loads/[id]/bids/count error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
