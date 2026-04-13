import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ClockIcon, CheckCircleIcon, XCircleIcon } from "lucide-react";

export const metadata = { title: "Registration Pending — Tracking Management System" };

const STATUS_CONFIG = {
  pending: {
    icon: ClockIcon,
    iconClass: "text-yellow-500",
    bgClass: "bg-yellow-50 border-yellow-200",
    title: "Request Under Review",
    body: "Your registration request has been submitted and is awaiting admin approval. You will be able to access your dashboard once approved.",
  },
  approved: {
    icon: CheckCircleIcon,
    iconClass: "text-green-500",
    bgClass: "bg-green-50 border-green-200",
    title: "Registration Approved",
    body: "Your account has been approved. You can now sign in to access your dashboard.",
  },
  rejected: {
    icon: XCircleIcon,
    iconClass: "text-red-500",
    bgClass: "bg-red-50 border-red-200",
    title: "Registration Rejected",
    body: null, // shown separately so we can include review_notes
  },
};

export default async function RegisterPendingPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  // If not logged in at all, send to register
  if (!user) redirect("/register");

  const { data: regRequest } = await supabase
    .from("registration_requests")
    .select("status, company_name, user_type, review_notes, created_at")
    .eq("user_id", user.id)
    .maybeSingle();

  // No request yet — send back to register
  if (!regRequest) redirect("/register");

  // Approved and has a profile — redirect to dashboard
  if (regRequest.status === "approved") {
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();

    if (profile) redirect("/dashboard");
  }

  const config = STATUS_CONFIG[regRequest.status] ?? STATUS_CONFIG.pending;
  const Icon = config.icon;

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-muted px-4 py-12">
      <div className="card w-full max-w-md text-center">
        {/* Brand */}
        <h1 className="text-xl font-bold text-brand-600 mb-6">Tracking Management System</h1>

        {/* Status banner */}
        <div className={`rounded-xl border p-6 mb-6 ${config.bgClass}`}>
          <Icon className={`mx-auto mb-3 ${config.iconClass}`} size={40} />
          <h2 className="text-lg font-semibold text-slate-900 mb-2">{config.title}</h2>
          {config.body && (
            <p className="text-sm text-slate-600">{config.body}</p>
          )}
          {regRequest.status === "rejected" && (
            <p className="text-sm text-slate-600">
              Your registration request for{" "}
              <span className="font-medium">{regRequest.company_name}</span> was not approved.
              {regRequest.review_notes && (
                <>
                  {" "}Reason: <span className="font-medium">{regRequest.review_notes}</span>
                </>
              )}
            </p>
          )}
        </div>

        {/* Request summary */}
        <div className="text-left text-sm text-slate-600 space-y-1 mb-6">
          <div className="flex justify-between">
            <span className="text-slate-400">Company</span>
            <span className="font-medium text-slate-800">{regRequest.company_name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Account type</span>
            <span className="font-medium text-slate-800 capitalize">{regRequest.user_type}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Submitted</span>
            <span className="font-medium text-slate-800">
              {new Date(regRequest.created_at).toLocaleDateString("en-IN")}
            </span>
          </div>
        </div>

        {/* Actions */}
        {regRequest.status === "approved" && (
          <Link href="/dashboard" className="btn-primary w-full py-2.5 block">
            Go to Dashboard
          </Link>
        )}
        {regRequest.status === "rejected" && (
          <p className="text-sm text-slate-500">
            Please contact{" "}
            <a href="mailto:support@tracking_management_system.in" className="text-brand-600 hover:underline">
              support@tracking_management_system.in
            </a>{" "}
            for further assistance.
          </p>
        )}
        {regRequest.status === "pending" && (
          <p className="text-xs text-slate-400">
            Check back later or refresh this page to see your request status.
          </p>
        )}
      </div>
    </div>
  );
}
