"use client";

import { useState, useTransition } from "react";
import toast from "react-hot-toast";
import { Gavel, MapPin, CheckCircle2, Circle } from "lucide-react";
import ModuleBadge from "@/components/modules/ModuleBadge";

const MODULE_DEFS = [
  {
    id: "bidding",
    label: "Bidding",
    description: "Post loads, run reverse auctions, manage bids and award carriers.",
    icon: Gavel,
    color: "brand",
  },
  {
    id: "tracking",
    label: "Tracking",
    description: "Track live carrier location, manage trip lifecycle and delivery confirmations.",
    icon: MapPin,
    color: "green",
  },
];

export default function CompanyModulesPanel({ companyId, initialModules }) {
  const [modules, setModules] = useState(initialModules ?? ["bidding", "tracking"]);
  const [isPending, startTransition] = useTransition();

  function toggle(moduleId) {
    setModules((prev) =>
      prev.includes(moduleId)
        ? prev.filter((m) => m !== moduleId)
        : [...prev, moduleId]
    );
  }

  function save() {
    startTransition(async () => {
      const res = await fetch(`/api/admin/companies/${companyId}/modules`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modules }),
      });
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({}));
        toast.error(error ?? "Failed to save modules");
        return;
      }
      toast.success("Module access updated");
    });
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-semibold text-slate-900">Product Modules</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Enable or disable modules for this company. Disabled modules hide
            the corresponding UI and protect API endpoints.
          </p>
        </div>
        <button
          onClick={save}
          disabled={isPending}
          className="btn-primary text-sm disabled:opacity-50"
        >
          {isPending ? "Saving…" : "Save"}
        </button>
      </div>

      <div className="space-y-3">
        {MODULE_DEFS.map(({ id, label, description, icon: Icon, color }) => {
          const active = modules.includes(id);
          return (
            <button
              key={id}
              onClick={() => toggle(id)}
              className={`w-full text-left flex items-start gap-4 p-4 rounded-xl border transition-colors ${
                active
                  ? "border-brand-300 bg-brand-50/40"
                  : "border-surface-border bg-white hover:bg-slate-50"
              }`}
            >
              <div
                className={`mt-0.5 w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                  active ? "bg-brand-100" : "bg-slate-100"
                }`}
              >
                <Icon size={18} className={active ? "text-brand-600" : "text-slate-400"} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-semibold text-slate-800 text-sm">{label}</span>
                  <ModuleBadge label={label} color={active ? color : "slate"} />
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">{description}</p>
              </div>
              <div className="mt-1 shrink-0">
                {active ? (
                  <CheckCircle2 size={20} className="text-brand-500" />
                ) : (
                  <Circle size={20} className="text-slate-300" />
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
