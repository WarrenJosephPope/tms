import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Package, Gavel, MapPin, TrendingDown } from "lucide-react";
import StatCard from "@/components/ui/StatCard";
import LoadStatusBadge from "@/components/ui/LoadStatusBadge";
import { formatINR } from "@/lib/format";

export const metadata = { title: "Shipper Dashboard" };

export default async function ShipperDashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("company_id")
    .eq("id", user.id)
    .single();

  // Fetch summary data in parallel
  const [loadsResult, activeTripsResult, openAuctionsResult] = await Promise.all([
    supabase
      .from("loads")
      .select("id, status, origin_city, dest_city, opening_price, auction_end_time, created_at")
      .eq("shipper_company_id", profile.company_id)
      .order("created_at", { ascending: false })
      .limit(6),
    supabase
      .from("trips")
      .select("id, status, load:loads(origin_city, dest_city)")
      .eq("shipper_company_id", profile.company_id)
      .eq("status", "in_transit"),
    supabase
      .from("loads")
      .select("id", { count: "exact", head: true })
      .eq("shipper_company_id", profile.company_id)
      .eq("status", "open"),
  ]);

  const recentLoads = loadsResult.data ?? [];
  const activeTrips = activeTripsResult.data ?? [];
  const openCount = openAuctionsResult.count ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Shipper Dashboard</h1>
        <Link href="/dashboard/shipper/loads/new" className="btn-primary">
          + Post Load
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Loads" value={recentLoads.length} icon={<Package size={20} />} />
        <StatCard label="Live Auctions" value={openCount} icon={<Gavel size={20} />} color="brand" />
        <StatCard label="Active Trips" value={activeTrips.length} icon={<MapPin size={20} />} color="green" />
        <StatCard label="Avg Saving" value="—" icon={<TrendingDown size={20} />} color="emerald" />
      </div>

      {/* Recent loads table */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-slate-900">Recent Loads</h2>
          <Link href="/dashboard/shipper/loads" className="text-sm text-brand-600 hover:underline">View all →</Link>
        </div>

        {recentLoads.length === 0 ? (
          <div className="text-center py-10 text-slate-400">
            <Package size={40} className="mx-auto mb-3 opacity-40" />
            <p className="text-sm">No loads posted yet.</p>
            <Link href="/dashboard/shipper/loads/new" className="btn-primary mt-4 inline-flex">Post your first load</Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-border text-left text-slate-500">
                  <th className="pb-3 pr-4 font-medium">Route</th>
                  <th className="pb-3 pr-4 font-medium">Opening Price</th>
                  <th className="pb-3 pr-4 font-medium">Auction Ends</th>
                  <th className="pb-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border">
                {recentLoads.map((load) => (
                  <tr key={load.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 pr-4">
                      <Link href={`/dashboard/shipper/loads/${load.id}`} className="font-medium text-slate-900 hover:text-brand-600">
                        {load.origin_city} → {load.dest_city}
                      </Link>
                    </td>
                    <td className="py-3 pr-4 text-slate-600">{formatINR(load.opening_price)}</td>
                    <td className="py-3 pr-4 text-slate-500 text-xs">
                      {load.auction_end_time
                        ? new Date(load.auction_end_time).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })
                        : "—"}
                    </td>
                    <td className="py-3"><LoadStatusBadge status={load.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Active Trips */}
      {activeTrips.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-900">Active Trips</h2>
            <Link href="/dashboard/shipper/tracking" className="text-sm text-brand-600 hover:underline">Track all →</Link>
          </div>
          <div className="space-y-2">
            {activeTrips.map((trip) => (
              <Link
                key={trip.id}
                href={`/dashboard/shipper/tracking/${trip.id}`}
                className="flex items-center justify-between p-3 rounded-lg border border-surface-border hover:border-brand-300 hover:bg-brand-50/30 transition-colors"
              >
                <span className="text-sm font-medium text-slate-900">
                  {trip.load?.origin_city} → {trip.load?.dest_city}
                </span>
                <LoadStatusBadge status="in_transit" />
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
