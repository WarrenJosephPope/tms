import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function HomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // If already logged in, redirect to dashboard
  if (user) {
    redirect("/dashboard");
  }

  return (
    <main className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-surface-border max-w-7xl mx-auto">
        <Image src="/logo.png" alt="Tracking Management System" width={160} height={40} className="object-contain" priority />
        <div className="flex items-center gap-3">
          <Link href="/login" className="btn-secondary text-sm">Log in</Link>
          <Link href="/register" className="btn-primary text-sm">Get started</Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-6 pt-24 pb-20 text-center">
        <div className="inline-flex items-center gap-2 rounded-full bg-brand-50 text-brand-700 text-xs font-semibold px-3 py-1 mb-6 ring-1 ring-brand-200">
          India&apos;s Freight Exchange — Now Digital
        </div>
        <h1 className="text-5xl font-extrabold text-slate-900 leading-tight mb-6">
          Post loads. Get bids.<br />Track in real time.
        </h1>
        <p className="text-xl text-slate-500 max-w-2xl mx-auto mb-10">
          Tracking Management System connects shippers with verified transporters through a live
          reverse auction and gives you GPS + SIM-based fleet visibility — all in one platform.
        </p>
        <div className="flex items-center justify-center gap-4 flex-wrap">
          <Link href="/register/shipper" className="btn-primary px-6 py-3 text-base">
            I&apos;m a Shipper
          </Link>
          <Link href="/register/transporter" className="btn-secondary px-6 py-3 text-base">
            I&apos;m a Transporter
          </Link>
        </div>
      </section>

      {/* Feature cards */}
      <section className="max-w-6xl mx-auto px-6 pb-24 grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          {
            title: "Reverse Auction Bidding",
            desc: "Post a load with a budget. Transporters bid in real time. Price drops, you save.",
            icon: "🔨",
          },
          {
            title: "Live Fleet Tracking",
            desc: "Track trucks on MapmyIndia maps via driver app GPS or cell-tower fallback. No hardware needed.",
            icon: "📍",
          },
          {
            title: "Digital Lorry Receipt",
            desc: "Auto-generate e-LR on bid acceptance. ePOD with photo + signature at delivery.",
            icon: "📄",
          },
        ].map((f) => (
          <div key={f.title} className="card">
            <span className="text-3xl mb-4 block">{f.icon}</span>
            <h3 className="font-semibold text-slate-900 mb-2">{f.title}</h3>
            <p className="text-sm text-slate-500">{f.desc}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
