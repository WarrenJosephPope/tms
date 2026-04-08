import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/loads/[id]/bids/position
 *
 * Returns the calling transporter's best active bid and its real-time rank
 * among all active bids on the load (position 1 = lowest amount = best).
 *
 * Shape: { bid_id, amount, position, total_bids } | null (no active bid)
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
      .select("user_type")
      .eq("id", user.id)
      .single();

    if (!profile || profile.user_type !== "transporter") {
      return NextResponse.json({ error: "Only transporters can check bid position" }, { status: 403 });
    }

    // get_my_bid_position is SECURITY DEFINER and uses auth.uid() internally;
    // calling via the user client is sufficient.
    const { data, error } = await supabase.rpc("get_my_bid_position", {
      p_load_id: loadId,
    });

    if (error) {
      console.error("get_my_bid_position error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // The function returns a set; we want the first (and only) row, or null.
    return NextResponse.json(data?.[0] ?? null);
  } catch (err) {
    console.error("GET /api/loads/[id]/bids/position error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
