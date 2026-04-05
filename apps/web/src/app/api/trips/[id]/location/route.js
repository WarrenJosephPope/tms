import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

/**
 * POST /api/trips/[id]/location
 * Called by the driver app to push a location ping.
 * Accepts: { latitude, longitude, speed_kmph, accuracy_m, heading_deg, tracking_mode }
 */
export async function POST(request, { params }) {
  try {
    const { id: tripId } = await params;
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("user_type, transporter_role")
      .eq("id", user.id)
      .single();

    if (!profile || profile.user_type !== "transporter" || profile.transporter_role !== "driver") {
      return NextResponse.json({ error: "Only drivers can push location pings" }, { status: 403 });
    }

    const body = await request.json();
    const { latitude, longitude, speed_kmph, accuracy_m, heading_deg, altitude_m, tracking_mode, is_moving } = body;

    if (latitude === undefined || longitude === undefined) {
      return NextResponse.json({ error: "latitude and longitude are required" }, { status: 400 });
    }

    if (Math.abs(Number(latitude)) > 90 || Math.abs(Number(longitude)) > 180) {
      return NextResponse.json({ error: "Invalid coordinates" }, { status: 400 });
    }

    // Verify trip is active and belongs to this driver
    const { data: driver } = await supabase
      .from("drivers")
      .select("id")
      .eq("user_profile_id", user.id)
      .single();

    const { data: trip } = await supabase
      .from("trips")
      .select("id, status")
      .eq("id", tripId)
      .eq("driver_id", driver?.id)
      .single();

    if (!trip) return NextResponse.json({ error: "Trip not found or not assigned to you" }, { status: 404 });
    if (trip.status !== "in_transit") return NextResponse.json({ error: "Trip is not in transit" }, { status: 422 });

    const admin = await createAdminClient();
    const { error: pingError } = await admin.from("location_pings").insert({
      trip_id:       tripId,
      driver_id:     driver.id,
      tracking_mode: tracking_mode ?? "GPS_APP",
      latitude:      Number(latitude),
      longitude:     Number(longitude),
      speed_kmph:    speed_kmph != null ? Number(speed_kmph) : null,
      accuracy_m:    accuracy_m != null ? Number(accuracy_m) : null,
      heading_deg:   heading_deg != null ? Number(heading_deg) : null,
      altitude_m:    altitude_m != null ? Number(altitude_m) : null,
      is_moving:     is_moving ?? null,
    });

    if (pingError) {
      console.error("Location ping insert error:", pingError);
      return NextResponse.json({ error: "Failed to save location" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("POST /api/trips/[id]/location error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
