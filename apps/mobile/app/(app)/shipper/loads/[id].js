import { useEffect, useState, useRef, useCallback } from "react";
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator,
} from "react-native";
import MapView, { Marker, Polyline } from "react-native-maps";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSidebar } from "../../../../src/contexts/SidebarContext";
import { supabase } from "../../../../src/lib/supabase";
import { formatINR, formatLoadNumber, timeUntil, formatDate, formatDateTime } from "../../../../src/lib/format";
import { fetchRoutePolyline } from "../../../../src/lib/directions";

const LOAD_STATUS_COLOR = {
  open:         { bg: "#fff7ed", text: "#ea580c" },
  under_review: { bg: "#fdf4ff", text: "#9333ea" },
  awarded:      { bg: "#f0f9ff", text: "#0284c7" },
  assigned:     { bg: "#eff6ff", text: "#2563eb" },
  in_transit:   { bg: "#fff7ed", text: "#f97316" },
  delivered:    { bg: "#f0fdf4", text: "#16a34a" },
  cancelled:    { bg: "#fef2f2", text: "#dc2626" },
  expired:      { bg: "#f1f5f9", text: "#64748b" },
};

const PICKUP_COLOR = "#16a34a";
const DELIVERY_COLOR = "#dc2626";

export default function ShipperLoadDetail() {
  const { id: loadId } = useLocalSearchParams();
  const router = useRouter();

  const [load, setLoad] = useState(null);
  const [stops, setStops] = useState([]);
  const [loading, setLoading] = useState(true);

  // Auction
  const [auctionEndTime, setAuctionEndTime] = useState(null);
  const [timeLeft, setTimeLeft] = useState("");
  const [isAuctionOpen, setIsAuctionOpen] = useState(false);
  const [auctionStarted, setAuctionStarted] = useState(false);

  // Bids
  const [bids, setBids] = useState([]);
  const [blindBidCount, setBlindBidCount] = useState(null);
  const [accepting, setAccepting] = useState(null);

  const channelRef = useRef(null);

  const fetchBids = useCallback(async () => {
    const { data, error } = await supabase.rpc("get_load_bids_for_shipper", { p_load_id: loadId });
    if (!error) setBids(data ?? []);
  }, [loadId]);

  const fetchBlindCount = useCallback(async () => {
    const { data } = await supabase.rpc("get_load_active_bid_count", { p_load_id: loadId });
    if (typeof data === "number") setBlindBidCount(data);
  }, [loadId]);

  useEffect(() => {
    async function init() {
      const [{ data: loadData }, { data: stopsData }] = await Promise.all([
        supabase.from("loads").select("*").eq("id", loadId).single(),
        supabase
          .from("load_stops")
          .select("id, stop_type, stop_order, address, city, state, lat, lng")
          .eq("load_id", loadId)
          .order("stop_type").order("stop_order"),
      ]);

      setLoad(loadData);
      setStops(stopsData ?? []);

      if (loadData) {
        const endTime = new Date(loadData.auction_end_time);
        setAuctionEndTime(endTime);
        const open = loadData.status === "open" && endTime > new Date();
        setIsAuctionOpen(open);

        const startTime = loadData.bid_start_time ? new Date(loadData.bid_start_time) : null;
        const started = !startTime || new Date() >= startTime;
        setAuctionStarted(started);

        if (open) {
          if (started) {
            fetchBids();
          } else {
            fetchBlindCount();
          }
        } else if (loadData.status === "under_review" || loadData.status === "open") {
          // Auction ended: fetch bids so shipper can review and award
          fetchBids();
        }
      }
      setLoading(false);
    }
    init();
  }, [loadId]);

  useEffect(() => {
    if (!auctionEndTime) return;
    const tick = () => {
      setTimeLeft(timeUntil(auctionEndTime.toISOString()));
      const open = load?.status === "open" && auctionEndTime > new Date();
      setIsAuctionOpen(open);
      if (load?.bid_start_time && !auctionStarted) {
        if (new Date() >= new Date(load.bid_start_time)) {
          setAuctionStarted(true);
          fetchBids();
        }
      }
    };
    tick();
    const id = setInterval(tick, 1_000);
    return () => clearInterval(id);
  }, [auctionEndTime, load?.status, load?.bid_start_time, auctionStarted]);

  useEffect(() => {
    if (!load || load.status !== "open") return;

    const channel = supabase
      .channel(`sh-load:${loadId}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "bids", filter: `load_id=eq.${loadId}` },
        () => {
          if (auctionStarted) fetchBids();
          else fetchBlindCount();
        }
      )
      .on("postgres_changes",
        { event: "UPDATE", schema: "public", table: "loads", filter: `id=eq.${loadId}` },
        (payload) => {
          if (payload.new?.auction_end_time) {
            setAuctionEndTime(new Date(payload.new.auction_end_time));
          }
          setLoad((prev) => ({ ...prev, ...payload.new }));
        }
      )
      .subscribe();

    channelRef.current = channel;
    return () => supabase.removeChannel(channel);
  }, [load?.status, loadId, auctionStarted]);

  async function acceptBid(bidId, amount, companyName) {
    Alert.alert(
      "Accept Bid",
      `Award this load to ${companyName ?? "this transporter"} for ${formatINR(amount)}? This will close the auction and create a trip.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Accept Bid",
          onPress: async () => {
            setAccepting(bidId);
            const { data: trip, error } = await supabase.rpc("award_load_to_bid", {
              p_load_id:         loadId,
              p_bid_id:          bidId,
              p_shipper_user_id: (await supabase.auth.getUser()).data.user.id,
            });
            setAccepting(null);
            if (error) {
              Alert.alert("Error", error.message);
              return;
            }
            Alert.alert("Bid Accepted", "Trip has been created successfully!");
            setLoad((prev) => ({ ...prev, status: "awarded" }));
            setBids([]);
          },
        },
      ]
    );
  }

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color="#1e4dd0" size="large" /></View>;
  }
  if (!load) {
    return <View style={styles.center}><Text style={styles.errText}>Load not found.</Text></View>;
  }

  const statusColors = LOAD_STATUS_COLOR[load.status] ?? LOAD_STATUS_COLOR.expired;
  const bidStartTime = load.bid_start_time ? new Date(load.bid_start_time) : null;

  const { openSidebar } = useSidebar();

  // Group by company, keep lowest bid per transporter, sort ascending
  const lowestBidsPerCompany = Object.values(
    bids.reduce((acc, bid) => {
      const key = bid.company_name ?? bid.bid_id;
      if (!acc[key] || bid.amount < acc[key].amount) acc[key] = bid;
      return acc;
    }, {})
  ).sort((a, b) => a.amount - b.amount);

  return (
    <View style={{ flex: 1, backgroundColor: "#f8fafc" }}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="arrow-back" size={24} color="#0f172a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{load.origin_city} → {load.dest_city}</Text>
        <TouchableOpacity onPress={openSidebar} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="menu-outline" size={26} color="#0f172a" />
        </TouchableOpacity>
      </View>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.loadNum}>{formatLoadNumber(load.load_number)}</Text>
      <Text style={styles.routeTitle}>{load.origin_city} → {load.dest_city}</Text>

      {/* Status + auction timer */}
      <View style={styles.statusRow}>
        <View style={[styles.statusBadge, { backgroundColor: statusColors.bg }]}>
          <Text style={[styles.statusText, { color: statusColors.text }]}>
            {load.status.replace(/_/g, " ").toUpperCase()}
          </Text>
        </View>
        {isAuctionOpen && (
          <Text style={styles.auctionTimer}>
            {auctionStarted ? "⚡" : "🔒"} {timeLeft}
          </Text>
        )}
      </View>

      {/* Map */}
      {stops.length > 0 && stops.some((s) => s.lat != null) && (
        <StopsMapView stops={stops} />
      )}

      {/* Load info */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>LOAD DETAILS</Text>
        <InfoRow label="Commodity" value={load.commodity} />
        <InfoRow label="Weight" value={load.weight_tonnes ? `${load.weight_tonnes} T` : undefined} />
        <InfoRow label="Vehicle type" value={load.vehicle_type_req?.replace(/_/g, " ")} />
        <InfoRow label="Opening price" value={formatINR(load.opening_price)} />
        {load.pickup_date && (
          <InfoRow label="Pickup date" value={formatDate(load.pickup_date, { dateStyle: "medium" })} />
        )}
        {load.special_instructions && (
          <InfoRow label="Instructions" value={load.special_instructions} />
        )}
      </View>

      {/* Stops detail */}
      {stops.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>STOPS</Text>
          {stops.map((stop, i) => (
            <View key={stop.id ?? i} style={styles.stopRow}>
              <View style={[styles.stopDot, { backgroundColor: stop.stop_type === "pickup" ? PICKUP_COLOR : DELIVERY_COLOR }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.stopType}>{stop.stop_type === "pickup" ? "Pickup" : "Delivery"} {i + 1}</Text>
                <Text style={styles.stopAddress} numberOfLines={2}>{stop.address || stop.city}</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Auction / bid section */}
      {isAuctionOpen && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>AUCTION</Text>
          {!auctionStarted && bidStartTime ? (
            <View style={styles.blindBox}>
              <Text style={styles.blindTitle}>🔒 Blind Phase Active</Text>
              <Text style={styles.blindText}>
                Open bidding starts at {formatDateTime(bidStartTime, { dateStyle: "medium", timeStyle: "short" })}.
              </Text>
              {blindBidCount !== null && (
                <Text style={styles.blindCount}>{blindBidCount} sealed bid{blindBidCount !== 1 ? "s" : ""} received</Text>
              )}
            </View>
          ) : lowestBidsPerCompany.length === 0 ? (
            <Text style={styles.noBids}>No bids received yet.</Text>
          ) : (
            <>
              <Text style={styles.bidsSubtitle}>
                {lowestBidsPerCompany.length} transporter{lowestBidsPerCompany.length !== 1 ? "s" : ""} — lowest bid per company, sorted ascending
              </Text>
              {lowestBidsPerCompany.map((bid, i) => (
                <View key={bid.bid_id} style={[styles.bidCard, i === 0 && styles.bidCardTop]}>
                  {i === 0 && <Text style={styles.bidRank}>🏆 Lowest Bid</Text>}
                  <View style={styles.bidCardRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.bidCompany}>{bid.company_name ?? "—"}</Text>
                      {bid.eta_days && <Text style={styles.bidMeta}>ETA: {bid.eta_days} days</Text>}
                      {bid.notes && <Text style={styles.bidNote} numberOfLines={2}>{bid.notes}</Text>}
                    </View>
                    <Text style={styles.bidAmount}>{formatINR(bid.amount)}</Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.acceptBtn, accepting === bid.bid_id && styles.btnDisabled]}
                    onPress={() => acceptBid(bid.bid_id, bid.amount, bid.company_name)}
                    disabled={accepting !== null}
                  >
                    <Text style={styles.acceptBtnText}>
                      {accepting === bid.bid_id ? "Accepting…" : "Accept Bid"}
                    </Text>
                  </TouchableOpacity>
                </View>
              ))}
            </>
          )}
        </View>
      )}

      {/* Post-auction: bids under review — shipper can still award */}
      {!isAuctionOpen && (load.status === "under_review" || load.status === "open") && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>BIDS RECEIVED</Text>
          {bids.length === 0 ? (
            <Text style={styles.noBids}>No bids were received.</Text>
          ) : (
            <>
              <Text style={styles.bidsSubtitle}>
                {lowestBidsPerCompany.length} transporter{lowestBidsPerCompany.length !== 1 ? "s" : ""} — select a bid to award this load
              </Text>
              {lowestBidsPerCompany.map((bid, i) => (
                <View key={bid.bid_id} style={[styles.bidCard, i === 0 && styles.bidCardTop]}>
                  {i === 0 && <Text style={styles.bidRank}>🏆 Lowest Bid</Text>}
                  <View style={styles.bidCardRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.bidCompany}>{bid.company_name ?? "—"}</Text>
                      {bid.eta_days && <Text style={styles.bidMeta}>ETA: {bid.eta_days} days</Text>}
                      {bid.notes && <Text style={styles.bidNote} numberOfLines={2}>{bid.notes}</Text>}
                    </View>
                    <Text style={styles.bidAmount}>{formatINR(bid.amount)}</Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.acceptBtn, accepting === bid.bid_id && styles.btnDisabled]}
                    onPress={() => acceptBid(bid.bid_id, bid.amount, bid.company_name)}
                    disabled={accepting !== null}
                  >
                    <Text style={styles.acceptBtnText}>
                      {accepting === bid.bid_id ? "Accepting…" : "Accept Bid"}
                    </Text>
                  </TouchableOpacity>
                </View>
              ))}
            </>
          )}
        </View>
      )}

      {/* Post-auction: expired with no bids */}
      {load.status === "expired" && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>AUCTION EXPIRED</Text>
          <Text style={styles.noBids}>This auction ended with no bids received.</Text>
        </View>
      )}

      {/* Awarded bid info */}
      {(load.status === "awarded" || load.status === "assigned") && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>AWARD</Text>
          <Text style={styles.awardedNote}>✓ Bid accepted. A trip is being prepared.</Text>
        </View>
      )}
    </ScrollView>
    </View>
  );
}

