import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import LiveAuctionPanel from "@/components/loads/LiveAuctionPanel";

export async function generateMetadata({ params }) {
  return { title: `Load Details` };
}

export default async function LoadDetailPage({ params }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("company_id, user_type")
    .eq("id", user.id)
    .single();

  const { data: load } = await supabase
    .from("loads")
    .select("*")
    .eq("id", id)
    .single();

  if (!load) notFound();

  return (
    <div className="max-w-2xl">
      <LiveAuctionPanel
        load={load}
        userType={profile.user_type}
        transporterCompanyId={profile.company_id}
        bidderId={user.id}
      />
    </div>
  );
}
