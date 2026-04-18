import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import LiveAuctionPanel from "@/components/loads/LiveAuctionPanel";

export const metadata = { title: "Bid on Load" };

export default async function TransporterLoadDetailPage({ params }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("company_id, user_type, transporter_role")
    .eq("id", user.id)
    .single();

  const [{ data: load }, { data: stops }] = await Promise.all([
    supabase.from("loads").select("*").eq("id", id).single(),
    supabase
      .from("load_stops")
      .select("id, stop_type, stop_order, address, city, state, pincode")
      .eq("load_id", id)
      .order("stop_order", { ascending: true }),
  ]);

  if (!load) notFound();

  return (
    <div className="max-w-2xl">
      <LiveAuctionPanel
        load={load}
        stops={stops ?? []}
        userType={profile.user_type}
        companyId={profile.company_id}
      />
    </div>
  );
}
