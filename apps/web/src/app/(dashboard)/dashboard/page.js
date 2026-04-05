import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function DashboardRedirectPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("user_type")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/register");

  // Route to the right home dashboard based on user type
  if (profile.user_type === "shipper")     redirect("/dashboard/shipper");
  if (profile.user_type === "transporter") redirect("/dashboard/transporter");
  if (profile.user_type === "admin")       redirect("/dashboard/admin");

  redirect("/login");
}
