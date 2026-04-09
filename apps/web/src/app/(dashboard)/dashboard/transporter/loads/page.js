import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { formatINR, timeUntil, formatLoadNumber } from "@/lib/format";
import TransporterLoadsFilters from "./TransporterLoadsFilters";
import Pagination from "@/components/ui/Pagination";
import LoadStatusBadge from "@/components/ui/LoadStatusBadge";
import { MapPin } from "lucide-react";

export const metadata = { title: "Load Market" };

const MY_STATUS_CONFIG = {
  "":           { title: "Load Market",    countLabel: "open loads" },
  "bidding":    { title: "My Active Bids", countLabel: "loads with active bids" },
  "won":        { title: "Won Loads",      countLabel: "loads won" },
  "lost":       { title: "Lost Loads",     countLabel: "loads lost" },
  "in_transit": { title: "In Transit",     countLabel: "loads in transit" },
};

export default async function TransporterLoadsPage({ searchParams }) {
  const params = await searchParams;
  const vehicleFilter = params.vehicle  ?? "";
  const originFilter  = params.origin   ?? "";
  const destFilter    = params.dest     ?? "";
  const myStatus      = params.myStatus ?? "";
  const limit = Math.max(1, parseInt(params.limit ?? "10", 10) || 10);
  const page  = Math.max(1, parseInt(params.page  ?? "1",  10) || 1);
  const from  = (page - 1) * limit;
  const to    = from + limit - 1;

  const supabase = await createClient();

  // Dashboard is auth-protected — always safe to fetch the user
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("company_id")
    .eq("id", user.id)
    .single();
  const companyId = profile?.company_id;

  const selectCols = `
    id, load_number, origin_city, dest_city, commodity, opening_price,
    auction_end_time, vehicle_type_req, weight_tonnes, pickup_date, status,
    shipper_company:companies(name),
    load_stops(stop_type, city, state, stop_order)
  `;

  let query;
  if (myStatus === "bidding" && companyId) {
    query = supabase
      .from("loads")
      .select(`${selectCols}, bids!inner(status, transporter_company_id)`, { count: "exact" })
      .eq("bids.transporter_company_id", companyId)
      .eq("bids.status", "active")
      .in("status", ["open", "under_review"])
      .order("auction_end_time", { ascending: true });
  } else if (myStatus === "won" && companyId) {
    query = supabase
      .from("loads")
      .select(`${selectCols}, bids!inner(status, transporter_company_id)`, { count: "exact" })
      .eq("bids.transporter_company_id", companyId)
      .eq("bids.status", "won")
      .order("pickup_date", { ascending: false });
  } else if (myStatus === "lost" && companyId) {
    query = supabase
      .from("loads")
      .select(`${selectCols}, bids!inner(status, transporter_company_id)`, { count: "exact" })
      .eq("bids.transporter_company_id", companyId)
      .eq("bids.status", "lost")
      .order("pickup_date", { ascending: false });
  } else if (myStatus === "in_transit" && companyId) {
    query = supabase
      .from("loads")
      .select(`${selectCols}, trips!inner(transporter_company_id)`, { count: "exact" })
      .eq("trips.transporter_company_id", companyId)
      .eq("status", "in_transit")
      .order("pickup_date", { ascending: true });
  } else {
    // Default: open market
    query = supabase
      .from("loads")
      .select(selectCols, { count: "exact" })
      .eq("status", "open")
      .gt("auction_end_time", new Date().toISOString())
      .order("auction_end_time", { ascending: true });
  }

  if (vehicleFilter) query = query.eq("vehicle_type_req", vehicleFilter);
  if (originFilter)  query = query.ilike("origin_city", `%${originFilter}%`);
  if (destFilter)    query = query.ilike("dest_city", `%${destFilter}%`);
  query = query.range(from, to);

  const { data, count } = await query;
  const loads = data ?? [];
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / limit));

  const cfg = MY_STATUS_CONFIG[myStatus] ?? MY_STATUS_CONFIG[""];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{cfg.title}</h1>
          <p className="text-sm text-slate-500 mt-1">
            {count ?? 0} {cfg.countLabel}{totalPages > 1 && ` — page ${page} of ${totalPages}`}
          </p>
        </div>
      </div>

      {/* Filters */}
      <TransporterLoadsFilters
        vehicleFilter={vehicleFilter}
        originFilter={originFilter}
        destFilter={destFilter}
        myStatus={myStatus}
      />

      {/* Load cards */}
      {loads.length === 0 ? (
        <div className="card py-16 text-center text-slate-400">
          <p className="text-sm">No loads match your filters.</p>
        </div>
      ) : (
        <>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {loads.map((load) => {
            const pickups = (load.load_stops ?? [])
              .filter((s) => s.stop_type === "pickup")
              .sort((a, b) => a.stop_order - b.stop_order);
            const deliveries = (load.load_stops ?? [])
              .filter((s) => s.stop_type === "delivery")
              .sort((a, b) => a.stop_order - b.stop_order);
            const isLiveAuction = load.status === "open" && new Date(load.auction_end_time) > new Date();
            return (
              <Link
                key={load.id}
                href={`/dashboard/transporter/loads/${load.id}`}
                className="card hover:border-brand-400 hover:shadow-md border-2 border-transparent transition-all block"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0 mr-3">
                    <p className="text-xs font-mono text-slate-400 mb-0.5">{formatLoadNumber(load.load_number)}</p>
                    <h3 className="font-semibold text-slate-900">{load.origin_city} → {load.dest_city}</h3>
                    <p className="text-xs text-slate-400 mt-0.5">{load.shipper_company?.name}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <span className="text-lg font-bold text-green-700">{formatINR(load.opening_price)}</span>
                    <LoadStatusBadge status={load.status} />
                  </div>
                </div>

                {/* Pickup and delivery stops */}
                {(pickups.length > 0 || deliveries.length > 0) && (
                  <div className="mb-3 space-y-1">
                    {pickups.length > 0 && (
                      <div className="flex items-start gap-1.5 text-xs">
                        <MapPin size={12} className="text-green-600 mt-0.5 shrink-0" />
                        <span className="font-semibold text-green-700 shrink-0">Pick:</span>
                        <span className="text-slate-600">{pickups.map((s) => s.city).join(" → ")}</span>
                      </div>
                    )}
                    {deliveries.length > 0 && (
                      <div className="flex items-start gap-1.5 text-xs">
                        <MapPin size={12} className="text-red-500 mt-0.5 shrink-0" />
                        <span className="font-semibold text-red-600 shrink-0">Drop:</span>
                        <span className="text-slate-600">{deliveries.map((s) => s.city).join(" → ")}</span>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                  <span className="bg-slate-100 rounded-full px-2 py-0.5">
                    {load.vehicle_type_req?.replace(/_/g, " ")}
                  </span>
                  {load.weight_tonnes && (
                    <span className="bg-slate-100 rounded-full px-2 py-0.5">{load.weight_tonnes} T</span>
                  )}
                  <span className="bg-slate-100 rounded-full px-2 py-0.5">{load.commodity}</span>
                </div>
                <div className="flex items-center justify-between mt-3 text-xs text-slate-400">
                  <span>Pickup: {load.pickup_date ? new Date(load.pickup_date).toLocaleDateString("en-IN", { dateStyle: "medium" }) : "—"}</span>
                  {isLiveAuction && (
                    <span className="font-medium text-brand-600">Closes in {timeUntil(load.auction_end_time)}</span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
        <Pagination page={page} totalPages={totalPages} />
        </>
      )}
    </div>
  );
}
