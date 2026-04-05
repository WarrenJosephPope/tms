import Link from "next/link";

export default function RegisterPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-muted px-4">
      <div className="card w-full max-w-md text-center">
        <h1 className="text-2xl font-bold text-brand-600 mb-2">Join eParivahan</h1>
        <p className="text-sm text-slate-500 mb-8">Choose your account type to get started</p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Link
            href="/register/shipper"
            className="group rounded-xl border-2 border-surface-border hover:border-brand-400 p-6 text-left transition-all"
          >
            <span className="text-3xl block mb-3">📦</span>
            <h2 className="font-semibold text-slate-900 mb-1">I&apos;m a Shipper</h2>
            <p className="text-xs text-slate-500">Post loads, run auctions, track shipments</p>
          </Link>

          <Link
            href="/register/transporter"
            className="group rounded-xl border-2 border-surface-border hover:border-brand-400 p-6 text-left transition-all"
          >
            <span className="text-3xl block mb-3">🚚</span>
            <h2 className="font-semibold text-slate-900 mb-1">I&apos;m a Transporter</h2>
            <p className="text-xs text-slate-500">Browse loads, bid, manage your fleet</p>
          </Link>
        </div>

        <p className="mt-6 text-sm text-slate-500">
          Already have an account?{" "}
          <Link href="/login" className="text-brand-600 font-medium hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
