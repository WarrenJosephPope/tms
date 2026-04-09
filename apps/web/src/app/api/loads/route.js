import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

export async function POST(request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Get user profile to confirm they are a shipper with posting rights
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("company_id, user_type, shipper_role")
      .eq("id", user.id)
      .single();

    if (!profile || profile.user_type !== "shipper") {
      return NextResponse.json({ error: "Only shippers can post loads" }, { status: 403 });
    }
    if (!["account_owner", "operations_manager"].includes(profile.shipper_role)) {
      return NextResponse.json({ error: "Insufficient role to post loads" }, { status: 403 });
    }

    const body = await request.json();
    const {
      commodity, weight_tonnes, vehicle_type_req,
      origin_address, origin_city, origin_state, origin_pincode,
      dest_address, dest_city, dest_state, dest_pincode,
      pickup_date, pickup_window_start, pickup_window_end,
      opening_price,
      auction_duration_minutes, // replaces auction_duration_hours
      sealed_phase_minutes,     // minutes of sealed bidding before open phase (0 = none)
      extension_trigger_minutes, extension_add_minutes, extension_max_count,
      auto_accept_lowest,
      notes, special_instructions,
      stops, // Array<{ address, city, state, pincode, lat, lng, stop_type, stop_order }>
      branch_id,
    } = body;

    // Input validation
    if (!commodity?.trim()) return NextResponse.json({ error: "Commodity is required" }, { status: 400 });
    if (!origin_city?.trim() || !dest_city?.trim()) return NextResponse.json({ error: "Origin and destination cities are required" }, { status: 400 });
    if (!pickup_date) return NextResponse.json({ error: "Pickup date is required" }, { status: 400 });
    if (!opening_price || Number(opening_price) <= 0) return NextResponse.json({ error: "Opening price must be positive" }, { status: 400 });

    const durationMs   = Number(auction_duration_minutes ?? 15) * 60_000;
    const auctionEndTime = new Date(Date.now() + durationMs).toISOString();

    const sealedMs    = Number(sealed_phase_minutes ?? 0) * 60_000;
    const bidStartTime = sealedMs > 0 ? new Date(Date.now() + sealedMs).toISOString() : null;

    const admin = await createAdminClient();
    const { data: load, error: insertError } = await admin
      .from("loads")
      .insert({
        shipper_company_id: profile.company_id,
        posted_by: user.id,
        commodity: commodity.trim(),
        weight_tonnes: weight_tonnes ? Number(weight_tonnes) : null,
        vehicle_type_req,
        origin_address: origin_address?.trim(),
        origin_city: origin_city.trim(),
        origin_state: origin_state?.trim(),
        origin_pincode: origin_pincode?.trim() || null,
        dest_address: dest_address?.trim(),
        dest_city: dest_city.trim(),
        dest_state: dest_state?.trim(),
        dest_pincode: dest_pincode?.trim() || null,
        pickup_date,
        pickup_window_start: pickup_window_start || null,
        pickup_window_end: pickup_window_end || null,
        opening_price: Number(opening_price),
        auction_end_time: auctionEndTime,
        bid_start_time: bidStartTime,
        extension_trigger_minutes: Number(extension_trigger_minutes) > 0 ? Number(extension_trigger_minutes) : null,
        extension_add_minutes:     Number(extension_add_minutes)     > 0 ? Number(extension_add_minutes)     : null,
        extension_max_count:       Number(extension_max_count)       || 0,
        extension_count:           0,
        auto_accept_lowest: Boolean(auto_accept_lowest),
        branch_id: branch_id || null,
        notes: notes?.trim() || null,
        special_instructions: special_instructions?.trim() || null,
        status: "open",
      })
      .select()
      .single();

    if (insertError) {
      console.error("Load insert error:", insertError);
      return NextResponse.json({ error: "Failed to create load" }, { status: 500 });
    }

    // Insert stops if provided
    if (Array.isArray(stops) && stops.length > 0) {
      const stopRows = stops.map((s) => ({
        load_id:    load.id,
        stop_type:  s.stop_type,
        stop_order: Number(s.stop_order ?? 0),
        address:    s.address?.trim() ?? "",
        city:       s.city?.trim() ?? "",
        state:      s.state?.trim() || null,
        pincode:    s.pincode?.trim() || null,
        lat:        s.lat != null ? Number(s.lat) : null,
        lng:        s.lng != null ? Number(s.lng) : null,
      }));

      const { error: stopsError } = await admin.from("load_stops").insert(stopRows);
      if (stopsError) {
        console.error("load_stops insert error:", stopsError);
        // Non-fatal: load was created, just log the error
      }
    }

    return NextResponse.json(load, { status: 201 });
  } catch (err) {
    console.error("POST /api/loads error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET(request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    let query = supabase
      .from("loads")
      .select("id, origin_city, dest_city, opening_price, status, auction_end_time, vehicle_type_req, weight_tonnes, pickup_date")
      .order("created_at", { ascending: false });

    if (status) query = query.eq("status", status);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
