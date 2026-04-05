import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { formatINR, timeUntil } from "@/lib/format";

export const metadata = { title: "Load Market" };

const VEHICLE_TYPE_OPTIONS = [
  { value: "", label: "All Vehicles" },
  { value: "closed_container", label: "Closed Container" },
  { value: "open_trailer",     label: "Open Trailer" },
  { value: "flatbed",          label: "Flatbed" },
  { value: "tanker",           label: "Tanker" },
  { value: "refrigerated",     label: "Refrigerated" },
  { value: "mini_truck",       label: "Mini Truck" },
];

export default async function TransporterLoadsPage({ searchParams }) {
  const params = await searchParams;
  const vehicleFilter = params.vehicle ?? "";
  const originFilter  = params.origin  ?? "";
  const destFilter    = params.dest    ?? "";

  const supabase = await createClient();

  let query = supabase
    .from("loads")
    .select(`
      id, origin_city, dest_city, commodity, opening_price,
      auction_end_time, vehicle_type_req, weight_tonnes, pickup_date,
      shipper_company:companies(name)
    `)
    .eq("status", "open")
    .gt("auction_end_time", new Date().toISOString())
    .order("auction_end_time", { ascending: true });

  if (vehicleFilter) query = query.eq("vehicle_type_req", vehicleFilter);
  if (originFilter)  query = query.ilike("origin_city", `%${originFilter}%`);
  if (destFilter)    query = query.ilike("dest_city", `%${destFilter}%`);

  const { data: loads } = await query;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Load Market</h1>
        <span className="text-sm text-slate-500">{loads?.length ?? 0} open loads</span>
      </div>

      {/* Filters */}
      <form method="GET" className="flex flex-wrap gap-3">
        <input
          name="origin" defaultValue={originFilter} placeholder="Origin city"
          className="input max-w-xs"
        />
        <input
          name="dest" defaultValue={destFilter} placeholder="Destination city"
          className="input max-w-xs"
        />
        <select name="vehicle" defaultValue={vehicleFilter} className="input max-w-xs">
          {VEHICLE_TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <button type="submit" className="btn-primary px-5">Filter</button>
        {(vehicleFilter || originFilter || destFilter) && (
          <Link href="/dashboard/transporter/loads" className="btn-secondary px-5">Clear</Link>
        )}
      </form>

      {/* Load cards */}
      {!loads?.length ? (
        <div className="card py-16 text-center text-slate-400">
          <p className="text-sm">No open loads match your filters.</p>
        </div>
      ) : (
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
      )}
    </div>
  );
}
