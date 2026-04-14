import { useEffect, useState, useCallback } from "react";
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, RefreshControl, ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "../../../../src/lib/supabase";
import { formatINR, formatLoadNumber } from "../../../../src/lib/format";

const STATUSES = ["open", "under_review", "awarded", "assigned", "in_transit", "delivered", "cancelled", "expired"];

const STATUS_COLOR = {
  open:         { bg: "#fff7ed", text: "#ea580c" },
  under_review: { bg: "#fdf4ff", text: "#9333ea" },
  awarded:      { bg: "#f0f9ff", text: "#0284c7" },
  assigned:     { bg: "#eff6ff", text: "#2563eb" },
  in_transit:   { bg: "#fff7ed", text: "#f97316" },
  delivered:    { bg: "#f0fdf4", text: "#16a34a" },
  cancelled:    { bg: "#fef2f2", text: "#dc2626" },
  expired:      { bg: "#f1f5f9", text: "#64748b" },
};

const PAGE_SIZE = 20;

export default function ShipperLoadsScreen() {
  const router = useRouter();
  const [loads, setLoads] = useState([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [companyId, setCompanyId] = useState(null);

  const fetchLoads = useCallback(async (compId, pageIndex = 0, replace = true) => {
    const from = pageIndex * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let query = supabase
      .from("loads")
      .select("id, load_number, origin_city, dest_city, commodity, opening_price, status, auction_end_time, pickup_date, weight_tonnes")
      .eq("shipper_company_id", compId)
      .order("created_at", { ascending: false })
      .range(from, to);

    if (statusFilter) query = query.eq("status", statusFilter);

    const { data } = await query;
    const rows = data ?? [];
    setHasMore(rows.length === PAGE_SIZE);
    if (replace) {
      setLoads(rows);
    } else {
      setLoads((prev) => [...prev, ...rows]);
    }
  }, [statusFilter]);

  useEffect(() => {
    async function init() {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/(auth)/login"); return; }
      const { data: profile } = await supabase
        .from("user_profiles").select("company_id").eq("id", user.id).single();
      if (!profile) { setLoading(false); return; }
      setCompanyId(profile.company_id);
      // Transition any open loads whose auction has ended to the correct status
      await supabase.rpc("transition_expired_loads", { p_company_id: profile.company_id });
      setPage(0);
      await fetchLoads(profile.company_id, 0, true);
      setLoading(false);
    }
    init();
  }, [statusFilter]);

  const onRefresh = async () => {
    if (!companyId) return;
    setRefreshing(true);
    setPage(0);
    await fetchLoads(companyId, 0, true);
    setRefreshing(false);
  };

  const loadMore = async () => {
    if (!companyId || !hasMore || loadingMore) return;
    setLoadingMore(true);
    const next = page + 1;
    await fetchLoads(companyId, next, false);
    setPage(next);
    setLoadingMore(false);
  };

  const renderLoad = ({ item }) => {
    const colors = STATUS_COLOR[item.status] ?? STATUS_COLOR.expired;
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => router.push(`/(app)/shipper/loads/${item.id}`)}
        activeOpacity={0.7}
      >
        <View style={styles.cardRow}>
          <View style={styles.cardLeft}>
            <Text style={styles.loadNum}>{formatLoadNumber(item.load_number)}</Text>
            <Text style={styles.route} numberOfLines={1}>
              {item.origin_city} → {item.dest_city}
            </Text>
            <Text style={styles.meta}>{item.commodity}{item.weight_tonnes ? ` · ${item.weight_tonnes}T` : ""}</Text>
          </View>
          <View style={styles.cardRight}>
            <Text style={styles.price}>{formatINR(item.opening_price)}</Text>
            <View style={[styles.badge, { backgroundColor: colors.bg }]}>
              <Text style={[styles.badgeText, { color: colors.text }]}>
                {item.status.replace(/_/g, " ")}
              </Text>
            </View>
          </View>
        </View>
        {item.pickup_date && (
          <Text style={styles.pickupDate}>
            Pickup: {new Date(item.pickup_date).toLocaleDateString("en-IN", { dateStyle: "medium" })}
          </Text>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Loads</Text>
        <View style={{ width: 60 }} />
      </View>

      {/* Status filter chips */}
      <FlatList
        horizontal
        style={{ flexGrow: 0 }}
        data={[{ label: "All", value: "" }, ...STATUSES.map((s) => ({ label: s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()), value: s }))]}
        keyExtractor={(f) => f.value || "all"}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.chip, statusFilter === item.value && styles.chipActive]}
            onPress={() => setStatusFilter(item.value)}
          >
            <Text style={[styles.chipText, statusFilter === item.value && styles.chipTextActive]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        )}
      />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color="#1e4dd0" size="large" />
        </View>
      ) : (
        <FlatList
          data={loads}
          keyExtractor={(l) => l.id}
          renderItem={renderLoad}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1e4dd0" />}
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          ListFooterComponent={loadingMore ? <ActivityIndicator color="#1e4dd0" style={{ marginVertical: 16 }} /> : null}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.empty}>
                {statusFilter ? "No loads with this status." : "No loads posted yet."}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: "#f8fafc" },
  header:         { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 60, paddingBottom: 12, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#e2e8f0" },
  headerTitle:    { fontSize: 18, fontWeight: "800", color: "#0f172a" },
  back:           { fontSize: 14, color: "#1e4dd0", fontWeight: "600", width: 60 },
  filterRow:      { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  chip:           { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: "#f1f5f9", borderWidth: 1, borderColor: "#e2e8f0" },
  chipActive:     { backgroundColor: "#1e4dd0", borderColor: "#1e4dd0" },
  chipText:       { fontSize: 12, fontWeight: "600", color: "#64748b" },
  chipTextActive: { color: "#fff" },
  list:           { padding: 16, gap: 10, paddingBottom: 32 },
  center:         { flex: 1, justifyContent: "center", alignItems: "center", paddingTop: 60 },
  empty:          { color: "#94a3b8", fontSize: 14, textAlign: "center" },
  card:           { backgroundColor: "#fff", borderRadius: 12, padding: 14, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  cardRow:        { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 },
  cardLeft:       { flex: 1, marginRight: 10 },
  cardRight:      { alignItems: "flex-end", gap: 6 },
  loadNum:        { fontSize: 10, fontFamily: "monospace", color: "#94a3b8", marginBottom: 2 },
  route:          { fontSize: 14, fontWeight: "700", color: "#0f172a", marginBottom: 2 },
  meta:           { fontSize: 12, color: "#64748b" },
  price:          { fontSize: 14, fontWeight: "700", color: "#16a34a" },
  badge:          { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText:      { fontSize: 11, fontWeight: "600", textTransform: "capitalize" },
  pickupDate:     { fontSize: 11, color: "#94a3b8", marginTop: 4 },
});