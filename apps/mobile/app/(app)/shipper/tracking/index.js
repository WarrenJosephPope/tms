import { useEffect, useState } from "react";
import {
  View, Text, FlatList, TouchableOpacity,
  RefreshControl, StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../../../../src/lib/supabase";
import { useSidebar } from "../../../../src/contexts/SidebarContext";
import { profileHasModule, MODULES } from "../../../../src/lib/modules";

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

export default function ShipperTrackingScreen() {
  const router = useRouter();
  const { openSidebar, profile } = useSidebar();
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function fetchTrips() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.replace("/(auth)/login"); return; }

    const { data: prof } = await supabase
      .from("user_profiles")
      .select("company_id")
      .eq("id", user.id)
      .single();

    if (!prof) { setLoading(false); return; }

    const { data } = await supabase
      .from("trips")
      .select(`
        id, status, created_at,
        load:loads(id, load_number, origin_city, dest_city, commodity_type),
        transporter:companies!trips_transporter_company_id_fkey(name)
      `)
      .eq("shipper_company_id", prof.company_id)
      .order("created_at", { ascending: false });

    setTrips(data ?? []);
    setLoading(false);
  }

  useEffect(() => { fetchTrips(); }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchTrips();
    setRefreshing(false);
  };

  const trackingEnabled = profileHasModule(profile, MODULES.TRACKING);

  if (!trackingEnabled) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={openSidebar} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="menu-outline" size={26} color="#0f172a" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Trips</Text>
          <View style={{ width: 26 }} />
        </View>
        <View style={styles.emptyState}>
          <Ionicons name="lock-closed-outline" size={40} color="#cbd5e1" />
          <Text style={styles.emptyTitle}>Tracking not enabled</Text>
          <Text style={styles.emptyText}>
            Contact your administrator to enable the Tracking module.
          </Text>
        </View>
      </View>
    );
  }

  const renderTrip = ({ item }) => {
    const colors = STATUS_COLOR[item.status] ?? { bg: "#f1f5f9", text: "#475569" };
    const label  = STATUS_LABEL[item.status] ?? item.status;
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => router.push(`/(app)/shipper/tracking/${item.id}`)}
        activeOpacity={0.7}
      >
        <View style={styles.cardRow}>
          <Text style={styles.route} numberOfLines={1}>
            {item.load?.origin_city} → {item.load?.dest_city}
          </Text>
          <View style={[styles.badge, { backgroundColor: colors.bg }]}>
            <Text style={[styles.badgeText, { color: colors.text }]}>{label}</Text>
          </View>
        </View>
        <View style={styles.cardRow}>
          {item.load?.load_number && (
            <Text style={styles.loadNumber}>
              #{String(item.load.load_number).padStart(7, "0")}
            </Text>
          )}
          {item.transporter?.name && (
            <Text style={styles.meta} numberOfLines={1}>
              {item.transporter.name}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={openSidebar} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="menu-outline" size={26} color="#0f172a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Trips</Text>
        <View style={{ width: 26 }} />
      </View>

      <FlatList
        data={trips}
        keyExtractor={(t) => t.id}
        renderItem={renderTrip}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1e4dd0" />}
        ListEmptyComponent={
          !loading && (
            <View style={styles.emptyState}>
              <Ionicons name="map-outline" size={40} color="#cbd5e1" />
              <Text style={styles.emptyTitle}>No trips yet</Text>
              <Text style={styles.emptyText}>
                Trips appear here after you award a load to a carrier.
              </Text>
            </View>
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: "#f8fafc" },
  header:     { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 60, paddingBottom: 16, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#e2e8f0" },
  headerTitle:{ fontSize: 20, fontWeight: "800", color: "#0f172a", flex: 1, marginHorizontal: 12 },
  list:       { padding: 16, paddingBottom: 32 },
  card:       { backgroundColor: "#fff", borderRadius: 12, padding: 14, marginBottom: 10, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  cardRow:    { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  route:      { fontSize: 15, fontWeight: "700", color: "#0f172a", flex: 1, marginRight: 8 },
  loadNumber: { fontSize: 12, color: "#94a3b8", fontFamily: "monospace" },
  meta:       { fontSize: 12, color: "#64748b", flex: 1, textAlign: "right" },
  badge:      { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText:  { fontSize: 11, fontWeight: "600" },
  emptyState: { alignItems: "center", justifyContent: "center", paddingTop: 80, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: "#334155", marginTop: 14, marginBottom: 6 },
  emptyText:  { fontSize: 14, color: "#94a3b8", textAlign: "center", lineHeight: 20 },
});
