import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import LoadStatusBadge from "@/components/ui/LoadStatusBadge";
import TableSearch from "@/components/ui/TableSearch";
import Pagination from "@/components/ui/Pagination";
import { formatLoadNumber } from "@/lib/format";

export const metadata = { title: "My Loads" };

const LOAD_STATUSES = ["open", "under_review", "awarded", "assigned", "in_transit", "delivered", "cancelled", "expired"];

function buildHref(base, current, overrides) {
  const params = new URLSearchParams();
  const merged = { ...current, ...overrides };
  if (merged.search) params.set("search", merged.search);
  if (merged.status) params.set("status", merged.status);
  if (merged.page && merged.page > 1) params.set("page", String(merged.page));
  if (merged.limit && merged.limit !== 10) params.set("limit", String(merged.limit));
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

export default async function ShipperLoadsPage({ searchParams }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("user_profiles").select("company_id").eq("id", user.id).single();

  // Transition any open loads whose auction has ended to the correct status
  await supabase.rpc("transition_expired_loads", { p_company_id: profile.company_id });

  const sp = await searchParams;
  const search = sp?.search?.trim() ?? "";
  const statusFilter = sp?.status ?? "";
  const limit = Math.max(1, parseInt(sp?.limit ?? "10", 10) || 10);
  const page  = Math.max(1, parseInt(sp?.page  ?? "1",  10) || 1);
  const from  = (page - 1) * limit;
  const to    = from + limit - 1;

  // Strip leading # and check if searching by load number
  const searchClean = search.replace(/^#/, "");
  const loadNumberSearch = searchClean && /^\d+$/.test(searchClean) ? Number(searchClean) : null;

  let query = supabase
    .from("loads")
    .select("id, load_number, origin_city, dest_city, commodity, opening_price, status, auction_end_time, pickup_date, weight_tonnes, vehicle_type_req", { count: "exact" })
    .eq("shipper_company_id", profile.company_id)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (statusFilter) query = query.eq("status", statusFilter);
  if (loadNumberSearch) {
    query = query.eq("load_number", loadNumberSearch);
  } else if (search) {
    query = query.or(`origin_city.ilike.%${search}%,dest_city.ilike.%${search}%,commodity.ilike.%${search}%`);
  }

  const { data: loads = [], count } = await query;
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / limit));
  const current = { search, status: statusFilter, limit };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My Loads</h1>
          <p className="text-sm text-slate-500 mt-1">
            {count ?? 0} loads{totalPages > 1 && ` — page ${page} of ${totalPages}`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <TableSearch placeholder="Search route or commodity…" />
          <Link href="/dashboard/shipper/loads/new" className="btn-primary">+ Post Load</Link>
        </div>
      </div>

      {/* Status filters */}
      <div className="flex flex-wrap gap-2">
        {["", ...LOAD_STATUSES].map((s) => (
          <Link
            key={s || "all"}
            href={buildHref("/dashboard/shipper/loads", current, { status: s, page: 1 })}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              statusFilter === s || (!statusFilter && !s)
                ? "bg-brand-600 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {s ? s.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()) : "All"}
          </Link>
        ))}
      </div>

      <div className="card overflow-hidden p-0">
        {loads.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            <p className="text-sm">{search || statusFilter ? "No loads match your filters." : "No loads posted yet."}</p>
            {!search && !statusFilter && (
              <Link href="/dashboard/shipper/loads/new" className="btn-primary mt-4 inline-flex">Post first load</Link>
            )}
          </div>
        ) : (
          <>
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr className="text-left text-slate-500 text-xs uppercase tracking-wide">
                <th className="px-4 py-3 font-semibold">#</th>
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
                  <td className="px-4 py-3 font-mono text-xs text-slate-500 whitespace-nowrap">
                    {formatLoadNumber(load.load_number)}
                  </td>
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
          <div className="px-4">
            <Pagination page={page} totalPages={totalPages} />
          </div>
          </>
        )}
      </div>
    </div>
  );
}
