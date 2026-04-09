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
      .select("company_id, user_type, transporter_role")
      .eq("id", user.id)
      .single();

    if (!profile || profile.user_type !== "transporter") {
      return NextResponse.json({ error: "Only transporters can bid" }, { status: 403 });
    }
    if (!["account_owner", "fleet_manager"].includes(profile.transporter_role)) {
      return NextResponse.json({ error: "Insufficient role to place bids" }, { status: 403 });
    }

    const body = await request.json();
    const { amount, eta_days, notes } = body;

    if (!amount || Number(amount) <= 0) {
      return NextResponse.json({ error: "Invalid bid amount" }, { status: 400 });
    }

    // Use atomic DB function to validate and insert the bid
    const admin = await createAdminClient();
    const { data: bid, error: bidError } = await admin.rpc("place_bid_atomic", {
      p_load_id:                loadId,
      p_transporter_company_id: profile.company_id,
      p_bidder_id:              user.id,
      p_amount:                 Number(amount),
      p_eta_days:               eta_days ? Number(eta_days) : null,
      p_notes:                  notes?.trim() || null,
    });

    if (bidError) {
      // Return DB validation message to user
      return NextResponse.json({ error: bidError.message }, { status: 422 });
    }

    return NextResponse.json(bid, { status: 201 });
  } catch (err) {
    console.error("POST /api/loads/[id]/bids error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET(request, { params }) {
  try {
    const { id: loadId } = await params;
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const admin = await createAdminClient();
    const { data, error } = await admin
      .from("bids")
      .select("id, amount, eta_days, notes, status, created_at, updated_at, transporter_company_id")
      .eq("load_id", loadId)
      .eq("status", "active")
      .order("amount", { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Keep only the best (lowest) bid per transporter company — earlier bids
    // from the same company are retained for reporting but excluded from the live view.
    const seen = new Set();
    const latest = (data ?? []).filter((bid) => {
      if (seen.has(bid.transporter_company_id)) return false;
      seen.add(bid.transporter_company_id);
      return true;
    });

    // Batch-fetch company names for all unique transporter company IDs
    const companyIds = latest.map((b) => b.transporter_company_id).filter(Boolean);
    let companyNames = {};
    if (companyIds.length > 0) {
      const { data: companies } = await admin
        .from("companies")
        .select("id, name")
        .in("id", companyIds);
      for (const c of companies ?? []) companyNames[c.id] = c.name;
    }

    const result = latest.map((b) => ({
      ...b,
      transporter_company: { name: companyNames[b.transporter_company_id] ?? null },
    }));

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
