import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

// Returns the full bid history for a load (all bids, all statuses, chronological).
// Uses admin client for the query so the companies join resolves across RLS boundaries.
export async function GET(request, { params }) {
  try {
    const { id: loadId } = await params;
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const admin = await createAdminClient();
    const { data, error } = await admin
      .from("bids")
      .select("id, amount, eta_days, notes, status, created_at, transporter_company_id")
      .eq("load_id", loadId)
      .order("created_at", { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Batch-fetch company names for all unique transporter company IDs
    const companyIds = [...new Set((data ?? []).map((b) => b.transporter_company_id).filter(Boolean))];
    let companyNames = {};
    if (companyIds.length > 0) {
      const { data: companies } = await admin
        .from("companies")
        .select("id, name")
        .in("id", companyIds);
      for (const c of companies ?? []) companyNames[c.id] = c.name;
    }

    const result = (data ?? []).map((b) => ({
      ...b,
      transporter_company: { name: companyNames[b.transporter_company_id] ?? null },
    }));

    return NextResponse.json(result);
  } catch (err) {
    console.error("GET /api/loads/[id]/bids/history error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
