import { useEffect, useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity,
  RefreshControl, StyleSheet, ActivityIndicator,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../../../../src/lib/supabase";
import { formatDateTime } from "../../../../src/lib/format";

const STATUS_COLOR = {
  assigned:   { bg: "#eff6ff", text: "#2563eb" },
  in_transit: { bg: "#fff7ed", text: "#ea580c" },
  delivered:  { bg: "#f0fdf4", text: "#16a34a" },
  cancelled:  { bg: "#fef2f2", text: "#dc2626" },
};

const STATUS_LABEL = {
  assigned:   "Assigned",
  in_transit: "In Transit",
  delivered:  "Delivered",
  cancelled:  "Cancelled",
};

export default function ShipperTripDetailScreen() {
  const router  = useRouter();
  const { id }  = useLocalSearchParams();
  const [trip, setTrip]     = useState(null);
  const [lastPing, setLastPing] = useState(null);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function fetchTrip() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.replace("/(auth)/login"); return; }

    const { data: prof } = await supabase
      .from("user_profiles")
      .select("company_id")
      .eq("id", user.id)
      .single();

    if (!prof) { setLoading(false); return; }

    const [tripRes, pingRes] = await Promise.all([
      supabase
        .from("trips")
        .select(`
          id, status, created_at,
          load:loads(
            id, load_number, origin_city, dest_city,
            commodity_type, weight_tonnes, vehicle_type_req
          ),
          transporter:companies!trips_transporter_company_id_fkey(name, phone),
          driver:drivers(full_name, phone)
        `)
        .eq("id", id)
        .eq("shipper_company_id", prof.company_id)
        .single(),
      supabase
        .from("location_pings")
        .select("latitude, longitude, speed_kmph, created_at")
        .eq("trip_id", id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    setTrip(tripRes.data ?? null);
    setLastPing(pingRes.data ?? null);
    setLoading(false);
  }

  useEffect(() => { fetchTrip(); }, [id]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchTrip();
    setRefreshing(false);
  };

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
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backLink}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const statusColors = STATUS_COLOR[trip.status] ?? { bg: "#f1f5f9", text: "#475569" };
  const load = trip.load;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1e4dd0" />}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="arrow-back-outline" size={24} color="#0f172a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {load?.origin_city} → {load?.dest_city}
        </Text>
        <View style={[styles.statusBadge, { backgroundColor: statusColors.bg }]}>
          <Text style={[styles.statusText, { color: statusColors.text }]}>
            {STATUS_LABEL[trip.status] ?? trip.status}
          </Text>
        </View>
      </View>

      {/* Load info */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Cargo</Text>
        {load?.load_number && (
          <DetailRow label="Load #" value={`#${String(load.load_number).padStart(7, "0")}`} mono />
        )}
        {load?.commodity_type && <DetailRow label="Commodity" value={load.commodity_type} />}
        {load?.weight_tonnes  && <DetailRow label="Weight"    value={`${load.weight_tonnes} tonnes`} />}
        {load?.vehicle_type_req && <DetailRow label="Vehicle"  value={load.vehicle_type_req.replace(/_/g, " ")} />}
      </View>

      {/* Carrier */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Carrier</Text>
        <DetailRow label="Company" value={trip.transporter?.name ?? "—"} />
        {trip.transporter?.phone && <DetailRow label="Phone" value={trip.transporter.phone} />}
        {trip.driver?.full_name && <DetailRow label="Driver" value={trip.driver.full_name} />}
        {trip.driver?.phone     && <DetailRow label="Driver Phone" value={trip.driver.phone} />}
      </View>

      {/* Last ping */}
      {lastPing ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Last Known Location</Text>
          <DetailRow
            label="Coordinates"
            value={`${Number(lastPing.latitude).toFixed(5)}, ${Number(lastPing.longitude).toFixed(5)}`}
            mono
          />
          {lastPing.speed_kmph != null && (
            <DetailRow label="Speed" value={`${lastPing.speed_kmph} km/h`} />
          )}
          <DetailRow
            label="As of"
            value={formatDateTime(lastPing.created_at)}
          />
        </View>
      ) : (
        <View style={[styles.card, styles.noPingCard]}>
          <Ionicons name="location-outline" size={28} color="#cbd5e1" />
          <Text style={styles.noPingText}>No location data yet.</Text>
        </View>
      )}
    </ScrollView>
  );
}

function DetailRow({ label, value, mono }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={[styles.detailValue, mono && styles.mono]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: "#f8fafc" },
  content:      { paddingBottom: 32 },
  center:       { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#f8fafc" },
  errorText:    { fontSize: 16, color: "#64748b", marginBottom: 12 },
  backLink:     { fontSize: 15, color: "#1e4dd0", fontWeight: "600" },
  header:       { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 60, paddingBottom: 16, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#e2e8f0", gap: 10 },
  headerTitle:  { fontSize: 17, fontWeight: "800", color: "#0f172a", flex: 1 },
  statusBadge:  { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  statusText:   { fontSize: 12, fontWeight: "600" },
  card:         { margin: 16, marginBottom: 0, backgroundColor: "#fff", borderRadius: 12, padding: 16, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  cardTitle:    { fontSize: 14, fontWeight: "700", color: "#0f172a", marginBottom: 12 },
  detailRow:    { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: "#f1f5f9" },
  detailLabel:  { fontSize: 13, color: "#64748b" },
  detailValue:  { fontSize: 13, fontWeight: "600", color: "#0f172a", textAlign: "right", flex: 1, marginLeft: 8 },
  mono:         { fontFamily: "monospace", fontSize: 12 },
  noPingCard:   { alignItems: "center", paddingVertical: 24 },
  noPingText:   { fontSize: 14, color: "#94a3b8", marginTop: 8 },
});
