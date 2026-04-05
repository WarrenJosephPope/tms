import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

export async function POST(request, { params }) {
  try {
    const { id: loadId } = await params;
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("company_id, user_type, shipper_role")
      .eq("id", user.id)
      .single();

    if (!profile || profile.user_type !== "shipper") {
      return NextResponse.json({ error: "Only shippers can accept bids" }, { status: 403 });
    }
    if (!["account_owner", "operations_manager"].includes(profile.shipper_role)) {
      return NextResponse.json({ error: "Insufficient role" }, { status: 403 });
    }

    const body = await request.json();
    const { bid_id } = body;
    if (!bid_id) return NextResponse.json({ error: "bid_id is required" }, { status: 400 });

    const admin = await createAdminClient();

    // Verify the load belongs to this shipper's company
    const { data: load } = await admin
      .from("loads")
      .select("shipper_company_id")
      .eq("id", loadId)
      .single();

    if (!load || load.shipper_company_id !== profile.company_id) {
      return NextResponse.json({ error: "Load not found or access denied" }, { status: 404 });
    }

    // Use atomic DB function to award load and create trip
    const { data: trip, error: awardError } = await admin.rpc("award_load_to_bid", {
      p_load_id:         loadId,
      p_bid_id:          bid_id,
      p_shipper_user_id: user.id,
    });

    if (awardError) {
      return NextResponse.json({ error: awardError.message }, { status: 422 });
    }

    return NextResponse.json(trip, { status: 200 });
  } catch (err) {
    console.error("POST /api/loads/[id]/accept error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
