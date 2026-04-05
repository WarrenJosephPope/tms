import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import TeamManagementPanel from "@/components/layout/TeamManagementPanel";

export const metadata = { title: "Team — Shipper" };

export default async function ShipperTeamPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("shipper_role")
    .eq("id", user.id)
    .single();

  if (profile?.shipper_role !== "account_owner") {
    redirect("/dashboard/shipper");
  }

  return <TeamManagementPanel userType="shipper" />;
}
