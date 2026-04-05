"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

const VEHICLE_TYPES = [
  { value: "closed_container", label: "Closed Container" },
  { value: "open_trailer",     label: "Open Trailer" },
  { value: "flatbed",          label: "Flatbed" },
  { value: "tanker",           label: "Tanker" },
  { value: "refrigerated",     label: "Refrigerated" },
  { value: "mini_truck",       label: "Mini Truck" },
  { value: "pickup",           label: "Pickup" },
];

export default function PostLoadForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [form, setForm] = useState({
    commodity: "",
    weight_tonnes: "",
    vehicle_type_req: "closed_container",
    origin_address: "",
    origin_city: "",
    origin_state: "",
    origin_pincode: "",
    dest_address: "",
    dest_city: "",
    dest_state: "",
    dest_pincode: "",
    pickup_date: "",
    pickup_window_start: "",
    pickup_window_end: "",
    opening_price: "",
    auction_duration_hours: "24",
    auto_accept_lowest: false,
    notes: "",
    special_instructions: "",
  });

  function set(key) {
    return (e) => setForm((p) => ({
      ...p,
      [key]: e.target.type === "checkbox" ? e.target.checked : e.target.value,
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    startTransition(async () => {
      const res = await fetch("/api/loads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Failed to post load"); return; }
      toast.success("Load posted successfully!");
      router.push(`/dashboard/shipper/loads/${data.id}`);
    });
  }

  const inputCls = "input";
  const section = (title) => (
    <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide border-b border-surface-border pb-2 mb-4">
      {title}
    </h3>
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-8 max-w-3xl">

      {/* Cargo */}
      <div className="card space-y-4">
        {section("Cargo Details")}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Commodity *</label>
            <input className={inputCls} value={form.commodity} onChange={set("commodity")} placeholder="e.g. FMCG Goods, Steel Coils" required />
          </div>
          <div>
            <label className="label">Weight (Tonnes) *</label>
            <input className={inputCls} type="number" step="0.001" min="0.001" value={form.weight_tonnes} onChange={set("weight_tonnes")} placeholder="14.000" required />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Vehicle Type Required *</label>
            <select className={inputCls} value={form.vehicle_type_req} onChange={set("vehicle_type_req")} required>
              {VEHICLE_TYPES.map((v) => (
                <option key={v.value} value={v.value}>{v.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Origin */}
      <div className="card space-y-4">
        {section("Pickup (Origin)")}
        <div>
          <label className="label">Address *</label>
          <input className={inputCls} value={form.origin_address} onChange={set("origin_address")} placeholder="Plot 12, MIDC, Andheri East" required />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="sm:col-span-2">
            <label className="label">City *</label>
            <input className={inputCls} value={form.origin_city} onChange={set("origin_city")} placeholder="Mumbai" required />
          </div>
          <div>
            <label className="label">State *</label>
            <input className={inputCls} value={form.origin_state} onChange={set("origin_state")} placeholder="Maharashtra" required />
          </div>
          <div>
            <label className="label">Pincode</label>
            <input className={inputCls} value={form.origin_pincode} onChange={set("origin_pincode")} placeholder="400093" maxLength={6} />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="label">Pickup Date *</label>
            <input className={inputCls} type="date" value={form.pickup_date} onChange={set("pickup_date")} required />
          </div>
          <div>
            <label className="label">Window Start</label>
            <input className={inputCls} type="time" value={form.pickup_window_start} onChange={set("pickup_window_start")} />
          </div>
          <div>
            <label className="label">Window End</label>
            <input className={inputCls} type="time" value={form.pickup_window_end} onChange={set("pickup_window_end")} />
          </div>
        </div>
      </div>

      {/* Destination */}
      <div className="card space-y-4">
        {section("Delivery (Destination)")}
        <div>
          <label className="label">Address *</label>
          <input className={inputCls} value={form.dest_address} onChange={set("dest_address")} placeholder="Warehouse 5, Whitefield" required />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="sm:col-span-2">
            <label className="label">City *</label>
            <input className={inputCls} value={form.dest_city} onChange={set("dest_city")} placeholder="Bangalore" required />
          </div>
          <div>
            <label className="label">State *</label>
            <input className={inputCls} value={form.dest_state} onChange={set("dest_state")} placeholder="Karnataka" required />
          </div>
          <div>
            <label className="label">Pincode</label>
            <input className={inputCls} value={form.dest_pincode} onChange={set("dest_pincode")} placeholder="560066" maxLength={6} />
          </div>
        </div>
      </div>

      {/* Auction settings */}
      <div className="card space-y-4">
        {section("Auction Settings")}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Opening Price (₹) *</label>
            <input className={inputCls} type="number" min="1" step="1" value={form.opening_price} onChange={set("opening_price")} placeholder="85000" required />
            <p className="text-xs text-slate-400 mt-1">This is your budget ceiling — bids will start here and go lower.</p>
          </div>
          <div>
            <label className="label">Auction Duration *</label>
            <select className={inputCls} value={form.auction_duration_hours} onChange={set("auction_duration_hours")}>
              {[6, 12, 24, 48, 72].map((h) => (
                <option key={h} value={h}>{h} hours</option>
              ))}
            </select>
          </div>
        </div>
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            className="rounded border-surface-border text-brand-500 focus:ring-brand-500"
            checked={form.auto_accept_lowest}
            onChange={set("auto_accept_lowest")}
          />
          <span className="text-sm text-slate-700">Auto-accept lowest bid when auction ends</span>
        </label>
      </div>

      {/* Notes */}
      <div className="card space-y-4">
        {section("Additional Information")}
        <div>
          <label className="label">Notes</label>
          <textarea className={`${inputCls} resize-none`} rows={3} value={form.notes} onChange={set("notes")} placeholder="Any special handling requirements, loading bay info…" />
        </div>
        <div>
          <label className="label">Special Instructions for Driver</label>
          <textarea className={`${inputCls} resize-none`} rows={2} value={form.special_instructions} onChange={set("special_instructions")} placeholder="Contact site manager before entering, bring original e-way bill…" />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button type="submit" disabled={isPending} className="btn-primary px-8 py-2.5">
          {isPending ? "Posting…" : "Post Load"}
        </button>
        <button type="button" onClick={() => router.back()} className="btn-secondary px-6 py-2.5">
          Cancel
        </button>
      </div>
    </form>
  );
}
