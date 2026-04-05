import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Building2 } from "lucide-react";
import TypeAllotmentsPanel from "./TypeAllotmentsPanel";

export async function generateMetadata({ params }) {
  return { title: "Company — Admin" };
}

const KYC_BADGE = {
  pending:  "bg-yellow-100 text-yellow-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
};

export default async function AdminCompanyDetailPage({ params }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: company } = await supabase
    .from("companies")
    .select("id, name, user_type, kyc_status, gstin, pan, phone, email, address_line1, city, state, pincode, is_active, created_at")
    .eq("id", id)
    .single();

  if (!company) notFound();

  return (
    <div className="space-y-6">
      {/* Back */}
      <Link
        href="/dashboard/admin/companies"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800"
      >
        <ArrowLeft size={14} /> Back to Companies
      </Link>

      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-lg bg-brand-50 flex items-center justify-center shrink-0">
          <Building2 size={20} className="text-brand-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{company.name}</h1>
          <div className="flex items-center gap-2 mt-1">
            <span className="capitalize text-sm text-slate-500">{company.user_type}</span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${KYC_BADGE[company.kyc_status]}`}>
              {company.kyc_status}
            </span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${company.is_active ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>
              {company.is_active ? "Active" : "Inactive"}
            </span>
          </div>
        </div>
      </div>

      {/* Company details */}
      <div className="card">
        <h2 className="font-semibold text-slate-900 mb-4">Company Details</h2>
        <dl className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
          {[
            ["Phone", company.phone],
            ["Email", company.email],
            ["GSTIN", company.gstin],
            ["PAN", company.pan],
            ["City", company.city],
            ["State", company.state],
            ["Pincode", company.pincode],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs text-slate-400 uppercase tracking-wide font-medium">{label}</dt>
              <dd className="text-slate-800 mt-0.5">{value || "—"}</dd>
            </div>
          ))}
        </dl>
      </div>

      {/* Type allotments — only meaningful for shippers */}
      {company.user_type === "shipper" ? (
        <div className="card">
          <div className="mb-4">
            <h2 className="font-semibold text-slate-900">Type Allotments</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Control which commodity and vehicle types this company can select when posting loads.
              Leave all unchecked to allow all active types.
            </p>
          </div>
          <TypeAllotmentsPanel companyId={company.id} />
        </div>
      ) : (
        <div className="card">
          <p className="text-sm text-slate-400">
            Type allotments only apply to shipper companies.
          </p>
        </div>
      )}
    </div>
  );
}
