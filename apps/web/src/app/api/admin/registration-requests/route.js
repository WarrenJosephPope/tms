import { NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";

/**
 * GET /api/admin/registration-requests
 * Returns all registration requests (admin only).
 * Sorted by created_at ascending so oldest pending ones are first.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("user_type, admin_role")
      .eq("id", user.id)
      .single();

    if (!profile || profile.user_type !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const admin = await createAdminClient();
    const { data: requests, error } = await admin
      .from("registration_requests")
      .select("*")
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Fetch registration requests error:", error);
      return NextResponse.json({ error: "Failed to fetch requests" }, { status: 500 });
    }

    return NextResponse.json({ requests });
  } catch (err) {
    console.error("GET /api/admin/registration-requests error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/admin/registration-requests
 * Body: { id, action: "approve" | "reject", review_notes? }
 *
 * approve — creates the company + user_profile, marks request approved.
 * reject  — marks request rejected with optional notes.
 */
export async function POST(request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("user_type, admin_role")
      .eq("id", user.id)
      .single();

    if (!profile || profile.user_type !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { id, action, review_notes } = body;

    if (!id || !["approve", "reject"].includes(action)) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const admin = await createAdminClient();

    // Fetch the registration request
    const { data: regRequest, error: fetchError } = await admin
      .from("registration_requests")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !regRequest) {
      return NextResponse.json({ error: "Registration request not found" }, { status: 404 });
    }

    if (regRequest.status !== "pending") {
      return NextResponse.json({ error: "Request has already been reviewed" }, { status: 409 });
    }

    if (action === "reject") {
      // Atomically claim the request: only succeeds if status is still "pending"
      const { data: claimed, error: claimError } = await admin
        .from("registration_requests")
        .update({
          status: "rejected",
          reviewed_by: user.id,
          review_notes: review_notes?.trim() || null,
        })
        .eq("id", id)
        .eq("status", "pending")
        .select("id")
        .maybeSingle();

      if (claimError) {
        console.error("Reject request error:", claimError);
        return NextResponse.json({ error: "Failed to reject request" }, { status: 500 });
      }
      if (!claimed) {
        return NextResponse.json({ error: "Request has already been reviewed" }, { status: 409 });
      }

      return NextResponse.json({ success: true });
    }

    // action === "approve"
    // 1. Atomically claim the request by updating status first.
    //    Using .eq("status", "pending") as an atomic guard ensures that even if two
    //    requests arrive simultaneously, only one will succeed here — the second
    //    will get 0 rows back (Postgres row-level locking) and return 409.
    const { data: claimed, error: claimError } = await admin
      .from("registration_requests")
      .update({
        status: "approved",
        reviewed_by: user.id,
        review_notes: review_notes?.trim() || null,
      })
      .eq("id", id)
      .eq("status", "pending")
      .select("*")
      .maybeSingle();

    if (claimError) {
      console.error("Claim request error:", claimError);
      return NextResponse.json({ error: "Failed to approve request" }, { status: 500 });
    }
    if (!claimed) {
      // Another request already processed this — no company was created yet
      return NextResponse.json({ error: "Request has already been reviewed" }, { status: 409 });
    }

    // 2. Create company
    const { data: company, error: companyError } = await admin
      .from("companies")
      .insert({
        name: claimed.company_name,
        user_type: claimed.user_type,
        gstin: claimed.gstin || null,
        phone: claimed.phone,
        city: claimed.city || null,
        state: claimed.state || null,
        kyc_status: "pending",
      })
      .select()
      .single();

    if (companyError) {
      console.error("Company insert error:", companyError);
      // Rollback the status claim so the admin can retry
      await admin
        .from("registration_requests")
        .update({ status: "pending", reviewed_by: null, review_notes: null })
        .eq("id", id);
      return NextResponse.json({ error: "Failed to create company" }, { status: 500 });
    }

    // 3. Create user profile
    const roleField = claimed.user_type === "shipper" ? "shipper_role" : "transporter_role";

    const { error: profileError } = await admin
      .from("user_profiles")
      .insert({
        id: claimed.user_id,
        company_id: company.id,
        full_name: claimed.full_name,
        phone: claimed.phone,
        user_type: claimed.user_type,
        [roleField]: "account_owner",
      });

    if (profileError) {
      console.error("Profile insert error:", profileError);
      // Rollback company and status claim
      await admin.from("companies").delete().eq("id", company.id);
      await admin
        .from("registration_requests")
        .update({ status: "pending", reviewed_by: null, review_notes: null })
        .eq("id", id);
      return NextResponse.json({ error: "Failed to create user profile" }, { status: 500 });
    }

    return NextResponse.json({ success: true, company_id: company.id });
  } catch (err) {
    console.error("POST /api/admin/registration-requests error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
