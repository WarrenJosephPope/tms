"use client";

import Link from "next/link";
import { Lock } from "lucide-react";
import { MODULE_META } from "@/lib/modules";

/**
 * Wraps content that requires a specific module.
 * When the module is not enabled the slot is replaced with an upgrade prompt.
 *
 * Props:
 *  enabled  – boolean: does the company have this module?
 *  module   – 'bidding' | 'tracking'
 *  children – the actual UI to render when enabled
 */
export default function ModuleGuard({ enabled, module, children }) {
  if (enabled) return children;

  const meta = MODULE_META[module] ?? { label: module, description: "" };

  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6 rounded-xl border border-dashed border-slate-200 bg-slate-50">
      <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-4">
        <Lock size={22} className="text-slate-400" />
      </div>
      <h3 className="text-base font-semibold text-slate-700 mb-1">
        {meta.label} module not enabled
      </h3>
      <p className="text-sm text-slate-400 max-w-sm mb-5">{meta.description}</p>
      <Link
        href="/dashboard/settings"
        className="btn-primary text-sm"
      >
        Upgrade plan
      </Link>
    </div>
  );
}
