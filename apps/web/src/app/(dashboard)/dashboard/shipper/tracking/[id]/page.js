import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, MapPin } from "lucide-react";

export const metadata = { title: "Trip Detail — Shipper" };

const STATUS_COLOR = {
  assigned:   "bg-blue-50 text-blue-700",
  in_transit: "bg-brand-50 text-brand-700",
  delivered:  "bg-green-50 text-green-700",
  cancelled:  "bg-red-50 text-red-700",
};

const STATUS_LABEL = {
  assigned:   "Assigned",
  in_transit: "In Transit",
  delivered:  "Delivered",
  cancelled:  "Cancelled",
};

export default async function ShipperTripDetailPage({ params }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("company_id")
    .eq("id", user.id)
    .single();

  const { data: trip } = await supabase
    .from("trips")
    .select(`
      id, status, created_at, updated_at,
      load:loads(id, load_number, origin_city, dest_city, commodity_type, weight_tonnes, vehicle_type_req),
      transporter:companies!trips_transporter_company_id_fkey(name, phone),
      driver:drivers(full_name, phone)
    `)
    .eq("id", id)
    .eq("shipper_company_id", profile.company_id)
    .single();

  if (!trip) notFound();

  // Fetch the last known location ping
  const { data: lastPing } = await supabase
    .from("location_pings")
    .select("latitude, longitude, speed_kmph, created_at")
    .eq("trip_id", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const load = trip.load;

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/shipper/tracking"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800"
      >
        <ArrowLeft size={14} /> Back to Trips
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            {load?.origin_city} → {load?.dest_city}
          </h1>
          {load?.load_number && (
            <p className="text-sm text-slate-400 mt-0.5 font-mono">
              Load #{String(load.load_number).padStart(7, "0")}
            </p>
          )}
        </div>
        <span
          className={`px-3 py-1 rounded-full text-sm font-medium ${
            STATUS_COLOR[trip.status] ?? "bg-slate-100 text-slate-500"
          }`}
        >
          {STATUS_LABEL[trip.status] ?? trip.status}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: details */}
        <div className="lg:col-span-1 space-y-4">
          {/* Cargo */}
          <div className="card">
            <h2 className="font-semibold text-slate-900 mb-3">Cargo</h2>
            <dl className="space-y-2 text-sm">
              {[
                ["Commodity", load?.commodity_type],
                ["Weight", load?.weight_tonnes ? `${load.weight_tonnes} tonnes` : null],
                ["Vehicle", load?.vehicle_type_req],
              ].map(([label, val]) => val ? (
                <div key={label} className="flex justify-between">
                  <dt className="text-slate-500">{label}</dt>
                  <dd className="text-slate-800 font-medium text-right">{val}</dd>
                </div>
              ) : null)}
            </dl>
          </div>

          {/* Carrier */}
          <div className="card">
            <h2 className="font-semibold text-slate-900 mb-3">Carrier</h2>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-500">Company</dt>
                <dd className="text-slate-800 font-medium">{trip.transporter?.name ?? "—"}</dd>
              </div>
              {trip.driver?.full_name && (
                <div className="flex justify-between">
                  <dt className="text-slate-500">Driver</dt>
                  <dd className="text-slate-800 font-medium">{trip.driver.full_name}</dd>
                </div>
              )}
              {trip.driver?.phone && (
                <div className="flex justify-between">
                  <dt className="text-slate-500">Driver Phone</dt>
                  <dd className="text-slate-800 font-medium">{trip.driver.phone}</dd>
                </div>
              )}
            </dl>
          </div>

          {/* Last ping */}
          {lastPing && (
            <div className="card">
              <h2 className="font-semibold text-slate-900 mb-3">Last Location</h2>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-slate-500">Coordinates</dt>
                  <dd className="text-slate-800 font-mono text-xs">
                    {Number(lastPing.latitude).toFixed(5)}, {Number(lastPing.longitude).toFixed(5)}
                  </dd>
                </div>
                {lastPing.speed_kmph != null && (
                  <div className="flex justify-between">
                    <dt className="text-slate-500">Speed</dt>
                    <dd className="text-slate-800 font-medium">{lastPing.speed_kmph} km/h</dd>
                  </div>
                )}
                <div className="flex justify-between">
                  <dt className="text-slate-500">As of</dt>
                  <dd className="text-slate-400 text-xs">
                    {new Date(lastPing.created_at).toLocaleString()}
                  </dd>
                </div>
              </dl>
            </div>
          )}
        </div>

        {/* Right: map placeholder — live map rendered client-side in future */}
        <div className="lg:col-span-2">
          <div className="card h-80 flex flex-col items-center justify-center text-slate-300 rounded-xl">
            <MapPin size={40} className="mb-3" />
            {lastPing ? (
              <p className="text-sm text-slate-400">
                Live map — last ping{" "}
                {new Date(lastPing.created_at).toLocaleTimeString()}
              </p>
            ) : (
              <p className="text-sm text-slate-400">No location data yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
