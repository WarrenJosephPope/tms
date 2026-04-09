import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

const HARDCODED_DEFAULTS = {
  auction_duration_minutes:  15,
  sealed_phase_minutes:       0,
  extension_trigger_minutes:  3,
  extension_add_minutes:      5,
  extension_max_count:        3,
};

const SETTINGS_COLS = "auction_duration_minutes, sealed_phase_minutes, extension_trigger_minutes, extension_add_minutes, extension_max_count";

/**
 * GET /api/company/auction-settings[?branch_id=<uuid>]
 *
 * Lookup chain: branch_auction_settings → company_auction_settings → HARDCODED_DEFAULTS.
 * If branch_id is not provided, only the company and hardcoded fallback are checked.
 */
export async function GET(request) {
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

    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get("branch_id");

    // 1. Try branch-level settings
    if (branchId) {
      const { data: branchSettings } = await supabase
        .from("branch_auction_settings")
        .select(SETTINGS_COLS)
        .eq("branch_id", branchId)
        .single();
      if (branchSettings) return NextResponse.json(branchSettings);
    }

    // 2. Try company-level settings
    const { data: companySettings } = await supabase
      .from("company_auction_settings")
      .select(SETTINGS_COLS)
      .eq("company_id", profile.company_id)
      .single();

    return NextResponse.json(companySettings ?? HARDCODED_DEFAULTS);
  } catch (err) {
    console.error("GET /api/company/auction-settings error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * PUT /api/company/auction-settings[?branch_id=<uuid>]
 *
 * Upserts auction defaults. If branch_id is provided, writes to branch_auction_settings;
 * otherwise writes to company_auction_settings. Restricted to account_owner.
 */
export async function PUT(request) {
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
      return NextResponse.json({ error: "Only account owners can update company auction settings" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get("branch_id");

    const body = await request.json();
    const {
      auction_duration_minutes,
      sealed_phase_minutes,
      extension_trigger_minutes,
      extension_add_minutes,
      extension_max_count,
    } = body;

    // Basic validation
    if (Number(auction_duration_minutes) < 1) {
      return NextResponse.json({ error: "Auction duration must be at least 1 minute" }, { status: 400 });
    }
    if (Number(sealed_phase_minutes) >= Number(auction_duration_minutes)) {
      return NextResponse.json({ error: "Sealed phase must be shorter than the auction duration" }, { status: 400 });
    }

    const settingsPayload = {
      auction_duration_minutes:  Number(auction_duration_minutes),
      sealed_phase_minutes:      Number(sealed_phase_minutes ?? 0),
      extension_trigger_minutes: Number(extension_trigger_minutes ?? 3),
      extension_add_minutes:     Number(extension_add_minutes ?? 5),
      extension_max_count:       Number(extension_max_count ?? 3),
    };

    // Use admin client to bypass RLS on upsert
    const admin = await createAdminClient();

    let data, error;
    if (branchId) {
      ({ data, error } = await admin
        .from("branch_auction_settings")
        .upsert({ branch_id: branchId, ...settingsPayload })
        .select()
        .single());
    } else {
      ({ data, error } = await admin
        .from("company_auction_settings")
        .upsert({ company_id: profile.company_id, ...settingsPayload })
        .select()
        .single());
    }

    if (error) {
      console.error("company_auction_settings upsert error:", error);
      return NextResponse.json({ error: "Failed to save settings" }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error("PUT /api/company/auction-settings error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
