import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { broadcastAll } from "@/lib/supabase/broadcast";

// ─── helpers ──────────────────────────────────────────────────────────────────

/**
 * Given the raw active-bids rows (sorted ascending by amount, one per company),
 * returns an array of { transporter_company_id, amount, position, total_bids }.
 */
function computeRankedPositions(sortedBids) {
  const total = sortedBids.length;
  return sortedBids.map((b, idx) => ({
    transporter_company_id: b.transporter_company_id,
    amount: b.amount,
    bid_position: idx + 1,
    total_bids: total,
  }));
}

/**
 * Keeps only the lowest bid per company and sorts ascending.
 */
function lowestPerCompany(bids) {
  const map = {};
  for (const b of bids) {
    if (!map[b.transporter_company_id] || b.amount < map[b.transporter_company_id].amount) {
      map[b.transporter_company_id] = b;
    }
  }
  return Object.values(map).sort((a, b) => a.amount - b.amount);
}

// ─── POST — place a bid ────────────────────────────────────────────────────────

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

    const admin = await createAdminClient();
    const companyId = profile.company_id;
    const numericAmount = Number(amount);

    // ── Write to DB ──────────────────────────────────────────────────────────
    // The submitting client already applied a client-side optimistic update;
    // we go straight to the DB write with no pre-read.
    const { data: bid, error: bidError } = await admin.rpc("place_bid_atomic", {
      p_load_id:                loadId,
      p_transporter_company_id: companyId,
      p_bidder_id:              user.id,
      p_amount:                 numericAmount,
      p_eta_days:               eta_days ? Number(eta_days) : null,
      p_notes:                  notes?.trim() || null,
    });

    if (bidError) {
      // 422 signals the client to revert its optimistic state via fetchPosition()
      return NextResponse.json({ error: bidError.message }, { status: 422 });
    }

    // Return immediately — don't make the client wait for the broadcast work.
    // Fire the post-write queries and broadcasts as a detached async task.
    Promise.resolve().then(async () => {
      const [{ data: confirmedBids }, { data: loadData }] = await Promise.all([
        admin
          .from("bids")
          .select("id, transporter_company_id, amount, eta_days, notes, status, created_at, updated_at")
          .eq("load_id", loadId)
          .eq("status", "active")
          .order("amount", { ascending: true }),
        admin.from("loads").select("bid_start_time").eq("id", loadId).single(),
      ]);

      const isBlindPhase =
        loadData?.bid_start_time && new Date() < new Date(loadData.bid_start_time);

      const confirmedRanked = lowestPerCompany(confirmedBids ?? []);
      const confirmedPositions = computeRankedPositions(confirmedRanked);
      const seq = Date.now();

      const messages = confirmedPositions.map((pos) => ({
        channel: `auction-tp:${loadId}:${pos.transporter_company_id}`,
        event: "bid_update",
        payload: { seq, ...pos },
      }));

      if (isBlindPhase) {
        messages.push({
          channel: `auction-sh:${loadId}`,
          event: "blind_count_update",
          payload: { seq, count: confirmedRanked.length },
        });
      } else {
        const companyIds = confirmedRanked
          .map((b) => b.transporter_company_id)
          .filter(Boolean);
        let companyNames = {};
        if (companyIds.length > 0) {
          const { data: companies } = await admin
            .from("companies")
            .select("id, name")
            .in("id", companyIds);
          for (const c of companies ?? []) companyNames[c.id] = c.name;
        }
        messages.push({
          channel: `auction-sh:${loadId}`,
          event: "bids_list_update",
          payload: {
            seq,
            bids: confirmedRanked.map((b, idx) => ({
              ...b,
              bid_position: idx + 1,
              total_bids: confirmedRanked.length,
              transporter_company: { name: companyNames[b.transporter_company_id] ?? null },
            })),
          },
        });
      }

      broadcastAll(messages);
    }).catch(() => {});

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
