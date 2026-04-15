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
import { hasModule, MODULES } from "../../../src/lib/modules";

const STATUS_COLOR = {
  active:    { bg: "#fff7ed", text: "#ea580c" },
  won:       { bg: "#f0fdf4", text: "#16a34a" },
  lost:      { bg: "#fef2f2", text: "#dc2626" },
  withdrawn: { bg: "#f1f5f9", text: "#64748b" },
};

export default function TransporterDashboard() {
  const router = useRouter();
  const { openSidebar, profile: sidebarProfile } = useSidebar();
  const [state, setState] = useState({
    companyId: null,
    openLoadsCount: 0,
    activeBidsCount: 0,
    activeTripsCount: 0,
    wonBidsCount: 0,
    latestLoads: [],
    recentBids: [],
    userName: "",
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const hasBidding  = hasModule(sidebarProfile?.company?.modules, MODULES.BIDDING);
  const hasTracking = hasModule(sidebarProfile?.company?.modules, MODULES.TRACKING);

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

    const [openLoadsRes, myBidsRes, activeTripsRes] = await Promise.all([
      hasBidding
        ? supabase
            .from("loads")
            .select("id, load_number, origin_city, dest_city, opening_price, auction_end_time, vehicle_type_req, commodity, weight_tonnes", { count: "exact" })
            .eq("status", "open")
            .gt("auction_end_time", new Date().toISOString())
            .order("auction_end_time", { ascending: true })
            .limit(5)
        : Promise.resolve({ data: [], count: 0 }),
      hasBidding
        ? supabase
            .from("bids")
            .select("id, amount, status, load:loads(id, origin_city, dest_city, status)")
            .eq("transporter_company_id", companyId)
            .order("created_at", { ascending: false })
            .limit(10)
        : Promise.resolve({ data: [] }),
      hasTracking
        ? supabase
            .from("trips")
            .select("id", { count: "exact", head: true })
            .eq("transporter_company_id", companyId)
            .in("status", ["assigned", "in_transit"])
        : Promise.resolve({ count: 0 }),
    ]);

    const bids = myBidsRes.data ?? [];
    setState({
      companyId,
      openLoadsCount: openLoadsRes.count ?? 0,
      activeBidsCount: bids.filter((b) => b.status === "active").length,
      activeTripsCount: activeTripsRes.count ?? 0,
      wonBidsCount: bids.filter((b) => b.status === "won").length,
      latestLoads: openLoadsRes.data ?? [],
      recentBids: bids.slice(0, 5),
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
        <Text style={styles.headerTitle}>{state.userName || "Transporter"}</Text>
        <View style={{ width: 34 }} />
      </View>

      {/* Stats grid */}
      <View style={styles.statsGrid}>
        {hasBidding && <StatCard label="Open Loads" value={state.openLoadsCount} color="#1e4dd0" />}
        {hasBidding && <StatCard label="Active Bids" value={state.activeBidsCount} color="#8b5cf6" />}
        {hasTracking && <StatCard label="Active Trips" value={state.activeTripsCount} color="#16a34a" />}
        {hasBidding && <StatCard label="Loads Won" value={state.wonBidsCount} color="#0ea5e9" />}
      </View>

      {/* Latest open loads */}
      {hasBidding && <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Latest Open Loads</Text>
          <TouchableOpacity onPress={() => router.push("/(app)/transporter/loads/")}>
            <Text style={styles.sectionLink}>Browse all →</Text>
          </TouchableOpacity>
        </View>
        {state.latestLoads.length === 0 ? (
          <Text style={styles.empty}>No open loads right now.</Text>
        ) : (
          state.latestLoads.map((load) => (
            <TouchableOpacity
              key={load.id}
              style={styles.loadCard}
              onPress={() => router.push(`/(app)/transporter/loads/${load.id}`)}
              activeOpacity={0.7}
            >
              <View style={styles.loadCardRow}>
                <Text style={styles.loadRoute} numberOfLines={1}>
                  {load.origin_city} → {load.dest_city}
                </Text>
                <Text style={styles.loadPrice}>{formatINR(load.opening_price)}</Text>
              </View>
              <View style={styles.loadCardRow}>
                <Text style={styles.loadMeta}>
                  {load.vehicle_type_req?.replace(/_/g, " ")}
                  {load.weight_tonnes ? ` · ${load.weight_tonnes}T` : ""}
                  {load.commodity ? ` · ${load.commodity}` : ""}
                </Text>
                {load.auction_end_time && (
                  <Text style={styles.loadTimer}>
                    {timeUntil(load.auction_end_time)}
                  </Text>
                )}
              </View>
            </TouchableOpacity>
          ))
        )}
      </View>}

      {/* Recent bids */}
      {hasBidding && <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>My Recent Bids</Text>
          <TouchableOpacity onPress={() => router.push("/(app)/transporter/bids")}>
            <Text style={styles.sectionLink}>View all →</Text>
          </TouchableOpacity>
        </View>
        {state.recentBids.length === 0 ? (
          <Text style={styles.empty}>No bids placed yet.</Text>
        ) : (
          state.recentBids.map((bid) => {
            const colors = STATUS_COLOR[bid.status] ?? STATUS_COLOR.active;
            return (
              <TouchableOpacity
                key={bid.id}
                style={styles.bidCard}
                onPress={() => bid.load?.id && router.push(`/(app)/transporter/loads/${bid.load.id}`)}
                activeOpacity={0.7}
              >
                <Text style={styles.bidRoute} numberOfLines={1}>
                  {bid.load?.origin_city} → {bid.load?.dest_city}
                </Text>
                <View style={styles.bidRight}>
                  <Text style={styles.bidAmount}>{formatINR(bid.amount)}</Text>
                  <View style={[styles.badge, { backgroundColor: colors.bg }]}>
                    <Text style={[styles.badgeText, { color: colors.text }]}>
                      {bid.status}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </View>}

      {/* Active trips shortcut (tracking module) */}
      {hasTracking && state.activeTripsCount > 0 && (
        <TouchableOpacity
          style={styles.section}
          onPress={() => router.push("/(app)/transporter/tracking/")}
          activeOpacity={0.7}
        >
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Active Trips</Text>
            <Text style={styles.sectionLink}>View all →</Text>
          </View>
          <Text style={{ fontSize: 32, fontWeight: "800", color: "#16a34a" }}>
            {state.activeTripsCount}
          </Text>
          <Text style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
            trip{state.activeTripsCount !== 1 ? "s" : ""} currently in progress
          </Text>
        </TouchableOpacity>
      )}
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
  statsGrid:     { flexDirection: "row", flexWrap: "wrap", padding: 12, gap: 8 },
  statCard:      { flex: 1, minWidth: "45%", backgroundColor: "#fff", borderRadius: 12, padding: 16, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2 },
  statValue:     { fontSize: 28, fontWeight: "800", marginBottom: 2 },
  statLabel:     { fontSize: 12, color: "#64748b", fontWeight: "500" },
  section:       { marginHorizontal: 16, marginTop: 8, backgroundColor: "#fff", borderRadius: 12, padding: 16, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2, marginBottom: 12 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  sectionTitle:  { fontSize: 14, fontWeight: "700", color: "#0f172a" },
  sectionLink:   { fontSize: 13, color: "#1e4dd0", fontWeight: "600" },
  loadCard:      { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#f1f5f9" },
  loadCardRow:   { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 2 },
  loadRoute:     { fontSize: 14, fontWeight: "700", color: "#0f172a", flex: 1, marginRight: 8 },
  loadPrice:     { fontSize: 14, fontWeight: "700", color: "#16a34a" },
  loadMeta:      { fontSize: 12, color: "#64748b", flex: 1 },
  loadTimer:     { fontSize: 12, color: "#f97316", fontWeight: "600" },
  bidCard:       { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#f1f5f9" },
  bidRoute:      { fontSize: 14, fontWeight: "600", color: "#0f172a", flex: 1, marginRight: 8 },
  bidRight:      { flexDirection: "row", alignItems: "center", gap: 8 },
  bidAmount:     { fontSize: 13, fontWeight: "600", color: "#475569" },
  badge:         { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText:     { fontSize: 11, fontWeight: "600", textTransform: "capitalize" },
  empty:         { color: "#94a3b8", fontSize: 13, textAlign: "center", paddingVertical: 16 },
});