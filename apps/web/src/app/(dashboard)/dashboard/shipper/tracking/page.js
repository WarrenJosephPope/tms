import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { MapPin, Package } from "lucide-react";
import LoadStatusBadge from "@/components/ui/LoadStatusBadge";
import { profileHasModule, MODULES } from "@/lib/modules";
import ModuleGuard from "@/components/modules/ModuleGuard";

export const metadata = { title: "Trips — Shipper" };

export default async function ShipperTrackingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("company_id, company:companies(modules)")
    .eq("id", user.id)
    .single();

  const trackingEnabled = profileHasModule(profile, MODULES.TRACKING);

  if (!trackingEnabled) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-900">Trips</h1>
        <ModuleGuard enabled={false} module={MODULES.TRACKING} />
      </div>
    );
  }

  const { data: trips } = await supabase
    .from("trips")
    .select(`
      id, status, created_at,
      load:loads(id, load_number, origin_city, dest_city, commodity_type),
      transporter:companies!trips_transporter_company_id_fkey(name)
    `)
    .eq("shipper_company_id", profile.company_id)
    .order("created_at", { ascending: false });

  const rows = trips ?? [];

  const TRIP_STATUS_LABEL = {
    assigned:   "Assigned",
    in_transit: "In Transit",
    delivered:  "Delivered",
    cancelled:  "Cancelled",
  };

  const TRIP_STATUS_COLOR = {
    assigned:   "bg-blue-50 text-blue-700",
    in_transit: "bg-brand-50 text-brand-700",
    delivered:  "bg-green-50 text-green-700",
    cancelled:  "bg-red-50 text-red-700",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Trips</h1>
      </div>

      {rows.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-16 text-center">
          <MapPin size={40} className="text-slate-300 mb-3" />
          <p className="text-sm text-slate-400">No trips yet.</p>
          <p className="text-xs text-slate-300 mt-1">
            Trips are created automatically when you award a load.
          </p>
        </div>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-border text-left text-slate-500">
                <th className="px-5 py-3 font-medium">Load</th>
                <th className="px-5 py-3 font-medium">Route</th>
                <th className="px-5 py-3 font-medium">Carrier</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border">
              {rows.map((trip) => (
                <tr key={trip.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-3 font-mono text-xs text-slate-500">
                    {trip.load?.load_number
                      ? `#${String(trip.load.load_number).padStart(7, "0")}`
                      : "—"}
                  </td>
                  <td className="px-5 py-3 text-slate-800">
                    {trip.load?.origin_city} → {trip.load?.dest_city}
                  </td>
                  <td className="px-5 py-3 text-slate-600">
                    {trip.transporter?.name ?? "—"}
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        TRIP_STATUS_COLOR[trip.status] ?? "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {TRIP_STATUS_LABEL[trip.status] ?? trip.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <Link
                      href={`/dashboard/shipper/tracking/${trip.id}`}
                      className="text-brand-600 text-xs hover:underline"
                    >
                      View →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
