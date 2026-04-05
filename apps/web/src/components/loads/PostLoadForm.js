"use client";

import { useState, useTransition, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Script from "next/script";
import toast from "react-hot-toast";
import PlacesAutocomplete from "./PlacesAutocomplete";
import StopsMap from "./StopsMap";

// A blank stop template
const emptyStop = () => ({ address: "", city: "", state: "", pincode: "", lat: null, lng: null });

// ─── StopEditor lives at module level so React never remounts it on re-render ───
function StopEditor({ stops, onUpdate, onAdd, onRemove, type, label, mapsLoaded }) {
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
              key={`${type}-${idx}-ac`}
              value={stop.address}
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

  const [allowedTypes, setAllowedTypes] = useState(null);
  const [typesError, setTypesError] = useState(null);

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
    auction_duration_hours: "24",
    auto_accept_lowest: false,
    notes: "",
    special_instructions: "",
  });

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
    if (!validPickups.length) { toast.error("Add at least one pickup stop"); return; }
    if (!validDeliveries.length) { toast.error("Add at least one delivery stop"); return; }

    startTransition(async () => {
      const res = await fetch("/api/loads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
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
      {/* Load Google Maps JS API — v=beta required for PlaceAutocompleteElement */}
      <Script
        src={`https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=places,marker&v=beta`}
        onLoad={() => setMapsLoaded(true)}
        strategy="lazyOnload"
      />

      <form onSubmit={handleSubmit} className="space-y-8 max-w-3xl">

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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Opening Price (₹) *</label>
              <input className={inputCls} type="number" min="1" step="1" value={form.opening_price} onChange={setField("opening_price")} placeholder="85000" required />
              <p className="text-xs text-slate-400 mt-1">This is your budget ceiling — bids will start here and go lower.</p>
            </div>
            <div>
              <label className="label">Auction Duration *</label>
              <select className={inputCls} value={form.auction_duration_hours} onChange={setField("auction_duration_hours")}>
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