function StopsMapView({ stops }) {
  const mapRef = useRef(null);
  const [routeCoords, setRouteCoords] = useState(null);
  const [routeLoading, setRouteLoading] = useState(true);

  const valid = stops.filter((s) => s.lat != null && s.lng != null);
  const markerCoords = valid.map((s) => ({ latitude: Number(s.lat), longitude: Number(s.lng) }));

  function fitToPoints(coords) {
    if (!mapRef.current || !coords?.length) return;
    mapRef.current.fitToCoordinates(coords, {
      edgePadding: { top: 60, right: 60, bottom: 60, left: 60 },
      animated: false,
    });
  }

  useEffect(() => {
    const validStops = stops.filter((s) => s.lat != null && s.lng != null);
    if (validStops.length < 2) { setRouteLoading(false); return; }
    setRouteLoading(true);
    setRouteCoords(null);
    fetchRoutePolyline(validStops).then((coords) => {
      setRouteCoords(coords);
      setRouteLoading(false);
      fitToPoints(coords ?? validStops.map((s) => ({ latitude: Number(s.lat), longitude: Number(s.lng) })));
    });
  }, [stops]);

  if (!valid.length) return null;

  return (
    <View style={styles.mapSection}>
      <Text style={styles.sectionLabel}>ROUTE</Text>
      <View>
        <MapView
          ref={mapRef}
          style={styles.map}
          onMapReady={() => fitToPoints(markerCoords)}
        >
          {valid.map((s, i) => (
            <Marker
              key={s.id ?? i}
              coordinate={{ latitude: Number(s.lat), longitude: Number(s.lng) }}
              title={`${s.stop_type === "pickup" ? "Pickup" : "Delivery"} ${i + 1}`}
              description={s.address || s.city}
              pinColor={s.stop_type === "pickup" ? PICKUP_COLOR : DELIVERY_COLOR}
            />
          ))}
          {routeCoords && routeCoords.length > 1 && (
            <Polyline
              coordinates={routeCoords}
              strokeColor="#f97316"
              strokeWidth={3}
            />
          )}
        </MapView>
        {routeLoading && (
          <View style={styles.mapLoader}>
            <ActivityIndicator color="#1e4dd0" size="small" />
            <Text style={styles.mapLoaderText}>Loading route…</Text>
          </View>
        )}
      </View>
    </View>
  );
}

