import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import TeamManagementPanel from "@/components/layout/TeamManagementPanel";

export const metadata = { title: "Team — Transporter" };

export default async function TransporterTeamPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("transporter_role")
    .eq("id", user.id)
    .single();

  if (profile?.transporter_role !== "account_owner") {
    redirect("/dashboard/transporter");
  }

  return <TeamManagementPanel userType="transporter" />;
}
