import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

const VALID_MODULES = ["bidding", "tracking"];

/**
 * GET /api/admin/companies/[id]/modules
 * Returns the company's current modules array.
 */
export async function GET(_req, { params }) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("user_type")
      .eq("id", user.id)
      .single();

    if (!profile || profile.user_type !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const admin = await createAdminClient();
    const { data: company, error } = await admin
      .from("companies")
      .select("id, modules")
      .eq("id", id)
      .single();

    if (error || !company) return NextResponse.json({ error: "Company not found" }, { status: 404 });

    return NextResponse.json({ modules: company.modules ?? ["bidding", "tracking"] });
  } catch (err) {
    console.error("GET /api/admin/companies/[id]/modules", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * PUT /api/admin/companies/[id]/modules
 * Body: { modules: string[] }  — must be subset of VALID_MODULES
 */
export async function PUT(request, { params }) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("user_type")
      .eq("id", user.id)
      .single();

    if (!profile || profile.user_type !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { modules } = body;

    if (!Array.isArray(modules)) {
      return NextResponse.json({ error: "modules must be an array" }, { status: 400 });
    }

    const invalid = modules.filter((m) => !VALID_MODULES.includes(m));
    if (invalid.length > 0) {
      return NextResponse.json({ error: `Invalid modules: ${invalid.join(", ")}` }, { status: 400 });
    }

    const admin = await createAdminClient();
    const { error: updateError } = await admin
      .from("companies")
      .update({ modules })
      .eq("id", id);

    if (updateError) throw updateError;

    return NextResponse.json({ success: true, modules });
  } catch (err) {
    console.error("PUT /api/admin/companies/[id]/modules", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
