import { useEffect, useState } from "react";
import {
  View, Text, FlatList, TouchableOpacity,
  RefreshControl, StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../../src/lib/supabase";
import { formatDateTime } from "../../src/lib/format";
import { useSidebar } from "../../src/contexts/SidebarContext";

const STATUS_COLOR = {
  pending:    { bg: "#f1f5f9", text: "#475569" },
  in_transit: { bg: "#fff7ed", text: "#ea580c" },
  completed:  { bg: "#f0fdf4", text: "#16a34a" },
  cancelled:  { bg: "#fef2f2", text: "#dc2626" },
};

export default function TripsScreen() {
  const router = useRouter();
  const { openSidebar } = useSidebar();
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function fetchTrips() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.replace("/(auth)/login"); return; }

    // Get driver record for this user
    const { data: driver } = await supabase
      .from("drivers")
      .select("id")
      .eq("user_profile_id", user.id)
      .single();

    if (!driver) { setTrips([]); setLoading(false); return; }

    const { data } = await supabase
      .from("trips")
      .select(`
        id, status, scheduled_pickup_at, actual_pickup_at, estimated_delivery_at,
        load:loads(origin_city, dest_city, commodity, origin_address, dest_address)
      `)
      .eq("driver_id", driver.id)
      .order("scheduled_pickup_at", { ascending: false })
      .limit(30);

    setTrips(data ?? []);
    setLoading(false);
  }

  useEffect(() => { fetchTrips(); }, []);

  const renderTrip = ({ item }) => {
    const colors = STATUS_COLOR[item.status] ?? STATUS_COLOR.pending;
    return (
      <TouchableOpacity
        style={styles.tripCard}
        onPress={() => router.push(`/(app)/trip/${item.id}`)}
        activeOpacity={0.7}
      >
        <View style={styles.tripHeader}>
          <Text style={styles.route}>
            {item.load?.origin_city} → {item.load?.dest_city}
          </Text>
          <View style={[styles.badge, { backgroundColor: colors.bg }]}>
            <Text style={[styles.badgeText, { color: colors.text }]}>
              {item.status.replace(/_/g, " ")}
            </Text>
          </View>
        </View>
        <Text style={styles.commodity}>{item.load?.commodity}</Text>
        {item.scheduled_pickup_at && (
          <Text style={styles.meta}>
            Pickup: {formatDateTime(item.scheduled_pickup_at, { dateStyle: "medium", timeStyle: "short" })}
          </Text>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={openSidebar} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="menu-outline" size={26} color="#0f172a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Trips</Text>
        <View style={{ width: 34 }} />
      </View>

      <FlatList
        data={trips}
        keyExtractor={(t) => t.id}
        renderItem={renderTrip}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={async () => {
            setRefreshing(true);
            await fetchTrips();
            setRefreshing(false);
          }} tintColor="#1e4dd0" />
        }
        ListEmptyComponent={
          !loading ? (
            <Text style={styles.empty}>No trips assigned yet.</Text>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: "#f8fafc" },
  header:      { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 60, paddingBottom: 16, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#e2e8f0" },
  headerTitle: { fontSize: 20, fontWeight: "800", color: "#0f172a", flex: 1, marginHorizontal: 12 },
  list:        { padding: 16, gap: 12 },
  tripCard:    { backgroundColor: "#fff", borderRadius: 12, padding: 16, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  tripHeader:  { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  route:       { fontSize: 15, fontWeight: "700", color: "#0f172a", flex: 1, marginRight: 8 },
  badge:       { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  badgeText:   { fontSize: 11, fontWeight: "600", textTransform: "capitalize" },
  commodity:   { fontSize: 13, color: "#64748b", marginBottom: 4 },
  meta:        { fontSize: 12, color: "#94a3b8" },
  empty:       { textAlign: "center", color: "#94a3b8", marginTop: 60, fontSize: 14 },
});
