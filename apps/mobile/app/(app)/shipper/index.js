import { useEffect, useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../../../src/lib/supabase";
import { formatINR, timeUntil } from "../../../src/lib/format";
import { useSidebar } from "../../../src/contexts/SidebarContext";

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

export default function ShipperDashboard() {
  const router = useRouter();
  const { openSidebar } = useSidebar();
  const [state, setState] = useState({
    recentLoads: [],
    openCount: 0,
    needsAwardCount: 0,
    activeTripsCount: 0,
    activeTrips: [],
    userName: "",
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function fetchData() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.replace("/(auth)/login"); return; }

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("company_id, full_name")
      .eq("id", user.id)
      .single();

    if (!profile) { setLoading(false); return; }
    const companyId = profile.company_id;
    const userName = profile.full_name ?? user.user_metadata?.full_name ?? user.user_metadata?.name ?? user.email;

    // Transition any open loads whose auction has ended to the correct status
    await supabase.rpc("transition_expired_loads", { p_company_id: companyId });

    const nowIso = new Date().toISOString();

    const [loadsRes, openCountRes, activeTripsRes, needsAwardRes] = await Promise.all([
      supabase
        .from("loads")
        .select("id, load_number, origin_city, dest_city, opening_price, status, auction_end_time, pickup_date, commodity")
        .eq("shipper_company_id", companyId)
        .order("created_at", { ascending: false })
        .limit(6),
      supabase
        .from("loads")
        .select("id", { count: "exact", head: true })
        .eq("shipper_company_id", companyId)
        .eq("status", "open")
        .gt("auction_end_time", nowIso),
      supabase
        .from("trips")
        .select("id, load:loads(origin_city, dest_city)")
        .eq("shipper_company_id", companyId)
        .eq("status", "in_transit"),
      supabase
        .from("loads")
        .select("id", { count: "exact", head: true })
        .eq("shipper_company_id", companyId)
        .eq("status", "under_review"),
    ]);

    setState({
      recentLoads: loadsRes.data ?? [],
      openCount: openCountRes.count ?? 0,
      needsAwardCount: needsAwardRes.count ?? 0,
      activeTripsCount: activeTripsRes.data?.length ?? 0,
      activeTrips: activeTripsRes.data ?? [],
      userName,
    });
    setLoading(false);
  }

  useEffect(() => { fetchData(); }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1e4dd0" />}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={openSidebar}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="menu-outline" size={26} color="#0f172a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{state.userName || "Shipper"}</Text>
        <TouchableOpacity
          style={styles.postBtn}
          onPress={() => router.push("/(app)/shipper/loads/new")}
          activeOpacity={0.8}
        >
          <Ionicons name="add" size={18} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Stats grid */}
      <View style={styles.statsGrid}>
        <StatCard label="Total Loads" value={state.recentLoads.length} color="#1e4dd0" />
        <StatCard label="Live Auctions" value={state.openCount} color="#8b5cf6" />
        <StatCard label="Active Trips" value={state.activeTripsCount} color="#16a34a" />
        <StatCard label="Needs Award" value={state.needsAwardCount} color="#f59e0b" />
      </View>

      {/* Active trips */}
      {state.activeTrips.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Active Trips</Text>
          {state.activeTrips.map((trip) => (
            <View key={trip.id} style={styles.tripItem}>
              <View style={[styles.tripDot, { backgroundColor: "#1e4dd0" }]} />
              <Text style={styles.tripRoute} numberOfLines={1}>
                {trip.load?.origin_city} → {trip.load?.dest_city}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Recent loads */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Loads</Text>
          <TouchableOpacity onPress={() => router.push("/(app)/shipper/loads/")}>
            <Text style={styles.sectionLink}>View all →</Text>
          </TouchableOpacity>
        </View>
        {state.recentLoads.length === 0 ? (
          <Text style={styles.empty}>No loads posted yet.</Text>
        ) : (
          state.recentLoads.map((load) => {
            const colors = LOAD_STATUS_COLOR[load.status] ?? LOAD_STATUS_COLOR.expired;
            const isLive = load.status === "open" && load.auction_end_time && new Date(load.auction_end_time) > new Date();
            return (
              <TouchableOpacity
                key={load.id}
                style={styles.loadCard}
                onPress={() => router.push(`/(app)/shipper/loads/${load.id}`)}
                activeOpacity={0.7}
              >
                <View style={styles.loadRow}>
                  <Text style={styles.loadRoute} numberOfLines={1}>
                    {load.origin_city} → {load.dest_city}
                  </Text>
                  <View style={[styles.badge, { backgroundColor: colors.bg }]}>
                    <Text style={[styles.badgeText, { color: colors.text }]}>
                      {load.status.replace(/_/g, " ")}
                    </Text>
                  </View>
                </View>
                <View style={styles.loadRow}>
                  <Text style={styles.loadMeta}>{load.commodity} · {formatINR(load.opening_price)}</Text>
                  {isLive && (
                    <Text style={styles.auctionTimer}>{timeUntil(load.auction_end_time)}</Text>
                  )}
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </View>
    </ScrollView>
  );
}

function StatCard({ label, value, color }) {
  return (
    <View style={[styles.statCard, { borderTopColor: color, borderTopWidth: 3 }]}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container:     { flex: 1, backgroundColor: "#f8fafc" },
  content:       { paddingBottom: 32 },
  header:        { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 60, paddingBottom: 16, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#e2e8f0" },
  headerTitle:   { fontSize: 20, fontWeight: "800", color: "#0f172a", flex: 1, marginHorizontal: 12 },
  postBtn:       { backgroundColor: "#1e4dd0", borderRadius: 20, width: 34, height: 34, alignItems: "center", justifyContent: "center" },
  statsGrid:     { flexDirection: "row", flexWrap: "wrap", padding: 12, gap: 8 },
  statCard:      { flex: 1, minWidth: "45%", backgroundColor: "#fff", borderRadius: 12, padding: 16, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2 },
  statValue:     { fontSize: 28, fontWeight: "800", marginBottom: 2 },
  statLabel:     { fontSize: 12, color: "#64748b", fontWeight: "500" },
  section:       { marginHorizontal: 16, marginTop: 8, backgroundColor: "#fff", borderRadius: 12, padding: 16, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2, marginBottom: 12 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  sectionTitle:  { fontSize: 14, fontWeight: "700", color: "#0f172a", marginBottom: 10 },
  sectionLink:   { fontSize: 13, color: "#1e4dd0", fontWeight: "600" },
  tripItem:      { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#f1f5f9" },
  tripDot:       { width: 8, height: 8, borderRadius: 4 },
  tripRoute:     { fontSize: 14, fontWeight: "600", color: "#0f172a", flex: 1 },
  loadCard:      { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#f1f5f9" },
  loadRow:       { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  loadRoute:     { fontSize: 14, fontWeight: "700", color: "#0f172a", flex: 1, marginRight: 8 },
  loadMeta:      { fontSize: 12, color: "#64748b", flex: 1 },
  badge:         { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText:     { fontSize: 11, fontWeight: "600", textTransform: "capitalize" },
  auctionTimer:  { fontSize: 12, color: "#f97316", fontWeight: "600" },
  empty:         { color: "#94a3b8", fontSize: 13, textAlign: "center", paddingVertical: 16 },
});