import { useEffect, useState, useRef } from "react";
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator, Dimensions,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import MapView, { Marker, Polyline } from "react-native-maps";
import { supabase } from "../../../src/lib/supabase";
import { startTracking, stopTracking } from "../../../src/lib/locationTracking";
import { fetchRoutePolyline } from "../../../src/lib/directions";

export default function TripDetailScreen() {
  const { id: tripId } = useLocalSearchParams();
  const router = useRouter();
  const [trip, setTrip] = useState(null);
  const [stops, setStops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tracking, setTracking] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    async function loadTrip() {
      const { data: tripData } = await supabase
        .from("trips")
        .select(`
          id, status, scheduled_pickup_at, actual_pickup_at,
          estimated_delivery_at, actual_delivery_at, agreed_amount,
          load:loads(
            id, origin_city, dest_city, origin_address, dest_address,
            commodity, weight_tonnes, vehicle_type_req,
            special_instructions
          ),
          vehicle:vehicles(registration_no, make, model),
          shipper_company:companies(name, phone)
        `)
        .eq("id", tripId)
        .single();

      setTrip(tripData);

      if (tripData?.load?.id) {
        const { data: stopsData } = await supabase
          .from("load_stops")
          .select("id, stop_type, stop_order, address, city, lat, lng")
          .eq("load_id", tripData.load.id)
          .order("stop_type")
          .order("stop_order");
        setStops(stopsData ?? []);
      }

      setLoading(false);
    }
    loadTrip();
  }, [tripId]);

  async function handleStartTrip() {
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from("trips")
        .update({ status: "in_transit", actual_pickup_at: new Date().toISOString() })
        .eq("id", tripId);

      if (error) { Alert.alert("Error", error.message); return; }

      await startTracking(tripId);
      setTracking(true);
      setTrip((p) => ({ ...p, status: "in_transit" }));
      Alert.alert("Trip Started", "Location tracking is now active.");
    } catch (e) {
      Alert.alert("Error", e.message);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleStopTracking() {
    await stopTracking();
    setTracking(false);
    Alert.alert("Tracking paused", "Location updates are paused. Tap 'Resume' to continue.");
  }

  async function handleCompleteTrip() {
    Alert.alert(
      "Complete Trip",
      "Mark this trip as delivered? Make sure you have uploaded the delivery proof.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Mark Delivered",
          style: "default",
          onPress: async () => {
            setActionLoading(true);
            await stopTracking();
            setTracking(false);
            const { error } = await supabase
              .from("trips")
              .update({ status: "completed", actual_delivery_at: new Date().toISOString() })
              .eq("id", tripId);
            setActionLoading(false);
            if (error) { Alert.alert("Error", error.message); return; }
            setTrip((p) => ({ ...p, status: "completed" }));
            Alert.alert("Delivered!", "Trip marked as completed.");
            router.back();
          },
        },
      ]
    );
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#1e4dd0" size="large" />
      </View>
    );
  }

  if (!trip) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Trip not found.</Text>
      </View>
    );
  }

  const { load, vehicle, shipper_company } = trip;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
        <Text style={styles.backBtnText}>← Back</Text>
      </TouchableOpacity>

      <Text style={styles.routeTitle}>
        {load?.origin_city} → {load?.dest_city}
      </Text>
      <Text style={styles.statusBadge}>{trip.status.replace(/_/g, " ").toUpperCase()}</Text>

      {/* Stops Map */}
      {stops.length > 0 && stops.some((s) => s.lat != null) && (
        <StopsMapView stops={stops} />
      )}

      {/* Load info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Cargo</Text>
        <InfoRow label="Commodity" value={load?.commodity} />
        <InfoRow label="Weight"    value={load?.weight_tonnes ? `${load.weight_tonnes} T` : undefined} />
        <InfoRow label="Vehicle"   value={load?.vehicle_type_req?.replace(/_/g, " ")} />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Pickup</Text>
        <InfoRow label="Address" value={load?.origin_address} />
        {trip.scheduled_pickup_at && (
          <InfoRow label="Scheduled" value={new Date(trip.scheduled_pickup_at).toLocaleString("en-IN")} />
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Delivery</Text>
        <InfoRow label="Address" value={load?.dest_address} />
        {trip.estimated_delivery_at && (
          <InfoRow label="Estimated" value={new Date(trip.estimated_delivery_at).toLocaleString("en-IN")} />
        )}
      </View>

      {vehicle && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Vehicle</Text>
          <InfoRow label="Reg No" value={vehicle.registration_no} />
          <InfoRow label="Vehicle" value={`${vehicle.make ?? ""} ${vehicle.model ?? ""}`.trim()} />
        </View>
      )}

      {shipper_company && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Shipper</Text>
          <InfoRow label="Company" value={shipper_company.name} />
          <InfoRow label="Contact" value={shipper_company.phone} />
        </View>
      )}

      {load?.special_instructions && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Special Instructions</Text>
          <Text style={styles.instructions}>{load.special_instructions}</Text>
        </View>
      )}

      {/* Actions */}
      <View style={styles.actions}>
        {trip.status === "pending" && (
          <TouchableOpacity
            style={[styles.actionBtn, styles.startBtn, actionLoading && styles.btnDisabled]}
            onPress={handleStartTrip}
            disabled={actionLoading}
          >
            <Text style={styles.actionBtnText}>
              {actionLoading ? "Starting…" : "Start Trip & Begin Tracking"}
            </Text>
          </TouchableOpacity>
        )}

        {trip.status === "in_transit" && !tracking && (
          <TouchableOpacity
            style={[styles.actionBtn, styles.startBtn]}
            onPress={() => startTracking(tripId).then(() => setTracking(true))}
          >
            <Text style={styles.actionBtnText}>Resume Tracking</Text>
          </TouchableOpacity>
        )}

        {trip.status === "in_transit" && tracking && (
          <View style={styles.trackingActive}>
            <View style={styles.liveDot} />
            <Text style={styles.trackingText}>Location tracking active</Text>
          </View>
        )}

        {trip.status === "in_transit" && tracking && (
          <TouchableOpacity style={[styles.actionBtn, styles.pauseBtn]} onPress={handleStopTracking}>
            <Text style={styles.actionBtnText}>Pause Tracking</Text>
          </TouchableOpacity>
        )}

        {trip.status === "in_transit" && (
          <TouchableOpacity
            style={[styles.actionBtn, styles.deliverBtn, actionLoading && styles.btnDisabled]}
            onPress={handleCompleteTrip}
            disabled={actionLoading}
          >
            <Text style={styles.actionBtnText}>
              {actionLoading ? "Processing…" : "Mark as Delivered"}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
}

const PICKUP_COLOR = "#16a34a";
const DELIVERY_COLOR = "#dc2626";
const LINE_COLOR = "#f97316";

function StopsMapView({ stops }) {
  const mapRef = useRef(null);
  const [routeCoords, setRouteCoords] = useState(null);
  const [routeLoading, setRouteLoading] = useState(true);

  const validStops = stops.filter((s) => s.lat != null && s.lng != null);
  const markerCoords = validStops.map((s) => ({
    latitude: Number(s.lat),
    longitude: Number(s.lng),
  }));

  function fitToPoints(coords) {
    if (!mapRef.current || !coords?.length) return;
    mapRef.current.fitToCoordinates(coords, {
      edgePadding: { top: 60, right: 60, bottom: 60, left: 60 },
      animated: false,
    });
  }

  useEffect(() => {
    if (validStops.length < 2) { setRouteLoading(false); return; }
    setRouteLoading(true);
    setRouteCoords(null);
    fetchRoutePolyline(validStops).then((coords) => {
      setRouteCoords(coords);
      setRouteLoading(false);
      fitToPoints(coords ?? markerCoords);
    });
  }, [stops]);

  if (!validStops.length) return null;

  return (
    <View style={styles.mapSection}>
      <Text style={styles.sectionTitle}>Route</Text>
      <View style={styles.mapLegend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: PICKUP_COLOR }]} />
          <Text style={styles.legendText}>Pickup</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: DELIVERY_COLOR }]} />
          <Text style={styles.legendText}>Delivery</Text>
        </View>
      </View>
      <View>
        <MapView
          ref={mapRef}
          style={styles.map}
          onMapReady={() => fitToPoints(markerCoords)}
        >
          {validStops.map((stop, idx) => (
            <Marker
              key={stop.id ?? idx}
              coordinate={{ latitude: Number(stop.lat), longitude: Number(stop.lng) }}
              title={`${stop.stop_type === "pickup" ? "Pickup" : "Delivery"} ${idx + 1}`}
              description={stop.address || stop.city}
              pinColor={stop.stop_type === "pickup" ? PICKUP_COLOR : DELIVERY_COLOR}
            />
          ))}
          {routeCoords && routeCoords.length > 1 && (
            <Polyline
              coordinates={routeCoords}
              strokeColor={LINE_COLOR}
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
  container:      { flex: 1, backgroundColor: "#f8fafc" },
  content:        { padding: 16, paddingTop: 60, paddingBottom: 40 },
  center:         { flex: 1, justifyContent: "center", alignItems: "center" },
  errorText:      { color: "#94a3b8" },
  backBtn:        { marginBottom: 12 },
  backBtnText:    { color: "#1e4dd0", fontWeight: "600", fontSize: 14 },
  routeTitle:     { fontSize: 22, fontWeight: "800", color: "#0f172a", marginBottom: 6 },
  statusBadge:    { fontSize: 12, fontWeight: "700", color: "#f97316", marginBottom: 20, letterSpacing: 1 },
  section:        { backgroundColor: "#fff", borderRadius: 12, padding: 16, marginBottom: 12, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3, elevation: 1 },
  sectionTitle:   { fontSize: 11, fontWeight: "700", color: "#94a3b8", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 },
  infoRow:        { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: "#f1f5f9" },
  infoLabel:      { fontSize: 13, color: "#64748b", flex: 1 },
  infoValue:      { fontSize: 13, color: "#0f172a", fontWeight: "500", flex: 2, textAlign: "right" },
  instructions:   { fontSize: 13, color: "#475569", lineHeight: 20 },
  actions:        { gap: 10, marginTop: 8 },
  actionBtn:      { borderRadius: 12, paddingVertical: 14, alignItems: "center" },
  actionBtnText:  { color: "#fff", fontWeight: "700", fontSize: 15 },
  startBtn:       { backgroundColor: "#16a34a" },
  pauseBtn:       { backgroundColor: "#64748b" },
  deliverBtn:     { backgroundColor: "#1e4dd0" },
  btnDisabled:    { opacity: 0.5 },
  trackingActive: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#f0fdf4", borderRadius: 10, paddingVertical: 10 },
  liveDot:        { width: 8, height: 8, borderRadius: 4, backgroundColor: "#16a34a" },
  trackingText:   { fontSize: 13, color: "#16a34a", fontWeight: "600" },
  mapSection:     { backgroundColor: "#fff", borderRadius: 12, padding: 16, marginBottom: 12, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3, elevation: 1 },
  map:            { width: "100%", height: 200, borderRadius: 10, overflow: "hidden", marginTop: 8 },
  mapLegend:      { flexDirection: "row", gap: 16, marginBottom: 4 },
  legendItem:     { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot:      { width: 10, height: 10, borderRadius: 5 },
  legendText:     { fontSize: 12, color: "#64748b" },
  mapLoader:      { position: "absolute", top: 8, left: 0, right: 0, bottom: 0, borderRadius: 10, backgroundColor: "rgba(248,250,252,0.80)", justifyContent: "center", alignItems: "center", gap: 8 },
  mapLoaderText:  { fontSize: 12, color: "#64748b" },
});
