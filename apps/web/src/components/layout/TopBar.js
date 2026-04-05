"use client";

import { Bell, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

export default function TopBar({ profile }) {
  const router = useRouter();
  const supabase = createClient();

  async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) { toast.error("Sign out failed"); return; }
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="h-16 flex items-center justify-between px-6 bg-white border-b border-surface-border flex-shrink-0">
      {/* Page title placeholder — pages can override via <title> */}
      <div />

      <div className="flex items-center gap-3">
        {/* KYC badge */}
        {profile.company?.kyc_status === "pending" && (
          <span className="badge-pending text-xs">KYC Pending</span>
        )}

        {/* Notifications button */}
        <button
          className="relative p-2 rounded-lg hover:bg-slate-50 text-slate-600 transition-colors"
          aria-label="Notifications"
        >
          <Bell size={18} />
        </button>

        {/* Sign out */}
        <button
          onClick={signOut}
          className="flex items-center gap-1.5 p-2 rounded-lg hover:bg-slate-50 text-slate-600 transition-colors text-sm"
          aria-label="Sign out"
        >
          <LogOut size={16} />
          <span className="hidden sm:inline text-sm">Sign out</span>
        </button>
      </div>
    </header>
  );
}
