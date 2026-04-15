import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import TripActions from "../TripActions";

export const metadata = { title: "Trip — Transporter" };

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

export default async function TransporterTripDetailPage({ params }) {
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
      shipper:companies!trips_shipper_company_id_fkey(name, phone),
      driver:drivers(full_name, phone)
    `)
    .eq("id", id)
    .eq("transporter_company_id", profile.company_id)
    .single();

  if (!trip) notFound();

  const load = trip.load;

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/transporter/tracking"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800"
      >
        <ArrowLeft size={14} /> Back to Trips
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
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
        <div className="flex items-center gap-3">
          <span
            className={`px-3 py-1 rounded-full text-sm font-medium ${
              STATUS_COLOR[trip.status] ?? "bg-slate-100 text-slate-500"
            }`}
          >
            {STATUS_LABEL[trip.status] ?? trip.status}
          </span>
          <TripActions tripId={trip.id} currentStatus={trip.status} />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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

        {/* Shipper */}
        <div className="card">
          <h2 className="font-semibold text-slate-900 mb-3">Shipper</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-500">Company</dt>
              <dd className="text-slate-800 font-medium">{trip.shipper?.name ?? "—"}</dd>
            </div>
            {trip.shipper?.phone && (
              <div className="flex justify-between">
                <dt className="text-slate-500">Phone</dt>
                <dd className="text-slate-800">{trip.shipper.phone}</dd>
              </div>
            )}
          </dl>
        </div>

        {/* Driver */}
        <div className="card">
          <h2 className="font-semibold text-slate-900 mb-3">Driver</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-500">Name</dt>
              <dd className="text-slate-800 font-medium">{trip.driver?.full_name ?? "Not assigned"}</dd>
            </div>
            {trip.driver?.phone && (
              <div className="flex justify-between">
                <dt className="text-slate-500">Phone</dt>
                <dd className="text-slate-800">{trip.driver.phone}</dd>
              </div>
            )}
          </dl>
        </div>
      </div>
    </div>
  );
}
