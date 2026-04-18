import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import LiveAuctionPanel from "@/components/loads/LiveAuctionPanel";
import LoadStopsMap from "@/components/loads/LoadStopsMap";

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

  const [{ data: load }, { data: stops }] = await Promise.all([
    supabase.from("loads").select("*").eq("id", id).single(),
    supabase
      .from("load_stops")
      .select("id, stop_type, stop_order, address, city, state, lat, lng")
      .eq("load_id", id)
      .order("stop_type")
      .order("stop_order"),
  ]);

  if (!load) notFound();

  return (
    <div className="max-w-2xl space-y-6">
      {stops && stops.length > 0 && (
        <div className="card space-y-3">
          <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide border-b border-surface-border pb-2">
            Route
          </h3>
          <LoadStopsMap stops={stops} />
        </div>
      )}
      <LiveAuctionPanel
        load={load}
        userType={profile.user_type}
        companyId={profile.company_id}
      />
    </div>
  );
}
