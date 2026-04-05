import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import LoadStatusBadge from "@/components/ui/LoadStatusBadge";

export const metadata = { title: "My Loads" };

export default async function ShipperLoadsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("user_profiles").select("company_id").eq("id", user.id).single();

  const { data: loads } = await supabase
    .from("loads")
    .select("id, origin_city, dest_city, commodity, opening_price, status, auction_end_time, pickup_date, weight_tonnes, vehicle_type_req")
    .eq("shipper_company_id", profile.company_id)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">My Loads</h1>
        <Link href="/dashboard/shipper/loads/new" className="btn-primary">+ Post Load</Link>
      </div>

      <div className="card overflow-hidden p-0">
        {!loads?.length ? (
          <div className="py-16 text-center text-slate-400">
            <p className="text-sm">No loads posted yet.</p>
            <Link href="/dashboard/shipper/loads/new" className="btn-primary mt-4 inline-flex">Post first load</Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr className="text-left text-slate-500 text-xs uppercase tracking-wide">
                <th className="px-4 py-3 font-semibold">Route</th>
                <th className="px-4 py-3 font-semibold hidden sm:table-cell">Commodity</th>
                <th className="px-4 py-3 font-semibold hidden md:table-cell">Pickup</th>
                <th className="px-4 py-3 font-semibold">Opening Price</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border">
              {loads.map((load) => (
                <tr key={load.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {load.origin_city} → {load.dest_city}
                  </td>
                  <td className="px-4 py-3 text-slate-600 hidden sm:table-cell">{load.commodity}</td>
                  <td className="px-4 py-3 text-slate-500 hidden md:table-cell">
                    {load.pickup_date
                      ? new Date(load.pickup_date).toLocaleDateString("en-IN", { dateStyle: "medium" })
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    ₹{Number(load.opening_price).toLocaleString("en-IN")}
                  </td>
                  <td className="px-4 py-3"><LoadStatusBadge status={load.status} /></td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/dashboard/shipper/loads/${load.id}`}
                      className="text-brand-600 text-xs font-medium hover:underline"
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
    </div>
  );
}
