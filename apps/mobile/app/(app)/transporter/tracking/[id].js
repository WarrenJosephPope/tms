import { useEffect, useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity,
  RefreshControl, StyleSheet, ActivityIndicator, Alert,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../../../../src/lib/supabase";

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

const VALID_TRANSITIONS = {
  assigned:   "in_transit",
  in_transit: "delivered",
};

const TRANSITION_LABEL = {
  assigned:   "Confirm Pickup",
  in_transit: "Mark Delivered",
};

const TRANSITION_COLOR = {
  assigned:   "#1e4dd0",
  in_transit: "#16a34a",
};

export default function TransporterTripDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [trip, setTrip]         = useState(null);
  const [companyId, setCompanyId] = useState(null);
  const [loading, setLoading]     = useState(true);
  const [updating, setUpdating]   = useState(false);
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
    setCompanyId(prof.company_id);

    const { data } = await supabase
      .from("trips")
      .select(`
        id, status, created_at,
        load:loads(
          id, load_number, origin_city, dest_city,
          commodity_type, weight_tonnes, vehicle_type_req
        ),
        shipper:companies!trips_shipper_company_id_fkey(name, phone),
        driver:drivers(full_name, phone)
      `)
      .eq("id", id)
      .eq("transporter_company_id", prof.company_id)
      .single();

    setTrip(data ?? null);
    setLoading(false);
  }

  useEffect(() => { fetchTrip(); }, [id]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchTrip();
    setRefreshing(false);
  };

  async function advanceStatus() {
    if (!trip || updating) return;
    const nextStatus = VALID_TRANSITIONS[trip.status];
    if (!nextStatus) return;

    Alert.alert(
      TRANSITION_LABEL[trip.status],
      `Confirm you want to mark this trip as "${STATUS_LABEL[nextStatus]}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm",
          onPress: async () => {
            setUpdating(true);
            try {
              const { error } = await supabase
                .from("trips")
                .update({ status: nextStatus })
                .eq("id", id)
                .eq("transporter_company_id", companyId);
              if (error) throw error;
              await fetchTrip();
            } catch (err) {
              Alert.alert("Error", err?.message ?? "Failed to update status");
            } finally {
              setUpdating(false);
            }
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
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backLink}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const statusColors = STATUS_COLOR[trip.status] ?? { bg: "#f1f5f9", text: "#475569" };
  const load = trip.load;
  const nextAction = VALID_TRANSITIONS[trip.status];

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

      {/* Cargo */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Cargo</Text>
        {load?.load_number && (
          <DetailRow label="Load #" value={`#${String(load.load_number).padStart(7, "0")}`} mono />
        )}
        {load?.commodity_type   && <DetailRow label="Commodity" value={load.commodity_type} />}
        {load?.weight_tonnes    && <DetailRow label="Weight" value={`${load.weight_tonnes} tonnes`} />}
        {load?.vehicle_type_req && <DetailRow label="Vehicle" value={load.vehicle_type_req.replace(/_/g, " ")} />}
      </View>

      {/* Shipper */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Shipper</Text>
        <DetailRow label="Company" value={trip.shipper?.name ?? "—"} />
        {trip.shipper?.phone && <DetailRow label="Phone" value={trip.shipper.phone} />}
      </View>

      {/* Driver */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Driver</Text>
        <DetailRow label="Name" value={trip.driver?.full_name ?? "Not assigned"} />
        {trip.driver?.phone && <DetailRow label="Phone" value={trip.driver.phone} />}
      </View>

      {/* Action button */}
      {nextAction && (
        <TouchableOpacity
          style={[
            styles.actionBtn,
            { backgroundColor: TRANSITION_COLOR[trip.status] },
            updating && styles.actionBtnDisabled,
          ]}
          onPress={advanceStatus}
          disabled={updating}
          activeOpacity={0.8}
        >
          <Ionicons
            name={trip.status === "assigned" ? "navigate-outline" : "checkmark-circle-outline"}
            size={18}
            color="#fff"
          />
          <Text style={styles.actionBtnText}>
            {updating ? "Updating…" : TRANSITION_LABEL[trip.status]}
          </Text>
        </TouchableOpacity>
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
  container:       { flex: 1, backgroundColor: "#f8fafc" },
  content:         { paddingBottom: 40 },
  center:          { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#f8fafc" },
  errorText:       { fontSize: 16, color: "#64748b", marginBottom: 12 },
  backLink:        { fontSize: 15, color: "#1e4dd0", fontWeight: "600" },
  header:          { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 60, paddingBottom: 16, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#e2e8f0", gap: 10 },
  headerTitle:     { fontSize: 17, fontWeight: "800", color: "#0f172a", flex: 1 },
  statusBadge:     { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  statusText:      { fontSize: 12, fontWeight: "600" },
  card:            { margin: 16, marginBottom: 0, backgroundColor: "#fff", borderRadius: 12, padding: 16, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  cardTitle:       { fontSize: 14, fontWeight: "700", color: "#0f172a", marginBottom: 12 },
  detailRow:       { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: "#f1f5f9" },
  detailLabel:     { fontSize: 13, color: "#64748b" },
  detailValue:     { fontSize: 13, fontWeight: "600", color: "#0f172a", textAlign: "right", flex: 1, marginLeft: 8 },
  mono:            { fontFamily: "monospace", fontSize: 12 },
  actionBtn:       { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, margin: 16, padding: 15, borderRadius: 12 },
  actionBtnDisabled: { opacity: 0.5 },
  actionBtnText:   { color: "#fff", fontSize: 15, fontWeight: "700" },
});
