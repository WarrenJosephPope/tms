"use client";

import { useState, useTransition } from "react";
import { useRouter, useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";

const STEPS = ["phone", "otp", "company"];

const USER_TYPE_CONFIG = {
  shipper: {
    label: "Shipper",
    icon: "📦",
    defaultRole: "account_owner",
  },
  transporter: {
    label: "Transporter",
    icon: "🚚",
    defaultRole: "account_owner",
  },
};

export default function RegisterTypePage() {
  const { type } = useParams(); // "shipper" | "transporter"
  const router = useRouter();
  const config = USER_TYPE_CONFIG[type];

  const [step, setStep] = useState("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [form, setForm] = useState({
    full_name: "",
    company_name: "",
    gstin: "",
    city: "",
    state: "",
  });
  const [isPending, startTransition] = useTransition();

  const supabase = createClient();

  if (!config) {
    return <div className="min-h-screen flex items-center justify-center"><p>Invalid registration type.</p></div>;
  }

  const formatted = phone.startsWith("+91") ? phone : `+91${phone.replace(/\D/g, "")}`;

  async function sendOtp(e) {
    e.preventDefault();
    startTransition(async () => {
      const { error } = await supabase.auth.signInWithOtp({ phone: formatted });
      if (error) { toast.error(error.message); return; }
      toast.success("OTP sent!");
      setStep("otp");
    });
  }

  async function verifyOtp(e) {
    e.preventDefault();
    startTransition(async () => {
      const { data, error } = await supabase.auth.verifyOtp({
        phone: formatted,
        token: otp,
        type: "sms",
      });
      if (error) { toast.error(error.message); return; }
      if (!data.session) {
        toast.error("Phone verification succeeded but no session was created. Please try again.");
        return;
      }
      await Promise.resolve(supabase.rpc("clear_otp_logs", { p_phone: formatted.replace(/^\+/, "") })).catch(() => {});
      setStep("company");
    });
  }

  async function submitCompany(e) {
    e.preventDefault();
    startTransition(async () => {
      // Read the session that was established by verifyOtp
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Session expired. Please verify your phone again.");
        setStep("otp");
        return;
      }

      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          user_type: type,
          full_name: form.full_name,
          company_name: form.company_name,
          gstin: form.gstin,
          city: form.city,
          state: form.state,
          phone: formatted,
        }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Registration failed"); return; }
      toast.success("Request submitted! Awaiting admin approval.");
      router.push("/register/pending");
    });
  }

  const field = (key, label, opts = {}) => (
    <div>
      <label className="label" htmlFor={key}>{label}{opts.required !== false && " *"}</label>
      <input
        id={key}
        className="input"
        value={form[key]}
        onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
        required={opts.required !== false}
        {...opts}
      />
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-muted px-4 py-12">
      <div className="card w-full max-w-md">
        {/* Header */}
        <div className="mb-6 text-center">
          <span className="text-4xl">{config.icon}</span>
          <h1 className="text-2xl font-bold text-slate-900 mt-2">
            Register as {config.label}
          </h1>
          <div className="flex justify-center gap-1 mt-4">
            {STEPS.map((s, i) => (
              <div key={s} className={`h-1.5 w-10 rounded-full transition-colors ${
                STEPS.indexOf(step) >= i ? "bg-brand-500" : "bg-slate-200"
              }`} />
            ))}
          </div>
        </div>

        {step === "phone" && (
          <form onSubmit={sendOtp} className="space-y-4">
            <div>
              <label className="label" htmlFor="phone">Mobile Number *</label>
              <div className="flex">
                <span className="inline-flex items-center px-3 rounded-l-lg border border-r-0 border-surface-border bg-slate-50 text-slate-500 text-sm">+91</span>
                <input
                  id="phone" type="tel" inputMode="numeric" pattern="[0-9]{10}" maxLength={10}
                  value={phone} onChange={(e) => setPhone(e.target.value)}
                  placeholder="9876543210" required className="input rounded-l-none" autoFocus
                />
              </div>
            </div>
            <button type="submit" disabled={isPending} className="btn-primary w-full py-2.5">
              {isPending ? "Sending…" : "Send OTP"}
            </button>
          </form>
        )}

        {step === "otp" && (
          <form onSubmit={verifyOtp} className="space-y-4">
            <p className="text-sm text-slate-600 text-center">
              OTP sent to <span className="font-semibold">+91 {phone}</span>
            </p>
            <div>
              <label className="label" htmlFor="otp">OTP *</label>
              <input
                id="otp" type="text" inputMode="numeric" pattern="[0-9]{6}" maxLength={6}
                value={otp} onChange={(e) => setOtp(e.target.value)}
                placeholder="······" required className="input text-center text-2xl tracking-widest" autoFocus
              />
            </div>
            <button type="submit" disabled={isPending} className="btn-primary w-full py-2.5">
              {isPending ? "Verifying…" : "Verify OTP"}
            </button>
            <button type="button" onClick={() => setStep("phone")} className="w-full text-center text-sm text-slate-500 hover:text-slate-700">
              ← Change number
            </button>
          </form>
        )}

        {step === "company" && (
          <form onSubmit={submitCompany} className="space-y-4">
            {field("full_name", "Your Full Name", { placeholder: "Ramesh Kumar" })}
            {field("company_name", "Company/Business Name", { placeholder: "Bharat Logistics Pvt Ltd" })}
            {field("gstin", "GSTIN", { placeholder: "27AABCF1234A1Z5", required: false })}
            <div className="grid grid-cols-2 gap-3">
              {field("city", "City", { placeholder: "Mumbai" })}
              {field("state", "State", { placeholder: "Maharashtra" })}
            </div>
            <button type="submit" disabled={isPending} className="btn-primary w-full py-2.5">
              {isPending ? "Creating account…" : "Create Account"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