function InfoRow({ label, value }) {
  if (!value) return null;
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container:     { flex: 1, backgroundColor: "#f8fafc" },
  header:        { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 60, paddingBottom: 14, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#e2e8f0" },
  headerTitle:   { fontSize: 16, fontWeight: "700", color: "#0f172a", flex: 1, marginHorizontal: 12 },
  content:       { padding: 16, paddingTop: 16, paddingBottom: 48 },
  center:        { flex: 1, justifyContent: "center", alignItems: "center" },
  errText:       { color: "#94a3b8", fontSize: 14 },
  backBtn:       { marginBottom: 10 },
  backBtnText:   { color: "#1e4dd0", fontWeight: "600", fontSize: 14 },
  loadNum:       { fontSize: 12, fontFamily: "monospace", color: "#94a3b8", marginBottom: 2 },
  routeTitle:    { fontSize: 22, fontWeight: "800", color: "#0f172a", marginBottom: 10 },
  statusRow:     { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  statusBadge:   { borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4 },
  statusText:    { fontSize: 12, fontWeight: "700", letterSpacing: 0.5 },
  auctionTimer:  { fontSize: 13, fontWeight: "800", color: "#f97316" },
  section:       { backgroundColor: "#fff", borderRadius: 12, padding: 16, marginBottom: 12, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3, elevation: 1 },
  sectionLabel:  { fontSize: 10, fontWeight: "700", color: "#94a3b8", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 },
  mapSection:    { backgroundColor: "#fff", borderRadius: 12, padding: 14, marginBottom: 12, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3, elevation: 1 },
  map:           { width: "100%", height: 180, borderRadius: 8, overflow: "hidden", marginTop: 8 },
  mapLoader:     { position: "absolute", top: 8, left: 0, right: 0, bottom: 0, borderRadius: 8, backgroundColor: "rgba(248,250,252,0.80)", justifyContent: "center", alignItems: "center", gap: 8 },
  mapLoaderText: { fontSize: 12, color: "#64748b" },
  infoRow:       { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: "#f1f5f9" },
  infoLabel:     { fontSize: 13, color: "#64748b", flex: 1 },
  infoValue:     { fontSize: 13, color: "#0f172a", fontWeight: "500", flex: 2, textAlign: "right" },
  stopRow:       { flexDirection: "row", alignItems: "flex-start", gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#f1f5f9" },
  stopDot:       { width: 10, height: 10, borderRadius: 5, marginTop: 3 },
  stopType:      { fontSize: 11, fontWeight: "700", color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5 },
  stopAddress:   { fontSize: 13, color: "#0f172a", marginTop: 2 },
  blindBox:      { backgroundColor: "#f0f9ff", borderRadius: 10, padding: 14, borderWidth: 1, borderColor: "#bae6fd" },
  blindTitle:    { fontSize: 13, fontWeight: "700", color: "#0284c7", marginBottom: 4 },
  blindText:     { fontSize: 12, color: "#0369a1", marginBottom: 8 },
  blindCount:    { fontSize: 16, fontWeight: "800", color: "#0284c7" },
  noBids:        { color: "#94a3b8", fontSize: 13, textAlign: "center", paddingVertical: 16 },
  bidsSubtitle:  { fontSize: 12, color: "#64748b", marginBottom: 12 },
  bidCard:       { borderRadius: 10, padding: 14, backgroundColor: "#f8fafc", marginBottom: 10, borderWidth: 1, borderColor: "#e2e8f0" },
  bidCardTop:    { borderColor: "#fbbf24", backgroundColor: "#fffbeb" },
  bidRank:       { fontSize: 11, fontWeight: "700", color: "#d97706", marginBottom: 6 },
  bidCardRow:    { flexDirection: "row", alignItems: "flex-start", marginBottom: 10 },
  bidCompany:    { fontSize: 14, fontWeight: "700", color: "#0f172a", marginBottom: 2 },
  bidMeta:       { fontSize: 12, color: "#64748b" },
  bidNote:       { fontSize: 12, color: "#475569", marginTop: 2, fontStyle: "italic" },
  bidAmount:     { fontSize: 18, fontWeight: "800", color: "#16a34a", marginLeft: 8 },
  acceptBtn:     { backgroundColor: "#16a34a", borderRadius: 8, paddingVertical: 10, alignItems: "center" },
  acceptBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  btnDisabled:   { opacity: 0.5 },
  awardedNote:   { color: "#16a34a", fontSize: 14, fontWeight: "600", textAlign: "center", paddingVertical: 8 },
});