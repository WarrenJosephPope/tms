import { useEffect, useState, useRef, useCallback } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from "react-native";
import MapView, { Marker, Polyline } from "react-native-maps";
import { useLocalSearchParams, useRouter } from "expo-router";
import { supabase } from "../../../../src/lib/supabase";
import { formatINR, formatLoadNumber, timeUntil } from "../../../../src/lib/format";
import { fetchRoutePolyline } from "../../../../src/lib/directions";

const PICKUP_COLOR = "#16a34a";
const DELIVERY_COLOR = "#dc2626";

export default function TransporterLoadDetail() {
  const { id: loadId } = useLocalSearchParams();
  const router = useRouter();

  const [load, setLoad] = useState(null);
  const [stops, setStops] = useState([]);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // Auction state
  const [auctionEndTime, setAuctionEndTime] = useState(null);
  const [timeLeft, setTimeLeft] = useState("");
  const [isAuctionOpen, setIsAuctionOpen] = useState(false);
  const [isBlindPhase, setIsBlindPhase] = useState(false);

  // Bid state
  const [myPosition, setMyPosition] = useState(null);
  const [existingBid, setExistingBid] = useState(null);

  // Form
  const [bidAmount, setBidAmount] = useState("");
  const [etaDays, setEtaDays] = useState("");
  const [bidNote, setBidNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const channelRef = useRef(null);

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: prof } = await supabase
        .from("user_profiles")
        .select("company_id, transporter_role")
        .eq("id", user.id)
        .single();
      setProfile(prof);

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
        setIsBlindPhase(Boolean(startTime && new Date() < startTime));

        if (open && prof) {
          const { data: existingBids } = await supabase
            .from("bids")
            .select("amount, eta_days, notes")
            .eq("load_id", loadId)
            .eq("transporter_company_id", prof.company_id)
            .eq("status", "active")
            .limit(1);
          if (existingBids?.[0]) {
            setExistingBid(existingBids[0]);
            setBidAmount(String(existingBids[0].amount));
            setEtaDays(existingBids[0].eta_days ? String(existingBids[0].eta_days) : "");
            setBidNote(existingBids[0].notes ?? "");
          }
          fetchPosition();
        } else if (!open && prof) {
          const { data: closedBids } = await supabase
            .from("bids")
            .select("amount, eta_days, notes, status")
            .eq("load_id", loadId)
            .eq("transporter_company_id", prof.company_id)
            .order("created_at", { ascending: false })
            .limit(1);
          if (closedBids?.[0]) setExistingBid(closedBids[0]);
        }
      }
      setLoading(false);
    }
    init();
  }, [loadId]);

  const fetchPosition = useCallback(async () => {
    const { data } = await supabase.rpc("get_my_bid_position", { p_load_id: loadId });
    if (data?.[0]) setMyPosition(data[0]);
  }, [loadId]);

  useEffect(() => {
    if (!auctionEndTime) return;
    const tick = () => {
      const left = timeUntil(auctionEndTime.toISOString());
      setTimeLeft(left);
      const nowOpen = load?.status === "open" && auctionEndTime > new Date();
      setIsAuctionOpen(nowOpen);
    };
    tick();
    const id = setInterval(tick, 1_000);
    return () => clearInterval(id);
  }, [auctionEndTime, load?.status]);

  useEffect(() => {
    if (!isAuctionOpen) return;
    const id = setInterval(fetchPosition, 10_000);
    return () => clearInterval(id);
  }, [isAuctionOpen, fetchPosition]);

  useEffect(() => {
    if (!load || load.status !== "open") return;

    const channel = supabase
      .channel(`tp-load:${loadId}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "bids", filter: `load_id=eq.${loadId}` },
        () => fetchPosition()
      )
      .on("postgres_changes",
        { event: "UPDATE", schema: "public", table: "loads", filter: `id=eq.${loadId}` },
        (payload) => {
          if (payload.new?.auction_end_time) {
            setAuctionEndTime(new Date(payload.new.auction_end_time));
          }
          if (payload.new?.status) {
            setLoad((prev) => ({ ...prev, ...payload.new }));
          }
        }
      )
      .subscribe();

    channelRef.current = channel;
    return () => supabase.removeChannel(channel);
  }, [load?.status, loadId, fetchPosition]);

  async function placeBid() {
    const amount = Number(bidAmount);
    if (!amount || amount <= 0) {
      Alert.alert("Invalid amount", "Enter a valid bid amount.");
      return;
    }
    if (!profile) return;

    setSubmitting(true);
    try {
      const { data, error } = await supabase.rpc("place_bid_atomic", {
        p_load_id:                loadId,
        p_transporter_company_id: profile.company_id,
        p_bidder_id:              (await supabase.auth.getUser()).data.user.id,
        p_amount:                 amount,
        p_eta_days:               etaDays ? Number(etaDays) : null,
        p_notes:                  bidNote.trim() || null,
      });

      if (error) {
        Alert.alert("Bid failed", error.message);
        return;
      }
      setExistingBid({ amount, eta_days: etaDays ? Number(etaDays) : null, notes: bidNote || null, status: "active" });
      Alert.alert("Success", isBlindPhase ? "Sealed bid submitted!" : "Bid placed!");
      await fetchPosition();
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color="#1e4dd0" size="large" /></View>;
  }
  if (!load) {
    return <View style={styles.center}><Text style={styles.errText}>Load not found.</Text></View>;
  }

  const bidStartTime = load.bid_start_time ? new Date(load.bid_start_time) : null;
  const canBid = isAuctionOpen &&
    profile &&
    ["account_owner", "fleet_manager"].includes(profile.transporter_role);

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Back</Text>
        </TouchableOpacity>

        <Text style={styles.loadNum}>{formatLoadNumber(load.load_number)}</Text>
        <Text style={styles.routeTitle}>{load.origin_city} → {load.dest_city}</Text>

        {/* Auction status banner */}
        <View style={[styles.auctionBanner, !isAuctionOpen && styles.auctionClosed]}>
          {isAuctionOpen ? (
            <>
              <Text style={styles.auctionText}>
                {isBlindPhase ? "🔒 SEALED BID PHASE" : "⚡ LIVE AUCTION"}
              </Text>
              <Text style={styles.auctionTimer}>{timeLeft}</Text>
            </>
          ) : (
            <Text style={styles.auctionText}>
              {load.status === "open" ? "⏰ Auction ended" : `Status: ${load.status.replace(/_/g, " ")}`}
            </Text>
          )}
        </View>

        {/* Map */}
        {stops.length > 0 && stops.some((s) => s.lat != null) && (
          <StopsMapView stops={stops} />
        )}

        {/* Load info */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>CARGO DETAILS</Text>
          <InfoRow label="Commodity" value={load.commodity} />
          <InfoRow label="Weight" value={load.weight_tonnes ? `${load.weight_tonnes} T` : undefined} />
          <InfoRow label="Vehicle type" value={load.vehicle_type_req?.replace(/_/g, " ")} />
          <InfoRow label="Opening price" value={formatINR(load.opening_price)} />
          {load.pickup_date && (
            <InfoRow label="Pickup date" value={new Date(load.pickup_date).toLocaleDateString("en-IN", { dateStyle: "medium" })} />
          )}
          {load.special_instructions && (
            <InfoRow label="Instructions" value={load.special_instructions} />
          )}
        </View>

        {/* Blind phase info */}
        {isAuctionOpen && isBlindPhase && bidStartTime && (
          <View style={styles.blindBanner}>
            <Text style={styles.blindTitle}>🔒 Blind Phase Active</Text>
            <Text style={styles.blindText}>
              Bids are sealed until {bidStartTime.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}. Only your own bid is visible to you during this phase.
            </Text>
          </View>
        )}

        {/* My current bid + position */}
        {existingBid && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>MY BID</Text>
            <InfoRow label="Amount" value={formatINR(existingBid.amount)} />
            {existingBid.eta_days && <InfoRow label="ETA" value={`${existingBid.eta_days} days`} />}
            {existingBid.notes && <InfoRow label="Note" value={existingBid.notes} />}
            {existingBid.status && existingBid.status !== "active" && (
              <InfoRow label="Result" value={existingBid.status.toUpperCase()} />
            )}
            {existingBid.status === "active" && !isAuctionOpen && (
              <InfoRow label="Status" value="Under review — pending award" />
            )}
          </View>
        )}

        {myPosition && isAuctionOpen && !isBlindPhase && (
          <View style={styles.positionCard}>
            <Text style={styles.positionTitle}>Your Position</Text>
            <Text style={styles.positionRank}>
              #{myPosition.bid_position} of {myPosition.total_bids} bids
            </Text>
            {myPosition.bid_position === 1 && (
              <Text style={styles.positionLeading}>🏆 You're currently leading!</Text>
            )}
          </View>
        )}

        {/* Bid form */}
        {canBid && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>
              {isBlindPhase ? "PLACE SEALED BID" : existingBid ? "UPDATE BID" : "PLACE BID"}
            </Text>
            <Text style={styles.bidHint}>
              Enter your {isBlindPhase ? "sealed " : ""}bid amount (must be lower than the opening price
              {!isBlindPhase && load.opening_price ? ` of ${formatINR(load.opening_price)}` : ""}).
            </Text>

            <Text style={styles.fieldLabel}>Bid Amount (₹) *</Text>
            <TextInput
              style={styles.input}
              value={bidAmount}
              onChangeText={setBidAmount}
              keyboardType="numeric"
              placeholder="e.g. 95000"
              placeholderTextColor="#94a3b8"
            />

            <Text style={styles.fieldLabel}>ETA (days)</Text>
            <TextInput
              style={styles.input}
              value={etaDays}
              onChangeText={setEtaDays}
              keyboardType="numeric"
              placeholder="e.g. 2"
              placeholderTextColor="#94a3b8"
            />

            <Text style={styles.fieldLabel}>Note (optional)</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={bidNote}
              onChangeText={setBidNote}
              multiline
              numberOfLines={3}
              placeholder="Any remarks…"
              placeholderTextColor="#94a3b8"
            />

            <TouchableOpacity
              style={[styles.bidBtn, submitting && styles.btnDisabled]}
              onPress={placeBid}
              disabled={submitting}
            >
              <Text style={styles.bidBtnText}>
                {submitting ? "Submitting…" : isBlindPhase ? "Submit Sealed Bid" : existingBid ? "Update Bid" : "Place Bid"}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {!canBid && !isAuctionOpen && (
          <View style={styles.closedNote}>
            <Text style={styles.closedNoteText}>
              {load.status === "under_review"
                ? "The auction has ended. The shipper is reviewing bids and will award the load shortly."
                : load.status === "expired"
                ? "This auction expired without any bids being placed."
                : "This auction has ended. No further bids can be placed."}
            </Text>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
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
  container:       { flex: 1, backgroundColor: "#f8fafc" },
  content:         { padding: 16, paddingTop: 60, paddingBottom: 48 },
  center:          { flex: 1, justifyContent: "center", alignItems: "center" },
  errText:         { color: "#94a3b8", fontSize: 14 },
  backBtn:         { marginBottom: 10 },
  backBtnText:     { color: "#1e4dd0", fontWeight: "600", fontSize: 14 },
  loadNum:         { fontSize: 12, fontFamily: "monospace", color: "#94a3b8", marginBottom: 2 },
  routeTitle:      { fontSize: 22, fontWeight: "800", color: "#0f172a", marginBottom: 12 },
  auctionBanner:   { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#fff7ed", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 12, borderWidth: 1, borderColor: "#fed7aa" },
  auctionClosed:   { backgroundColor: "#f1f5f9", borderColor: "#e2e8f0" },
  auctionText:     { fontSize: 13, fontWeight: "700", color: "#ea580c" },
  auctionTimer:    { fontSize: 13, fontWeight: "800", color: "#ea580c" },
  section:         { backgroundColor: "#fff", borderRadius: 12, padding: 16, marginBottom: 12, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3, elevation: 1 },
  sectionLabel:    { fontSize: 10, fontWeight: "700", color: "#94a3b8", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 },
  mapSection:      { backgroundColor: "#fff", borderRadius: 12, padding: 14, marginBottom: 12, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3, elevation: 1 },
  map:             { width: "100%", height: 180, borderRadius: 8, overflow: "hidden", marginTop: 8 },
  mapLoader:       { position: "absolute", top: 8, left: 0, right: 0, bottom: 0, borderRadius: 8, backgroundColor: "rgba(248,250,252,0.80)", justifyContent: "center", alignItems: "center", gap: 8 },
  mapLoaderText:   { fontSize: 12, color: "#64748b" },
  infoRow:         { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: "#f1f5f9" },
  infoLabel:       { fontSize: 13, color: "#64748b", flex: 1 },
  infoValue:       { fontSize: 13, color: "#0f172a", fontWeight: "500", flex: 2, textAlign: "right" },
  blindBanner:     { backgroundColor: "#f0f9ff", borderRadius: 10, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: "#bae6fd" },
  blindTitle:      { fontSize: 13, fontWeight: "700", color: "#0284c7", marginBottom: 4 },
  blindText:       { fontSize: 12, color: "#0369a1", lineHeight: 18 },
  positionCard:    { backgroundColor: "#f0fdf4", borderRadius: 12, padding: 16, marginBottom: 12, alignItems: "center", borderWidth: 1, borderColor: "#bbf7d0" },
  positionTitle:   { fontSize: 11, fontWeight: "700", color: "#15803d", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 },
  positionRank:    { fontSize: 22, fontWeight: "800", color: "#16a34a" },
  positionLeading: { fontSize: 13, color: "#15803d", marginTop: 4 },
  bidHint:         { fontSize: 12, color: "#64748b", marginBottom: 14, lineHeight: 18 },
  fieldLabel:      { fontSize: 12, fontWeight: "600", color: "#475569", marginBottom: 4 },
  input:           { borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 8, paddingHorizontal: 12, height: 44, fontSize: 15, color: "#0f172a", backgroundColor: "#fff", marginBottom: 12 },
  textArea:        { height: 80, paddingTop: 10 },
  bidBtn:          { backgroundColor: "#1e4dd0", borderRadius: 12, paddingVertical: 14, alignItems: "center", marginTop: 4 },
  bidBtnText:      { color: "#fff", fontWeight: "700", fontSize: 15 },
  btnDisabled:     { opacity: 0.5 },
  closedNote:      { backgroundColor: "#f1f5f9", borderRadius: 12, padding: 16, alignItems: "center" },
  closedNoteText:  { color: "#64748b", fontSize: 13, textAlign: "center" },
});