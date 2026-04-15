import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Package, Gavel, Truck, TrendingUp } from "lucide-react";
import StatCard from "@/components/ui/StatCard";
import LoadStatusBadge from "@/components/ui/LoadStatusBadge";
import { formatINR } from "@/lib/format";
import { profileHasModule, MODULES } from "@/lib/modules";

export const metadata = { title: "Transporter Dashboard" };

export default async function TransporterDashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("company_id, company:companies(modules)")
    .eq("id", user.id)
    .single();

  const hasBidding  = profileHasModule(profile, MODULES.BIDDING);
  const hasTracking = profileHasModule(profile, MODULES.TRACKING);

  const [openLoadsResult, myBidsResult, activeTripsResult] = await Promise.all([
    hasBidding
      ? supabase
          .from("loads")
          .select("id, origin_city, dest_city, opening_price, auction_end_time, vehicle_type_req, weight_tonnes")
          .eq("status", "open")
          .order("auction_end_time", { ascending: true })
          .limit(5)
      : Promise.resolve({ data: [] }),
    hasBidding
      ? supabase
          .from("bids")
          .select("id, amount, status, load:loads(origin_city, dest_city, status)")
          .eq("transporter_company_id", profile.company_id)
          .order("created_at", { ascending: false })
          .limit(5)
      : Promise.resolve({ data: [] }),
    hasTracking
      ? supabase
          .from("trips")
          .select("id, load:loads(origin_city, dest_city)")
          .eq("transporter_company_id", profile.company_id)
          .eq("status", "in_transit")
      : Promise.resolve({ data: [] }),
  ]);

  const openLoads  = openLoadsResult.data ?? [];
  const myBids     = myBidsResult.data ?? [];
  const activeTrips = activeTripsResult.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Transporter Dashboard</h1>
        {hasBidding && (
          <Link href="/dashboard/transporter/loads" className="btn-primary">
            Browse Loads
          </Link>
        )}
      </div>

      {/* Stats per module */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {hasBidding && (
          <>
            <StatCard label="Open Loads" value={openLoads.length} icon={<Package size={20} />} />
            <StatCard label="My Active Bids" value={myBids.filter(b => b.status === "active").length} icon={<Gavel size={20} />} color="brand" />
            <StatCard label="Loads Won" value={myBids.filter(b => b.status === "won").length} icon={<TrendingUp size={20} />} color="emerald" />
          </>
        )}
        {hasTracking && (
          <StatCard label="Active Trips" value={activeTrips.length} icon={<Truck size={20} />} color="green" />
        )}
      </div>

      {/* Open loads — bidding module */}
      {hasBidding && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-900">Latest Open Loads</h2>
            <Link href="/dashboard/transporter/loads" className="text-sm text-brand-600 hover:underline">View all →</Link>
          </div>
          {openLoads.length === 0 ? (
            <p className="text-sm text-slate-400 py-6 text-center">No open loads at the moment.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-surface-border text-left text-slate-500">
                    <th className="pb-3 pr-4 font-medium">Route</th>
                    <th className="pb-3 pr-4 font-medium">Opening Price</th>
                    <th className="pb-3 pr-4 font-medium">Vehicle</th>
                    <th className="pb-3 font-medium">Closes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border">
                  {openLoads.map((load) => (
                    <tr key={load.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 pr-4">
                        <Link href={`/dashboard/transporter/loads/${load.id}`} className="font-medium text-slate-900 hover:text-brand-600">
                          {load.origin_city} → {load.dest_city}
                        </Link>
                      </td>
                      <td className="py-3 pr-4 font-semibold text-green-700">{formatINR(load.opening_price)}</td>
                      <td className="py-3 pr-4 text-slate-500 capitalize">{load.vehicle_type_req?.replace(/_/g, " ")}</td>
                      <td className="py-3 text-slate-500 text-xs">
                        {load.auction_end_time
                          ? new Date(load.auction_end_time).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* My recent bids — bidding module */}
      {hasBidding && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-900">My Recent Bids</h2>
            <Link href="/dashboard/transporter/bids" className="text-sm text-brand-600 hover:underline">View all →</Link>
          </div>
          {myBids.length === 0 ? (
            <p className="text-sm text-slate-400 py-6 text-center">No bids placed yet.</p>
          ) : (
            <div className="space-y-2">
              {myBids.map((bid) => (
                <div key={bid.id} className="flex items-center justify-between p-3 rounded-lg border border-surface-border">
                  <span className="text-sm font-medium text-slate-900">
                    {bid.load?.origin_city} → {bid.load?.dest_city}
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-slate-700">{formatINR(bid.amount)}</span>
                    <LoadStatusBadge status={bid.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Active trips — tracking module */}
      {hasTracking && activeTrips.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-900">Active Trips</h2>
            <Link href="/dashboard/transporter/tracking" className="text-sm text-brand-600 hover:underline">Manage all →</Link>
          </div>
          <div className="space-y-2">
            {activeTrips.map((trip) => (
              <Link
                key={trip.id}
                href={`/dashboard/transporter/tracking/${trip.id}`}
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
