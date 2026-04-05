"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatINR, timeUntil } from "@/lib/format";
import LoadStatusBadge from "@/components/ui/LoadStatusBadge";
import { Gavel, Clock, TrendingDown, MapPin } from "lucide-react";
import toast from "react-hot-toast";

/**
 * Live bid list with real-time Supabase Realtime subscription.
 * Used on both shipper (read-only accepts) and transporter (place bid) views.
 */
export default function LiveAuctionPanel({ load, stops = [], userType, transporterCompanyId, bidderId }) {
  const [bids, setBids] = useState([]);
  const [timeLeft, setTimeLeft] = useState(timeUntil(load.auction_end_time));
  const [bidAmount, setBidAmount] = useState("");
  const [etaDays, setEtaDays] = useState("");
  const [bidNote, setBidNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const supabase = createClient();

  const isOpen = load.status === "open" && new Date(load.auction_end_time) > new Date();

  const lowestBid = bids.length > 0 ? Math.min(...bids.map((b) => b.amount)) : load.opening_price;

  const pickups    = stops.filter((s) => s.stop_type === "pickup").sort((a, b) => a.stop_order - b.stop_order);
  const deliveries = stops.filter((s) => s.stop_type === "delivery").sort((a, b) => a.stop_order - b.stop_order);

  // Fetch initial bids
  useEffect(() => {
    supabase
      .from("bids")
      .select("id, amount, eta_days, notes, status, created_at, transporter_company:companies(name)")
      .eq("load_id", load.id)
      .eq("status", "active")
      .order("amount", { ascending: true })
      .then(({ data }) => setBids(data ?? []));
  }, [load.id]);

  // Subscribe to realtime bid changes
  useEffect(() => {
    const channel = supabase
      .channel(`bids:load_id=eq.${load.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "bids", filter: `load_id=eq.${load.id}` },
        (payload) => {
          setBids((prev) => {
            const newBid = payload.new;
            const exists = prev.some((b) => b.id === newBid.id);
            if (exists) return prev;
            const updated = [...prev, newBid].sort((a, b) => a.amount - b.amount);
            toast.success(`New bid: ${formatINR(newBid.amount)}`);
            return updated;
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "bids", filter: `load_id=eq.${load.id}` },
        (payload) => {
          setBids((prev) =>
            prev
              .map((b) => (b.id === payload.new.id ? { ...b, ...payload.new } : b))
              .filter((b) => b.status === "active")
              .sort((a, b) => a.amount - b.amount)
          );
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [load.id]);

  // Countdown timer
  useEffect(() => {
    const interval = setInterval(() => setTimeLeft(timeUntil(load.auction_end_time)), 10_000);
    return () => clearInterval(interval);
  }, [load.auction_end_time]);

  const placeBid = useCallback(async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch(`/api/loads/${load.id}/bids`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: Number(bidAmount),
          eta_days: etaDays ? Number(etaDays) : null,
          notes: bidNote,
        }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Bid failed"); return; }
      toast.success("Bid placed successfully!");
      setBidAmount("");
      setBidNote("");
    } finally {
      setSubmitting(false);
    }
  }, [load.id, bidAmount, etaDays, bidNote]);

  const acceptBid = useCallback(async (bidId) => {
    const yes = window.confirm("Accept this bid? This will close the auction and create a trip.");
    if (!yes) return;
    const res = await fetch(`/api/loads/${load.id}/accept`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bid_id: bidId }),
    });
    const data = await res.json();
    if (!res.ok) { toast.error(data.error || "Accept failed"); return; }
    toast.success("Bid accepted! Trip created.");
    window.location.reload();
  }, [load.id]);

  return (
    <div className="space-y-6">
      {/* Auction header */}
      <div className="card">
        <div className="flex flex-wrap gap-4 items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              {load.origin_city} → {load.dest_city}
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              {load.commodity} · {load.weight_tonnes} T · {load.vehicle_type_req?.replace(/_/g, " ")}
            </p>
          </div>
          <LoadStatusBadge status={load.status} />
        </div>

        <div className="mt-4 grid grid-cols-3 gap-4">
          <div className="text-center p-3 rounded-lg bg-slate-50">
            <p className="text-xs text-slate-500 mb-1">Opening Price</p>
            <p className="text-base font-bold text-slate-700">{formatINR(load.opening_price)}</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-green-50">
            <p className="text-xs text-slate-500 mb-1 flex items-center justify-center gap-1"><TrendingDown size={12} /> Lowest Bid</p>
            <p className="text-base font-bold text-green-700">{formatINR(lowestBid)}</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-brand-50">
            <p className="text-xs text-slate-500 mb-1 flex items-center justify-center gap-1"><Clock size={12} /> Time Left</p>
            <p className={`text-base font-bold ${isOpen ? "text-brand-700" : "text-red-600"}`}>{timeLeft}</p>
          </div>
        </div>
      </div>

      {/* Route — pickup and delivery stops */}
      {(pickups.length > 0 || deliveries.length > 0) && (
        <div className="card">
          <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <MapPin size={16} /> Route Details
          </h3>
          <div className="space-y-5">
            {pickups.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-2">
                  Pickup {pickups.length > 1 ? "Points" : "Point"}
                </p>
                <div className="space-y-3">
                  {pickups.map((stop, idx) => (
                    <div key={stop.id} className="flex items-start gap-2.5">
                      <span className="text-xs font-bold text-white bg-green-600 rounded-full w-5 h-5 flex items-center justify-center shrink-0 mt-0.5">
                        {idx + 1}
                      </span>
                      <div>
                        <p className="text-sm font-medium text-slate-800">
                          {stop.city}{stop.state ? `, ${stop.state}` : ""}
                        </p>
                        <p className="text-xs text-slate-500">
                          {stop.address}{stop.pincode ? ` — ${stop.pincode}` : ""}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {deliveries.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-red-600 uppercase tracking-wide mb-2">
                  Delivery {deliveries.length > 1 ? "Points" : "Point"}
                </p>
                <div className="space-y-3">
                  {deliveries.map((stop, idx) => (
                    <div key={stop.id} className="flex items-start gap-2.5">
                      <span className="text-xs font-bold text-white bg-red-500 rounded-full w-5 h-5 flex items-center justify-center shrink-0 mt-0.5">
                        {idx + 1}
                      </span>
                      <div>
                        <p className="text-sm font-medium text-slate-800">
                          {stop.city}{stop.state ? `, ${stop.state}` : ""}
                        </p>
                        <p className="text-xs text-slate-500">
                          {stop.address}{stop.pincode ? ` — ${stop.pincode}` : ""}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Place bid (transporter only) */}
      {userType === "transporter" && isOpen && (
        <div className="card">
          <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Gavel size={16} /> Place Your Bid
          </h3>
          <form onSubmit={placeBid} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Your Bid Amount (₹) *</label>
                <input
                  className="input"
                  type="number" min="1" step="1"
                  value={bidAmount}
                  onChange={(e) => setBidAmount(e.target.value)}
                  placeholder={`Max: ${formatINR(lowestBid - 100)}`}
                  required
                />
                <p className="text-xs text-slate-400 mt-1">
                  Must be at least ₹100 lower than current lowest ({formatINR(lowestBid)})
                </p>
              </div>
              <div>
                <label className="label">Transit Days</label>
                <input className="input" type="number" min="1" step="1" value={etaDays} onChange={(e) => setEtaDays(e.target.value)} placeholder="e.g. 2" />
              </div>
            </div>
            <div>
              <label className="label">Notes (optional)</label>
              <input className="input" value={bidNote} onChange={(e) => setBidNote(e.target.value)} placeholder="Vehicle available, door-to-door, etc." />
            </div>
            <button type="submit" disabled={submitting} className="btn-primary px-6">
              {submitting ? "Placing bid…" : "Place Bid"}
            </button>
          </form>
        </div>
      )}

      {/* Bid list */}
      <div className="card">
        <h3 className="font-semibold text-slate-900 mb-4">
          Live Bids ({bids.length})
        </h3>
        {bids.length === 0 ? (
          <p className="text-sm text-slate-400 py-6 text-center">No bids yet. Be the first!</p>
        ) : (
          <div className="space-y-3">
            {bids.map((bid, idx) => (
              <div
                key={bid.id}
                className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                  idx === 0
                    ? "border-green-300 bg-green-50"
                    : "border-surface-border bg-white"
                }`}
              >
                <div>
                  <div className="flex items-center gap-2">
                    {idx === 0 && (
                      <span className="text-xs font-semibold text-green-700 bg-green-100 rounded-full px-2 py-0.5">
                        Lowest
                      </span>
                    )}
                    <span className="text-sm font-bold text-slate-900">
                      {formatINR(bid.amount)}
                    </span>
                    {bid.eta_days && (
                      <span className="text-xs text-slate-400">· {bid.eta_days}d transit</span>
                    )}
                  </div>
                  {bid.notes && <p className="text-xs text-slate-500 mt-0.5">{bid.notes}</p>}
                  {bid.transporter_company?.name && (
                    <p className="text-xs text-slate-400 mt-0.5">{bid.transporter_company.name}</p>
                  )}
                </div>
                {userType === "shipper" && load.status === "open" && (
                  <button
                    onClick={() => acceptBid(bid.id)}
                    className="btn-primary text-xs px-3 py-1.5"
                  >
                    Accept
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
