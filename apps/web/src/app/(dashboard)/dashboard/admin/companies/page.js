import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Building2, ChevronRight } from "lucide-react";
import CompanySearch from "./CompanySearch";
import Pagination from "@/components/ui/Pagination";

export const metadata = { title: "Companies — Admin" };

const KYC_BADGE = {
  pending:  "bg-yellow-100 text-yellow-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
};

export default async function AdminCompaniesPage({ searchParams }) {
  const supabase = await createClient();
  const sp = await searchParams;
  const kycFilter = sp?.kyc;
  const typeFilter = sp?.type;
  const search = sp?.search?.trim();
  const limit = Math.max(1, parseInt(sp?.limit ?? "10", 10) || 10);
  const page = Math.max(1, parseInt(sp?.page ?? "1", 10) || 1);
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = supabase
    .from("companies")
    .select("id, name, user_type, kyc_status, city, state, is_active, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (kycFilter) query = query.eq("kyc_status", kycFilter);
  if (typeFilter) query = query.eq("user_type", typeFilter);
  if (search) query = query.ilike("name", `%${search}%`);

  const { data: companies = [], count } = await query;
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / limit));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Companies</h1>
          <p className="text-sm text-slate-500 mt-1">
            {count ?? 0} companies found
            {totalPages > 1 && ` — page ${page} of ${totalPages}`}
          </p>
        </div>
        <CompanySearch defaultValue={search ?? ""} />
        <div className="flex flex-wrap gap-2">
          <div className="flex flex-wrap gap-2">
            {[{ label: "All Types", value: "" }, { label: "Transporter", value: "transporter" }, { label: "Shipper", value: "shipper" }].map(({ label, value }) => {
              const params = new URLSearchParams();
              if (kycFilter) params.set("kyc", kycFilter);
              if (value) params.set("type", value);
              if (search) params.set("search", search);
              if (limit !== 10) params.set("limit", String(limit));
              const href = `/dashboard/admin/companies${params.toString() ? `?${params}` : ""}`;
              return (
                <Link
                  key={label}
                  href={href}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    typeFilter === value || (!typeFilter && !value)
                      ? "bg-brand-600 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {label}
                </Link>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-2">
            {["", "pending", "approved", "rejected"].map((status) => {
              const params = new URLSearchParams();
              if (typeFilter) params.set("type", typeFilter);
              if (status) params.set("kyc", status);
              if (search) params.set("search", search);
              if (limit !== 10) params.set("limit", String(limit));
              const href = `/dashboard/admin/companies${params.toString() ? `?${params}` : ""}`;
              return (
                <Link
                  key={status || "all"}
                  href={href}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    kycFilter === status || (!kycFilter && !status)
                      ? "bg-brand-600 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {status ? status.charAt(0).toUpperCase() + status.slice(1) : "All KYC"}
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      <div className="card overflow-hidden p-0">
        {companies.length === 0 ? (
          <p className="text-sm text-slate-400 py-10 text-center">No companies found.</p>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-border text-left text-slate-500">
                <th className="px-4 py-3 font-medium">Company</th>
                <th className="px-4 py-3 font-medium hidden sm:table-cell">Type</th>
                <th className="px-4 py-3 font-medium hidden md:table-cell">Location</th>
                <th className="px-4 py-3 font-medium">KYC</th>
                <th className="px-4 py-3 font-medium hidden sm:table-cell">Status</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border">
              {companies.map((co) => (
                <tr key={co.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-slate-900">{co.name}</td>
                  <td className="px-4 py-3 capitalize text-slate-600 hidden sm:table-cell">{co.user_type}</td>
                  <td className="px-4 py-3 text-slate-600 hidden md:table-cell">
                    {[co.city, co.state].filter(Boolean).join(", ") || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${KYC_BADGE[co.kyc_status]}`}>
                      {co.kyc_status}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${co.is_active ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>
                      {co.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/dashboard/admin/companies/${co.id}`}
                      className="flex items-center gap-1 text-brand-600 hover:underline text-xs font-medium"
                    >
                      Manage <ChevronRight size={12} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
        {totalPages > 1 && (
          <div className="px-4">
            <Pagination page={page} totalPages={totalPages} />
          </div>
        )}
      </div>
    </div>
  );
}
