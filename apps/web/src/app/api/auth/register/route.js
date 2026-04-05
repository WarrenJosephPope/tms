import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

const ALLOWED_TYPES = ["shipper", "transporter"];

export async function POST(request) {
  try {
    const body = await request.json();
    const { user_type, full_name, company_name, gstin, city, state, phone } = body;

    // Validate user_type
    if (!ALLOWED_TYPES.includes(user_type)) {
      return NextResponse.json({ error: "Invalid user type" }, { status: 400 });
    }

    if (!full_name?.trim() || !company_name?.trim() || !phone?.trim()) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const supabase = await createAdminClient();

    // Get the authenticated user from the session cookie
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Prevent duplicate registration
    const { data: existingProfile } = await supabase
      .from("user_profiles")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();

    if (existingProfile) {
      return NextResponse.json({ error: "Account already registered" }, { status: 409 });
    }

    // Create company
    const { data: company, error: companyError } = await supabase
      .from("companies")
      .insert({
        name: company_name.trim(),
        user_type,
        gstin: gstin?.trim() || null,
        phone,
        city: city?.trim() || null,
        state: state?.trim() || null,
        kyc_status: "pending",
      })
      .select()
      .single();

    if (companyError) {
      console.error("Company insert error:", companyError);
      return NextResponse.json({ error: "Failed to create company" }, { status: 500 });
    }

    // Determine default role
    const roleField = user_type === "shipper" ? "shipper_role" : "transporter_role";
    const defaultRole = "account_owner";

    // Create user profile
    const { error: profileError } = await supabase
      .from("user_profiles")
      .insert({
        id: user.id,
        company_id: company.id,
        full_name: full_name.trim(),
        phone,
        user_type,
        [roleField]: defaultRole,
      });

    if (profileError) {
      console.error("Profile insert error:", profileError);
      // Roll back company (best effort)
      await supabase.from("companies").delete().eq("id", company.id);
      return NextResponse.json({ error: "Failed to create user profile" }, { status: 500 });
    }

    return NextResponse.json({ success: true, company_id: company.id });
  } catch (err) {
    console.error("Register API error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
