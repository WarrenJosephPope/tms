"use client";

import Image from "next/image";
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/dashboard";

  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState("phone"); // "phone" | "otp"
  const [isPending, startTransition] = useTransition();

  const supabase = createClient();

  async function sendOtp(e) {
    e.preventDefault();
    const formatted = phone.startsWith("+91") ? phone : `+91${phone.replace(/\D/g, "")}`;

    startTransition(async () => {
      const { error } = await supabase.auth.signInWithOtp({
        phone: formatted,
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("OTP sent to your phone");
      setStep("otp");
    });
  }

  async function verifyOtp(e) {
    e.preventDefault();
    const formatted = phone.startsWith("+91") ? phone : `+91${phone.replace(/\D/g, "")}`;

    startTransition(async () => {
      const { error } = await supabase.auth.verifyOtp({
        phone: formatted,
        token: otp,
        type: "sms",
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      router.push(next);
      router.refresh();
    });
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-muted px-4">
      <div className="card w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="flex justify-center mb-3">
            <Image src="/logo.png" alt="eParivahan" width={180} height={45} className="object-contain" priority />
          </div>
          <p className="text-sm text-slate-500">Sign in with your mobile number</p>
        </div>

        {step === "phone" ? (
          <form onSubmit={sendOtp} className="space-y-4">
            <div>
              <label className="label" htmlFor="phone">Mobile Number</label>
              <div className="flex">
                <span className="inline-flex items-center px-3 rounded-l-lg border border-r-0 border-surface-border bg-slate-50 text-slate-500 text-sm">
                  +91
                </span>
                <input
                  id="phone"
                  type="tel"
                  inputMode="numeric"
                  pattern="[0-9]{10}"
                  maxLength={10}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="9876543210"
                  required
                  className="input rounded-l-none"
                  autoFocus
                />
              </div>
            </div>
            <button type="submit" disabled={isPending} className="btn-primary w-full py-2.5">
              {isPending ? "Sending…" : "Send OTP"}
            </button>
          </form>
        ) : (
          <form onSubmit={verifyOtp} className="space-y-4">
            <p className="text-sm text-slate-600 text-center">
              Enter the 6-digit OTP sent to <span className="font-semibold">+91 {phone}</span>
            </p>
            <div>
              <label className="label" htmlFor="otp">OTP</label>
              <input
                id="otp"
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="······"
                required
                className="input text-center text-2xl tracking-widest"
                autoFocus
              />
            </div>
            <button type="submit" disabled={isPending} className="btn-primary w-full py-2.5">
              {isPending ? "Verifying…" : "Verify & Sign In"}
            </button>
            <button
              type="button"
              onClick={() => setStep("phone")}
              className="w-full text-center text-sm text-slate-500 hover:text-slate-700"
            >
              ← Change number
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-sm text-slate-500">
          Don&apos;t have an account?{" "}
          <Link href="/register" className="text-brand-600 font-medium hover:underline">
            Register
          </Link>
        </p>
      </div>
    </div>
  );
}
