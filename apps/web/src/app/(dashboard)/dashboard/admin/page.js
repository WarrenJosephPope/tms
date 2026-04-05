import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Building2, Package, Truck, ShieldCheck } from "lucide-react";
import StatCard from "@/components/ui/StatCard";
import LoadStatusBadge from "@/components/ui/LoadStatusBadge";

export const metadata = { title: "Admin Dashboard" };

export default async function AdminDashboardPage() {
  const supabase = await createClient();

  const [companiesResult, loadsResult, tripsResult, pendingKycResult] = await Promise.all([
    supabase.from("companies").select("id", { count: "exact", head: true }),
    supabase.from("loads").select("id", { count: "exact", head: true }),
    supabase.from("trips").select("id", { count: "exact", head: true }).eq("status", "in_transit"),
    supabase.from("companies").select("id, name, user_type, kyc_status, created_at", { count: "exact" })
      .eq("kyc_status", "pending")
      .order("created_at", { ascending: true })
      .limit(10),
  ]);

  const pendingCompanies = pendingKycResult.data ?? [];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Admin Dashboard</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Companies" value={companiesResult.count ?? 0} icon={<Building2 size={20} />} />
        <StatCard label="Total Loads" value={loadsResult.count ?? 0} icon={<Package size={20} />} color="brand" />
        <StatCard label="Active Trips" value={tripsResult.count ?? 0} icon={<Truck size={20} />} color="green" />
        <StatCard label="Pending KYC" value={pendingKycResult.count ?? 0} icon={<ShieldCheck size={20} />} color="yellow" />
      </div>

      {/* Pending KYC companies */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-slate-900">Pending KYC Approvals</h2>
          <Link href="/dashboard/admin/companies?kyc=pending" className="text-sm text-brand-600 hover:underline">View all →</Link>
        </div>
        {pendingCompanies.length === 0 ? (
          <p className="text-sm text-slate-400 py-6 text-center">All companies are verified ✓</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-border text-left text-slate-500">
                  <th className="pb-3 pr-4 font-medium">Company</th>
                  <th className="pb-3 pr-4 font-medium">Type</th>
                  <th className="pb-3 pr-4 font-medium">Registered</th>
                  <th className="pb-3 font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border">
                {pendingCompanies.map((co) => (
                  <tr key={co.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 pr-4 font-medium text-slate-900">{co.name}</td>
                    <td className="py-3 pr-4 capitalize text-slate-600">{co.user_type}</td>
                    <td className="py-3 pr-4 text-slate-500 text-xs">
                      {new Date(co.created_at).toLocaleDateString("en-IN")}
                    </td>
                    <td className="py-3">
                      <Link
                        href={`/dashboard/admin/companies/${co.id}`}
                        className="text-brand-600 text-sm font-medium hover:underline"
                      >
                        Review →
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
