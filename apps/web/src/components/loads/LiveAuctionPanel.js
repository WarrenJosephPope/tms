"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatINR, timeUntil } from "@/lib/format";
import LoadStatusBadge from "@/components/ui/LoadStatusBadge";
import { Gavel, Clock, TrendingDown, MapPin, EyeOff, Trophy } from "lucide-react";
import toast from "react-hot-toast";

/**
 * Live auction panel supporting two modes:
 *
 * BLIND PHASE  (load.bid_start_time is set and has not yet passed)
 *   • Transporters can place/update a single sealed bid (< opening_price).
 *   • Transporters see only their own bid and their live position.
 *   • Shippers see a count of sealed bids but no identities or amounts.
 *
 * OPEN PHASE  (bid_start_time is null, or it has passed)
 *   • Shippers see the full bid list with Accept buttons.
 *   • Transporters see only their own bid and live position — never other
 *     transporters' amounts or identities.
 */
export default function LiveAuctionPanel({ load, stops = [], userType }) {
  // ── Derived constants ──────────────────────────────────────────────────────
  const bidStartTime = load.bid_start_time ? new Date(load.bid_start_time) : null;

  // ── State ──────────────────────────────────────────────────────────────────
  // auctionEndTime is mutable: auto-extension updates it via realtime
  const [auctionEndTime, setAuctionEndTime] = useState(new Date(load.auction_end_time));
  const [extensionCount, setExtensionCount] = useState(load.extension_count ?? 0);
  // lastExtended: how many minutes the most recent extension added (null = none yet)
  const [lastExtended, setLastExtended] = useState(null);
  const extensionMaxCount = load.extension_max_count ?? 0;

  // isAuctionOpen is intentionally NOT used as a subscription guard — doing so
  // creates a race condition where the 1s timer flips it to false in the last
  // second, tears down the subscription, and the extension event is lost.
  // Instead we derive it fresh every render and only use it to control UI.
  const isAuctionOpen = load.status === "open" && auctionEndTime > new Date();

  const [auctionStarted, setAuctionStarted] = useState(
    !bidStartTime || new Date() >= bidStartTime
  );
  const [timeLeft,    setTimeLeft]    = useState(timeUntil(auctionEndTime.toISOString()));
  const [timeToStart, setTimeToStart] = useState(
    bidStartTime ? timeUntil(bidStartTime.toISOString()) : null
  );

  // Shipper: full bid list (only populated after auction started)
  const [bids, setBids] = useState([]);
  // Shipper: sealed-bid count during blind phase
  const [blindBidCount, setBlindBidCount] = useState(null);

  // Transporter: own best bid + rank
  const [myPosition, setMyPosition] = useState(null); // { bid_id, amount, position, total_bids }

  // Bid form
  const [bidAmount, setBidAmount] = useState("");
  const [etaDays,   setEtaDays]   = useState("");
  const [bidNote,   setBidNote]   = useState("");
  const [submitting, setSubmitting] = useState(false);

  const supabase = createClient();

  const pickups    = stops.filter((s) => s.stop_type === "pickup").sort((a, b) => a.stop_order - b.stop_order);
  const deliveries = stops.filter((s) => s.stop_type === "delivery").sort((a, b) => a.stop_order - b.stop_order);

  // ── Data fetchers ──────────────────────────────────────────────────────────

  const fetchPosition = useCallback(async () => {
    const res = await fetch(`/api/loads/${load.id}/bids/position`);
    if (res.ok) setMyPosition(await res.json());
  }, [load.id]);

  const fetchBids = useCallback(async () => {
    const res = await fetch(`/api/loads/${load.id}/bids`);
    if (res.ok) {
      const data = await res.json();
      setBids(Array.isArray(data) ? data : []);
    }
  }, [load.id]);

  const fetchBlindCount = useCallback(async () => {
    const res = await fetch(`/api/loads/${load.id}/bids/count`);
    if (res.ok) {
      const data = await res.json();
      setBlindBidCount(data.count);
    }
  }, [load.id]);

  // ── Initial data load ──────────────────────────────────────────────────────
  useEffect(() => {
    if (userType === "transporter") {
      fetchPosition();
      // Pre-populate bid form with the transporter's existing active bid (if any).
      // RLS ensures only their own company's bids are returned.
      supabase
        .from("bids")
        .select("amount, eta_days, notes")
        .eq("load_id", load.id)
        .eq("status", "active")
        .limit(1)
        .then(({ data }) => {
          if (data?.[0]) {
            setBidAmount(String(data[0].amount));
            setEtaDays(data[0].eta_days ? String(data[0].eta_days) : "");
            setBidNote(data[0].notes ?? "");
          }
        });
    } else if (userType === "shipper") {
      if (auctionStarted) {
        fetchBids();
      } else {
        fetchBlindCount();
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Realtime subscription (bids + loads) ──────────────────────────────────
  // Gated on load.status only — NOT on auctionEndTime/isAuctionOpen, so it stays
  // alive through the final seconds and correctly receives extension events.
  useEffect(() => {
    if (load.status !== "open") return;

    const channel = supabase
      .channel(`auction-panel:${load.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "bids", filter: `load_id=eq.${load.id}` },
        () => {
          if (userType === "transporter") fetchPosition();
          else if (auctionStarted) fetchBids();
          else fetchBlindCount();
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "bids", filter: `load_id=eq.${load.id}` },
        () => {
          if (userType === "transporter") fetchPosition();
          else if (auctionStarted) fetchBids();
          else fetchBlindCount();
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "loads", filter: `id=eq.${load.id}` },
        (payload) => {
          const newEnd = payload.new?.auction_end_time;
          const newCount = payload.new?.extension_count;

          if (newEnd) {
            const next = new Date(newEnd);
            setAuctionEndTime((prev) => {
              // Calculate added minutes BEFORE updating state so we can show the banner
              if (next.getTime() > prev.getTime()) {
                const addedMin = Math.round((next.getTime() - prev.getTime()) / 60_000);
                // Schedule side effects outside the updater
                setTimeout(() => {
                  setLastExtended(addedMin);
                  toast.success(`⏱️ Auction extended by ${addedMin} min!`);
                }, 0);
              }
              return next;
            });
          }
          if (newCount !== undefined) {
            setExtensionCount(newCount);
          }
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load.id, load.status, auctionStarted, userType]);

  // ── Immediately sync timeLeft when auctionEndTime changes (extension) ──────
  // The 1s interval would take up to 1s to reflect the new end time; this effect
  // fires synchronously on the same render so all clients see the updated time
  // the moment they receive the realtime event.
  useEffect(() => {
    setTimeLeft(timeUntil(auctionEndTime.toISOString()));
  }, [auctionEndTime]);

  // ── Countdown & phase-transition timer (1 s for sub-minute precision) ──────
  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft(timeUntil(auctionEndTime.toISOString()));
      if (bidStartTime) {
        const remaining = timeUntil(bidStartTime.toISOString());
        setTimeToStart(remaining);
        if (!auctionStarted && new Date() >= bidStartTime) {
          setAuctionStarted(true);
          if (userType === "shipper") fetchBids();
          else fetchPosition();
        }
      }
    }, 1_000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auctionEndTime, bidStartTime, auctionStarted, userType]);

  // ── Position polling (10 s — rank changes don't need second precision) ──────
  useEffect(() => {
    if (userType !== "transporter") return;
    const interval = setInterval(fetchPosition, 10_000);
    return () => clearInterval(interval);
  }, [fetchPosition, userType]);

  // ── Actions ────────────────────────────────────────────────────────────────
  const placeBid = useCallback(async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch(`/api/loads/${load.id}/bids`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount:   Number(bidAmount),
          eta_days: etaDays ? Number(etaDays) : null,
          notes:    bidNote,
        }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Bid failed"); return; }
      toast.success(auctionStarted ? "Bid placed!" : "Sealed bid submitted!");
      await fetchPosition();
    } finally {
      setSubmitting(false);
    }
  }, [load.id, bidAmount, etaDays, bidNote, auctionStarted, fetchPosition]);

  const acceptBid = useCallback(async (bidId) => {
    if (!window.confirm("Accept this bid? This will close the auction and create a trip.")) return;
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

  // ── Derived display values ─────────────────────────────────────────────────
  const lowestBid = bids.length > 0 ? Math.min(...bids.map((b) => b.amount)) : load.opening_price;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* ── Auction header ── */}
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
          {/* Opening price — always visible */}
          <div className="text-center p-3 rounded-lg bg-slate-50">
            <p className="text-xs text-slate-500 mb-1">Opening Price</p>
            <p className="text-base font-bold text-slate-700">{formatINR(load.opening_price)}</p>
          </div>

          {/* Middle tile: depends on phase & role */}
          {!auctionStarted ? (
            <div className="text-center p-3 rounded-lg bg-amber-50">
              <p className="text-xs text-amber-600 mb-1 flex items-center justify-center gap-1">
                <EyeOff size={12} /> Bidding Opens
              </p>
              <p className="text-base font-bold text-amber-700">{timeToStart}</p>
            </div>
          ) : userType === "transporter" && myPosition ? (
            <div className="text-center p-3 rounded-lg bg-green-50">
              <p className="text-xs text-slate-500 mb-1">Your Bid</p>
              <p className="text-base font-bold text-green-700">{formatINR(myPosition.amount)}</p>
            </div>
          ) : userType === "shipper" ? (
            <div className="text-center p-3 rounded-lg bg-green-50">
              <p className="text-xs text-slate-500 mb-1 flex items-center justify-center gap-1">
                <TrendingDown size={12} /> Lowest Bid
              </p>
              <p className="text-base font-bold text-green-700">{formatINR(lowestBid)}</p>
            </div>
          ) : (
            <div className="text-center p-3 rounded-lg bg-slate-50">
              <p className="text-xs text-slate-500 mb-1">Your Bid</p>
              <p className="text-base font-bold text-slate-400">—</p>
            </div>
          )}

          {/* Time left + extension badge */}
          <div className="text-center p-3 rounded-lg bg-brand-50">
            <p className="text-xs text-slate-500 mb-1 flex items-center justify-center gap-1">
              <Clock size={12} /> Time Left
            </p>
            <p className={`text-base font-bold ${isAuctionOpen ? "text-brand-700" : "text-red-600"}`}>
              {timeLeft}
            </p>
            {extensionMaxCount > 0 && (
              <p className="text-xs mt-1 text-slate-500">
                &#9889; {extensionCount}/{extensionMaxCount} ext.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── Extension banner (shown to all clients when an extension fires) ── */}
      {lastExtended !== null && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 flex items-center gap-3">
          <Clock size={18} className="text-blue-500 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-blue-800">
              Auction extended by {lastExtended} min
            </p>
            <p className="text-xs text-blue-600 mt-0.5">
              A bid was placed in the final window — extra time added.
              {extensionMaxCount > 0 && ` (${extensionCount}/${extensionMaxCount} extensions used)`}
            </p>
          </div>
          <button
            onClick={() => setLastExtended(null)}
            className="text-blue-400 hover:text-blue-600 text-lg leading-none"
            aria-label="Dismiss"
          >
            &#x2715;
          </button>
        </div>
      )}

      {/* ── Route details ── */}
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

      {/* ── TRANSPORTER: blind-phase banner ── */}
      {userType === "transporter" && !auctionStarted && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 flex items-start gap-3">
          <EyeOff size={18} className="text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800">Sealed Bidding Phase</p>
            <p className="text-xs text-amber-700 mt-0.5">
              Your bid is sealed and invisible to the shipper until bidding opens.
              You can update your bid any time before then.
            </p>
          </div>
        </div>
      )}

      {/* ── TRANSPORTER: position card (shown once they have a bid) ── */}
      {userType === "transporter" && myPosition && (
        <div className={`card border-2 ${myPosition.bid_position === 1 ? "border-green-400 bg-green-50" : "border-slate-200"}`}>
          <div className="flex items-center gap-3">
            <Trophy
              size={22}
              className={myPosition.bid_position === 1 ? "text-green-600" : "text-slate-400"}
            />
            <div>
              <p className="font-semibold text-slate-900">
                Position{" "}
                <span className={myPosition.bid_position === 1 ? "text-green-700" : "text-slate-700"}>
                  #{myPosition.bid_position}
                </span>
                <span className="text-sm font-normal text-slate-500 ml-1">
                  of {myPosition.total_bids} {Number(myPosition.total_bids) === 1 ? "bid" : "bids"}
                </span>
              </p>
              <p className="text-sm text-slate-600 mt-0.5">
                Your bid: <span className="font-semibold">{formatINR(myPosition.amount)}</span>
              </p>
            </div>
            {myPosition.bid_position === 1 && (
              <span className="ml-auto text-xs font-semibold text-green-700 bg-green-100 rounded-full px-3 py-1">
                Lowest — leading!
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── TRANSPORTER: bid form ── */}
      {userType === "transporter" && isAuctionOpen && (
        <div className="card">
          <h3 className="font-semibold text-slate-900 mb-1 flex items-center gap-2">
            <Gavel size={16} />
            {myPosition ? "Update Your Bid" : "Place Your Bid"}
          </h3>
          {!auctionStarted && (
            <p className="text-xs text-amber-600 mb-4">
              Sealed phase — submit your best price. You can revise it until bidding opens.
            </p>
          )}
          <form onSubmit={placeBid} className="space-y-4 mt-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Your Bid Amount (₹) *</label>
                <input
                  className="input"
                  type="number" min="1" step="1"
                  value={bidAmount}
                  onChange={(e) => setBidAmount(e.target.value)}
                  placeholder={`Below ${formatINR(load.opening_price)}`}
                  required
                />
                {!auctionStarted ? (
                  <p className="text-xs text-slate-400 mt-1">
                    Must be lower than the opening price ({formatINR(load.opening_price)})
                  </p>
                ) : (
                  <p className="text-xs text-slate-400 mt-1">
                    Must be at least ₹100 lower than the current lowest bid
                  </p>
                )}
              </div>
              <div>
                <label className="label">Transit Days</label>
                <input
                  className="input"
                  type="number" min="1" step="1"
                  value={etaDays}
                  onChange={(e) => setEtaDays(e.target.value)}
                  placeholder="e.g. 2"
                />
              </div>
            </div>
            <div>
              <label className="label">Notes (optional)</label>
              <input
                className="input"
                value={bidNote}
                onChange={(e) => setBidNote(e.target.value)}
                placeholder="Vehicle available, door-to-door, etc."
              />
            </div>
            <button type="submit" disabled={submitting} className="btn-primary px-6">
              {submitting ? "Submitting…" : myPosition ? "Update Bid" : "Submit Bid"}
            </button>
          </form>
        </div>
      )}

      {/* ── SHIPPER: blind-phase info banner ── */}
      {userType === "shipper" && !auctionStarted && (
        <div className="card border border-amber-200 bg-amber-50">
          <div className="flex items-start gap-3">
            <EyeOff size={20} className="text-amber-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-amber-800">Blind Bidding Phase</p>
              <p className="text-sm text-amber-700 mt-0.5">
                Transporters are submitting sealed bids. Identities and amounts are hidden until
                bidding opens.
              </p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div className="text-center p-3 rounded-lg bg-white border border-amber-100">
              <p className="text-xs text-amber-600 mb-1">Sealed Bids Received</p>
              <p className="text-xl font-bold text-amber-800">
                {blindBidCount !== null ? blindBidCount : "—"}
              </p>
            </div>
            <div className="text-center p-3 rounded-lg bg-white border border-amber-100">
              <p className="text-xs text-amber-600 mb-1">Bidding Opens In</p>
              <p className="text-xl font-bold text-amber-800">{timeToStart ?? "—"}</p>
            </div>
          </div>
        </div>
      )}

      {/* ── SHIPPER: live bid list (after auction started) ── */}
      {userType === "shipper" && auctionStarted && (
        <div className="card">
          <h3 className="font-semibold text-slate-900 mb-4">
            Live Bids ({bids.length})
          </h3>
          {bids.length === 0 ? (
            <p className="text-sm text-slate-400 py-6 text-center">No bids yet.</p>
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
                  {load.status === "open" && (
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
      )}
    </div>
  );
}
