import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

const VALID_TRANSITIONS = {
  assigned:   ["in_transit"],
  in_transit: ["delivered"],
};

/**
 * POST /api/trips/[id]/status
 * Transporters update trip status (assigned → in_transit → delivered).
 */
export async function POST(request, { params }) {
  try {
    const { id: tripId } = await params;
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("user_type, company_id, transporter_role")
      .eq("id", user.id)
      .single();

    if (!profile || profile.user_type !== "transporter") {
      return NextResponse.json({ error: "Only transporters can update trip status" }, { status: 403 });
    }

    const body = await request.json();
    const { status: newStatus } = body;

    if (!newStatus) return NextResponse.json({ error: "status is required" }, { status: 400 });

    // Fetch current trip
    const { data: trip } = await supabase
      .from("trips")
      .select("id, status, transporter_company_id")
      .eq("id", tripId)
      .single();

    if (!trip) return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    if (trip.transporter_company_id !== profile.company_id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const allowed = VALID_TRANSITIONS[trip.status] ?? [];
    if (!allowed.includes(newStatus)) {
      return NextResponse.json(
        { error: `Cannot transition from ${trip.status} to ${newStatus}` },
        { status: 422 }
      );
    }

    const admin = await createAdminClient();
    const { error: updateError } = await admin
      .from("trips")
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq("id", tripId);

    if (updateError) throw updateError;

    return NextResponse.json({ success: true, status: newStatus });
  } catch (err) {
    console.error("POST /api/trips/[id]/status", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
