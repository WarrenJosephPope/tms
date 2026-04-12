import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

const ALLOWED_TYPES = ["shipper", "transporter"];

export async function POST(request) {
  try {
    const body = await request.json();
    const { user_type, full_name, company_name, gstin, city, state, phone } = body;

    if (!ALLOWED_TYPES.includes(user_type)) {
      return NextResponse.json({ error: "Invalid user type" }, { status: 400 });
    }

    if (!full_name?.trim() || !company_name?.trim() || !phone?.trim()) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Validate the caller's JWT from the Authorization header.
    // The client sends "Authorization: Bearer <access_token>" after verifyOtp.
    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    const jwt = authHeader.slice(7);

    // Use admin client to validate the JWT against GoTrue
    const supabase = await createAdminClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser(jwt);
    if (userError || !user) {
      console.error("Register – token validation failed:", userError?.message);
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Prevent re-submission if profile already exists
    const { data: existingProfile } = await supabase
      .from("user_profiles")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();

    if (existingProfile) {
      return NextResponse.json({ error: "Account already registered" }, { status: 409 });
    }

    // Prevent duplicate request
    const { data: existingRequest } = await supabase
      .from("registration_requests")
      .select("id, status")
      .eq("user_id", user.id)
      .maybeSingle();

    if (existingRequest) {
      return NextResponse.json({ error: "Registration request already submitted" }, { status: 409 });
    }

    const { error: requestError } = await supabase
      .from("registration_requests")
      .insert({
        user_id: user.id,
        user_type,
        full_name: full_name.trim(),
        company_name: company_name.trim(),
        gstin: gstin?.trim() || null,
        phone,
        city: city?.trim() || null,
        state: state?.trim() || null,
      });

    if (requestError) {
      console.error("Registration request insert error:", requestError);
      return NextResponse.json({ error: "Failed to submit registration request" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Register API error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
