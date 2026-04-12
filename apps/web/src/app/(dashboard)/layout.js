import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import DashboardShell from "@/components/layout/DashboardShell";
import GoogleMapsScript from "@/components/layout/GoogleMapsScript";

export default async function DashboardLayout({ children }) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("*, company:companies(*)")
    .eq("id", user.id)
    .single();

  if (!profile) {
    // Check if the user has submitted a registration request
    const { data: regRequest } = await supabase
      .from("registration_requests")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (regRequest) redirect("/register/pending");
    redirect("/register");
  }

  return (
    <>
      <GoogleMapsScript />
      <DashboardShell profile={profile}>
        {children}
      </DashboardShell>
    </>
  );
}
