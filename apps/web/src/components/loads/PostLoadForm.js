"use client";

import { useState, useTransition, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import PlacesAutocomplete from "./PlacesAutocomplete";
import StopsMap from "./StopsMap";

// A blank stop template
const emptyStop = () => ({ address: "", city: "", state: "", pincode: "", lat: null, lng: null });

// ─── StopEditor lives at module level so React never remounts it on re-render ───
function StopEditor({ stops, onUpdate, onAdd, onRemove, type, label, mapsLoaded, initialValues }) {
  return (
    <div className="card space-y-4">
      <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide border-b border-surface-border pb-2 mb-4">
        {label}
      </h3>

      {stops.map((stop, idx) => (
        <div key={idx} className="border border-surface-border rounded-lg p-4 space-y-3 bg-slate-50">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              {type === "pickup" ? "Pickup" : "Delivery"} {idx + 1}
            </span>
            {stops.length > 1 && (
              <button
                type="button"
                onClick={() => onRemove(idx)}
                className="text-xs text-red-500 hover:text-red-700"
              >
                Remove
              </button>
            )}
          </div>

          <div>
            <label className="label">Address *</label>
            <PlacesAutocomplete
              key={`${type}-${idx}-ac-${initialValues?.[idx] ?? ""}`}
              value={stop.address}
              initialValue={initialValues?.[idx]}
              mapsLoaded={mapsLoaded}
              placeholder={type === "pickup" ? "Plot 12, MIDC, Andheri East" : "Warehouse 5, Whitefield"}
              required={idx === 0}
              onChange={(place) => onUpdate(idx, place)}
            />
          </div>

          {(stop.city || stop.state || stop.pincode) ? (
            <div className="flex flex-wrap items-center gap-2 mt-1">
              {stop.city && (
                <span className="text-xs bg-slate-100 text-slate-700 rounded px-2.5 py-1 font-medium">
                  {stop.city}
                </span>
              )}
              {stop.state && (
                <span className="text-xs bg-slate-100 text-slate-700 rounded px-2.5 py-1 font-medium">
                  {stop.state}
                </span>
              )}
              {stop.pincode && (
                <span className="text-xs bg-slate-100 text-slate-700 rounded px-2.5 py-1 font-mono">
                  {stop.pincode}
                </span>
              )}
            </div>
          ) : (
            <p className="text-xs text-slate-400 mt-1">
              City, state &amp; pincode will be filled automatically after selecting an address.
            </p>
          )}
        </div>
      ))}

      <button
        type="button"
        onClick={onAdd}
        className="btn-secondary text-sm w-full"
      >
        + Add {type === "pickup" ? "Pickup" : "Delivery"} Stop
      </button>
    </div>
  );
}
// ────────────────────────────────────────────────────────────────────────────────

export default function PostLoadForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [mapsLoaded, setMapsLoaded] = useState(false);

  useEffect(() => {
    if (window.google?.maps) { setMapsLoaded(true); return; }
    const handler = () => setMapsLoaded(true);
    window.addEventListener("google-maps-loaded", handler);
    return () => window.removeEventListener("google-maps-loaded", handler);
  }, []);

  const [allowedTypes, setAllowedTypes] = useState(null);
  const [typesError, setTypesError] = useState(null);

  const [branches, setBranches] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState("");

  useEffect(() => {
    fetch("/api/loads/allowed-types")
      .then((res) => res.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setAllowedTypes(data);
      })
      .catch((e) => setTypesError(e.message || "Failed to load types"));
  }, []);

  // Core fields
  const [form, setForm] = useState({
    commodity: "",
    weight_tonnes: "",
    vehicle_type_req: "",
    pickup_date: "",
    pickup_window_start: "",
    pickup_window_end: "",
    opening_price: "",
    auction_duration_minutes: "15",
    bid_start_time: "",
    extension_trigger_minutes: "3",
    extension_add_minutes: "5",
    extension_max_count: "3",
    auto_accept_lowest: false,
    notes: "",
    special_instructions: "",
  });

  // Fetch branches on mount
  useEffect(() => {
    fetch("/api/company/branches")
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setBranches(data); })
      .catch(() => {});
  }, []);

  // When branch changes: fetch branch auction defaults + seed first pickup address
  const handleBranchChange = useCallback(async (branchId) => {
    setSelectedBranch(branchId);

    if (!branchId) return;

    const branch = branches.find((b) => b.id === branchId);
    if (!branch) return;

    // Pre-seed first pickup stop with branch address (only if it's still empty)
    setPickupStops((prev) => {
      const first = prev[0];
      if (first.address || first.city) return prev; // already has data — don't overwrite
      const seeded = {
        address:  branch.address_line1 || "",
        city:     branch.city         || "",
        state:    branch.state        || "",
        pincode:  branch.pincode      || "",
        lat:      branch.lat,
        lng:      branch.lng,
      };
      return [seeded, ...prev.slice(1)];
    });

    // Fetch branch auction settings (falls back to company then hardcoded inside API)
    try {
      const res = await fetch(`/api/company/auction-settings?branch_id=${branchId}`);
      const data = await res.json();
      if (!data.error) {
        setForm((prev) => ({
          ...prev,
          auction_duration_minutes:  String(data.auction_duration_minutes),
          extension_trigger_minutes: String(data.extension_trigger_minutes),
          extension_add_minutes:     String(data.extension_add_minutes),
          extension_max_count:       String(data.extension_max_count),
        }));
      }
    } catch (_) {}
  }, [branches]);

  // Prefetch company auction defaults and apply to form
  useEffect(() => {
    fetch("/api/company/auction-settings")
      .then((r) => r.json())
      .then((data) => {
        if (!data.error) {
          setForm((prev) => ({
            ...prev,
            auction_duration_minutes:  String(data.auction_duration_minutes),
            extension_trigger_minutes: String(data.extension_trigger_minutes),
            extension_add_minutes:     String(data.extension_add_minutes),
            extension_max_count:       String(data.extension_max_count),
          }));
        }
      })
      .catch(() => {}); // fail silently — form already has sensible defaults
  }, []);

  // Separate pickup / delivery stop lists
  const [pickupStops, setPickupStops] = useState([emptyStop()]);
  const [deliveryStops, setDeliveryStops] = useState([emptyStop()]);

  function setField(key) {
    return (e) =>
      setForm((p) => ({
        ...p,
        [key]: e.target.type === "checkbox" ? e.target.checked : e.target.value,
      }));
  }

  const updatePickup = useCallback((idx, patch) => {
    setPickupStops((prev) => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  }, []);

  const updateDelivery = useCallback((idx, patch) => {
    setDeliveryStops((prev) => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  }, []);

  const addPickup = useCallback(() => setPickupStops((p) => [...p, emptyStop()]), []);
  const addDelivery = useCallback(() => setDeliveryStops((p) => [...p, emptyStop()]), []);

  const removePickup = useCallback((idx) => {
    setPickupStops((prev) => prev.length === 1 ? prev : prev.filter((_, i) => i !== idx));
  }, []);
  const removeDelivery = useCallback((idx) => {
    setDeliveryStops((prev) => prev.length === 1 ? prev : prev.filter((_, i) => i !== idx));
  }, []);

  // All stops for the map
  const allStops = [
    ...pickupStops.map((s) => ({ ...s, stop_type: "pickup" })),
    ...deliveryStops.map((s) => ({ ...s, stop_type: "delivery" })),
  ];

  // Set default vehicle type once types load
  useEffect(() => {
    if (allowedTypes) {
      setForm((prev) => ({
        ...prev,
        vehicle_type_req: prev.vehicle_type_req || (allowedTypes.vehicleTypes[0]?.key ?? ""),
      }));
    }
  }, [allowedTypes]);

  async function handleSubmit(e) {
    e.preventDefault();

    const validPickups = pickupStops.filter((s) => s.address || s.city);
    const validDeliveries = deliveryStops.filter((s) => s.address || s.city);
    if (!selectedBranch) { toast.error("Please select a branch"); return; }
    if (!validPickups.length) { toast.error("Add at least one pickup stop"); return; }
    if (!validDeliveries.length) { toast.error("Add at least one delivery stop"); return; }

    const auctionMins = Number(form.auction_duration_minutes ?? 15);
    if (auctionMins < 1) { toast.error("Auction duration must be at least 1 minute"); return; }
    if (form.bid_start_time) {
      const bidStart = new Date(form.bid_start_time);
      if (isNaN(bidStart.getTime())) { toast.error("Invalid bid start time"); return; }
      if (bidStart <= new Date()) { toast.error("Bid start time must be in the future"); return; }
    }

    startTransition(async () => {
      const res = await fetch("/api/loads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          branch_id: selectedBranch,
          // First pickup / last delivery used as the canonical origin/dest for legacy fields
          origin_city: validPickups[0].city,
          origin_state: validPickups[0].state,
          origin_address: validPickups[0].address,
          origin_pincode: validPickups[0].pincode,
          dest_city: validDeliveries[validDeliveries.length - 1].city,
          dest_state: validDeliveries[validDeliveries.length - 1].state,
          dest_address: validDeliveries[validDeliveries.length - 1].address,
          dest_pincode: validDeliveries[validDeliveries.length - 1].pincode,
          stops: [
            ...validPickups.map((s, i) => ({ ...s, stop_type: "pickup", stop_order: i })),
            ...validDeliveries.map((s, i) => ({ ...s, stop_type: "delivery", stop_order: i })),
          ],
        }),
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
    <>
      <form onSubmit={handleSubmit} className="space-y-8 max-w-3xl">

        {/* Branch selector */}
        <div className="card space-y-4">
          {section("Branch")}
          <div>
            <label className="label">Branch *</label>
            {branches.length === 0 ? (
              <div className="input bg-slate-50 text-slate-400">
                {branches.length === 0 ? "No active branches found. Ask your account owner to add branches." : "Loading…"}
              </div>
            ) : (
              <select
                className={inputCls}
                value={selectedBranch}
                onChange={(e) => handleBranchChange(e.target.value)}
                required
              >
                <option value="" disabled>Select branch…</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}{b.city ? ` – ${b.city}` : ""}</option>
                ))}
              </select>
            )}
            <p className="text-xs text-slate-400 mt-1">
              Selecting a branch pre-fills the pickup address and loads branch-level auction settings.
            </p>
          </div>
        </div>

        {/* Cargo */}
        <div className="card space-y-4">
          {section("Cargo Details")}

          {typesError && (
            <div className="bg-red-50 text-red-700 text-sm rounded-lg px-4 py-3">
              {typesError}. Please refresh or contact an admin.
            </div>
          )}

          {!typesError && allowedTypes?.commodities.length === 0 && (
            <div className="bg-yellow-50 text-yellow-700 text-sm rounded-lg px-4 py-3">
              No commodity types have been allotted to your company yet. Contact an admin.
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Commodity *</label>
              {allowedTypes === null ? (
                <div className="input bg-slate-50 text-slate-400">Loading…</div>
              ) : (
                <select
                  className={inputCls}
                  value={form.commodity}
                  onChange={setField("commodity")}
                  required
                  disabled={!allowedTypes.commodities.length}
                >
                  <option value="" disabled>Select commodity…</option>
                  {allowedTypes.commodities.map((c) => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                  ))}
                </select>
              )}
            </div>
            <div>
              <label className="label">Weight (Tonnes) *</label>
              <input className={inputCls} type="number" step="0.001" min="0.001" value={form.weight_tonnes} onChange={setField("weight_tonnes")} placeholder="14.000" required />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Vehicle Type Required *</label>
              {allowedTypes === null ? (
                <div className="input bg-slate-50 text-slate-400">Loading…</div>
              ) : (
                <select
                  className={inputCls}
                  value={form.vehicle_type_req}
                  onChange={setField("vehicle_type_req")}
                  required
                  disabled={!allowedTypes.vehicleTypes.length}
                >
                  <option value="" disabled>Select vehicle type…</option>
                  {allowedTypes.vehicleTypes.map((v) => (
                    <option key={v.key} value={v.key}>{v.label}</option>
                  ))}
                </select>
              )}
            </div>
          </div>
        </div>

        {/* Pickup Stops */}
        <StopEditor
          stops={pickupStops}
          onUpdate={updatePickup}
          onAdd={addPickup}
          onRemove={removePickup}
          type="pickup"
          label="Pickup Stops"
          mapsLoaded={mapsLoaded}
          initialValues={(() => {
            const branch = branches.find((b) => b.id === selectedBranch);
            return branch ? [branch.address_line1 || branch.city || ""] : undefined;
          })()}
        />

        {/* Pickup schedule */}
        <div className="card space-y-4">
          {section("Pickup Schedule")}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="label">Pickup Date *</label>
              <input className={inputCls} type="date" value={form.pickup_date} onChange={setField("pickup_date")} required />
            </div>
            <div>
              <label className="label">Window Start</label>
              <input className={inputCls} type="time" value={form.pickup_window_start} onChange={setField("pickup_window_start")} />
            </div>
            <div>
              <label className="label">Window End</label>
              <input className={inputCls} type="time" value={form.pickup_window_end} onChange={setField("pickup_window_end")} />
            </div>
          </div>
        </div>

        {/* Delivery Stops */}
        <StopEditor
          stops={deliveryStops}
          onUpdate={updateDelivery}
          onAdd={addDelivery}
          onRemove={removeDelivery}
          type="delivery"
          label="Delivery Stops"
          mapsLoaded={mapsLoaded}
        />

        {/* Live Route Map */}
        <div className="card space-y-4">
          {section("Route Preview")}
          <StopsMap stops={allStops} mapsLoaded={mapsLoaded} />
        </div>

        {/* Auction settings */}
        <div className="card space-y-4">
          {section("Auction Settings")}

          {/* Timing */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Opening Price (₹) *</label>
              <input className={inputCls} type="number" min="1" step="1" value={form.opening_price} onChange={setField("opening_price")} placeholder="85000" required />
              <p className="text-xs text-slate-400 mt-1">Budget ceiling — bids start here and go lower.</p>
            </div>
            <div>
              <label className="label">Auction Duration (minutes) *</label>
              <input className={inputCls} type="number" min="1" step="1" value={form.auction_duration_minutes} onChange={setField("auction_duration_minutes")} placeholder="15" required />
              <p className="text-xs text-slate-400 mt-1">Total duration of the auction from now.</p>
            </div>
            <div className="sm:col-span-2">
              <label className="label">Bid Start Time (Open Phase)</label>
              <input
                className={inputCls}
                type="datetime-local"
                value={form.bid_start_time}
                onChange={setField("bid_start_time")}
              />
              <p className="text-xs text-slate-400 mt-1">
                The time when open bidding begins. Leave blank to start open bidding immediately.
                The period from now until this time is the sealed (blind) phase — bids are hidden from everyone.
              </p>
            </div>
          </div>

          {/* Auto-extension */}
          <div className="border border-surface-border rounded-lg px-4 py-3 space-y-3">
            <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Auto-extension</p>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="label">Trigger (last X min)</label>
                <input className={inputCls} type="number" min="0" step="1" value={form.extension_trigger_minutes} onChange={setField("extension_trigger_minutes")} placeholder="3" />
              </div>
              <div>
                <label className="label">Extend by (min)</label>
                <input className={inputCls} type="number" min="1" step="1" value={form.extension_add_minutes} onChange={setField("extension_add_minutes")} placeholder="5" />
              </div>
              <div>
                <label className="label">Max extensions</label>
                <input className={inputCls} type="number" min="0" step="1" value={form.extension_max_count} onChange={setField("extension_max_count")} placeholder="3" />
              </div>
            </div>
            <p className="text-xs text-slate-400">
              If a bid is placed in the last{" "}
              <strong>{form.extension_trigger_minutes || "X"}</strong> min, the auction extends by{" "}
              <strong>{form.extension_add_minutes || "Y"}</strong> min — up to{" "}
              <strong>{form.extension_max_count || "0"}</strong> time{Number(form.extension_max_count) !== 1 ? "s" : ""}.
              Set max extensions to 0 to disable.
            </p>
          </div>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              className="rounded border-surface-border text-brand-500 focus:ring-brand-500"
              checked={form.auto_accept_lowest}
              onChange={setField("auto_accept_lowest")}
            />
            <span className="text-sm text-slate-700">Auto-accept lowest bid when auction ends</span>
          </label>
        </div>

        {/* Notes */}
        <div className="card space-y-4">
          {section("Additional Information")}
          <div>
            <label className="label">Notes</label>
            <textarea className={`${inputCls} resize-none`} rows={3} value={form.notes} onChange={setField("notes")} placeholder="Any special handling requirements, loading bay info…" />
          </div>
          <div>
            <label className="label">Special Instructions for Driver</label>
            <textarea className={`${inputCls} resize-none`} rows={2} value={form.special_instructions} onChange={setField("special_instructions")} placeholder="Contact site manager before entering, bring original e-way bill…" />
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
    </>
  );
}
