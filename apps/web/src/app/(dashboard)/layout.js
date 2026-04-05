import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Sidebar from "@/components/layout/Sidebar";
import TopBar from "@/components/layout/TopBar";

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
    <div className="flex h-screen overflow-hidden bg-surface-muted">
      <Sidebar profile={profile} />
      <div className="flex flex-col flex-1 overflow-hidden">
        <TopBar profile={profile} />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
