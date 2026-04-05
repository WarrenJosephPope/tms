import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { formatINR, timeUntil } from "@/lib/format";
import TransporterLoadsFilters from "./TransporterLoadsFilters";
import Pagination from "@/components/ui/Pagination";

export const metadata = { title: "Load Market" };

export default async function TransporterLoadsPage({ searchParams }) {
  const params = await searchParams;
  const vehicleFilter = params.vehicle ?? "";
  const originFilter  = params.origin  ?? "";
  const destFilter    = params.dest    ?? "";
  const limit = Math.max(1, parseInt(params.limit ?? "10", 10) || 10);
  const page  = Math.max(1, parseInt(params.page  ?? "1",  10) || 1);
  const from  = (page - 1) * limit;
  const to    = from + limit - 1;

  const supabase = await createClient();

  let query = supabase
    .from("loads")
    .select(`
      id, origin_city, dest_city, commodity, opening_price,
      auction_end_time, vehicle_type_req, weight_tonnes, pickup_date,
      shipper_company:companies(name)
    `, { count: "exact" })
    .eq("status", "open")
    .gt("auction_end_time", new Date().toISOString())
    .order("auction_end_time", { ascending: true })
    .range(from, to);

  if (vehicleFilter) query = query.eq("vehicle_type_req", vehicleFilter);
  if (originFilter)  query = query.ilike("origin_city", `%${originFilter}%`);
  if (destFilter)    query = query.ilike("dest_city", `%${destFilter}%`);

  const { data: loads = [], count } = await query;
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / limit));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Load Market</h1>
          <p className="text-sm text-slate-500 mt-1">
            {count ?? 0} open loads{totalPages > 1 && ` — page ${page} of ${totalPages}`}
          </p>
        </div>
      </div>

      {/* Filters */}
      <TransporterLoadsFilters
        vehicleFilter={vehicleFilter}
        originFilter={originFilter}
        destFilter={destFilter}
      />

      {/* Load cards */}
      {loads.length === 0 ? (
        <div className="card py-16 text-center text-slate-400">
          <p className="text-sm">No open loads match your filters.</p>
        </div>
      ) : (
        <>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {loads.map((load) => (
            <Link
              key={load.id}
              href={`/dashboard/transporter/loads/${load.id}`}
              className="card hover:border-brand-400 hover:shadow-md border-2 border-transparent transition-all block"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-slate-900">{load.origin_city} → {load.dest_city}</h3>
                  <p className="text-xs text-slate-400 mt-0.5">{load.shipper_company?.name}</p>
                </div>
                <span className="text-lg font-bold text-green-700">{formatINR(load.opening_price)}</span>
              </div>
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
                <span className="font-medium text-brand-600">Closes in {timeUntil(load.auction_end_time)}</span>
              </div>
            </Link>
          ))}
        </div>
        <Pagination page={page} totalPages={totalPages} />
        </>
      )}
    </div>
  );
}
