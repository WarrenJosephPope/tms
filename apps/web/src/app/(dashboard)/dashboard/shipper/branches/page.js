import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { GitBranch } from "lucide-react";
import BranchesPanel from "@/components/layout/BranchesPanel";

export const metadata = { title: "Branches — Shipper" };

export default async function ShipperBranchesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("shipper_role")
    .eq("id", user.id)
    .single();

  if (profile?.shipper_role !== "account_owner") {
    redirect("/dashboard/shipper");
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-brand-50 flex items-center justify-center">
          <GitBranch size={20} className="text-brand-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Branches</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Manage your company&apos;s branches. Each branch can have its own auction settings and acts as the default pickup address when posting loads.
          </p>
        </div>
      </div>

      <div className="card">
        <BranchesPanel apiBase="/api/company/branches" />
      </div>
    </div>
  );
}
