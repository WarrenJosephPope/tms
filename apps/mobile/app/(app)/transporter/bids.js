import { useEffect, useState, useCallback } from "react";
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, RefreshControl, ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "../../../src/lib/supabase";
import { formatINR } from "../../../src/lib/format";

const STATUS_FILTERS = [
  { label: "All", value: "" },
  { label: "Active", value: "active" },
  { label: "Won", value: "won" },
  { label: "Lost", value: "lost" },
  { label: "Withdrawn", value: "withdrawn" },
];

const STATUS_COLOR = {
  active:    { bg: "#fff7ed", text: "#ea580c" },
  won:       { bg: "#f0fdf4", text: "#16a34a" },
  lost:      { bg: "#fef2f2", text: "#dc2626" },
  withdrawn: { bg: "#f1f5f9", text: "#64748b" },
};

export default function TransporterBidsScreen() {
  const router = useRouter();
  const [bids, setBids] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchBids = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.replace("/(auth)/login"); return; }

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("company_id")
      .eq("id", user.id)
      .single();

    if (!profile) { setLoading(false); return; }

    const { data } = await supabase
      .from("bids")
      .select("id, amount, status, eta_days, notes, created_at, load:loads(id, origin_city, dest_city, status, auction_end_time)")
      .eq("transporter_company_id", profile.company_id)
      .order("created_at", { ascending: false })
      .limit(100);

    setBids(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchBids(); }, [fetchBids]);

  useEffect(() => {
    if (statusFilter) {
      setFiltered(bids.filter((b) => b.status === statusFilter));
    } else {
      setFiltered(bids);
    }
  }, [bids, statusFilter]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchBids();
    setRefreshing(false);
  };

  const renderBid = ({ item }) => {
    const colors = STATUS_COLOR[item.status] ?? STATUS_COLOR.active;
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => item.load?.id && router.push(`/(app)/transporter/loads/${item.load.id}`)}
        activeOpacity={0.75}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.route} numberOfLines={1}>
            {item.load?.origin_city} → {item.load?.dest_city}
          </Text>
          <View style={[styles.badge, { backgroundColor: colors.bg }]}>
            <Text style={[styles.badgeText, { color: colors.text }]}>{item.status}</Text>
          </View>
        </View>
        <View style={styles.cardRow}>
          <Text style={styles.amount}>{formatINR(item.amount)}</Text>
          {item.eta_days && <Text style={styles.meta}>ETA: {item.eta_days} days</Text>}
        </View>
        <Text style={styles.date}>
          {new Date(item.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
        </Text>
        {item.notes && <Text style={styles.note} numberOfLines={2}>{item.notes}</Text>}
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
        <Text style={styles.headerTitle}>My Bids</Text>
        <View style={{ width: 60 }} />
      </View>

      {/* Status filter chips */}
      <FlatList
        horizontal
        style={{ flexGrow: 0 }}
        data={STATUS_FILTERS}
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
          data={filtered}
          keyExtractor={(b) => b.id}
          renderItem={renderBid}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1e4dd0" />}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.empty}>
                {statusFilter ? `No ${statusFilter} bids.` : "No bids placed yet."}
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
  filterRow:      { paddingHorizontal: 16, paddingVertical: 6, gap: 6 },
  chip:           { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, backgroundColor: "#f1f5f9", borderWidth: 1, borderColor: "#e2e8f0" },
  chipActive:     { backgroundColor: "#1e4dd0", borderColor: "#1e4dd0" },
  chipText:       { fontSize: 11, fontWeight: "600", color: "#64748b" },
  chipTextActive: { color: "#fff" },
  list:           { padding: 16, gap: 10, paddingBottom: 32 },
  center:         { flex: 1, justifyContent: "center", alignItems: "center", paddingTop: 60 },
  empty:          { color: "#94a3b8", fontSize: 14, textAlign: "center" },
  card:           { backgroundColor: "#fff", borderRadius: 12, padding: 14, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  cardHeader:     { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  route:          { fontSize: 14, fontWeight: "700", color: "#0f172a", flex: 1, marginRight: 8 },
  badge:          { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText:      { fontSize: 11, fontWeight: "600", textTransform: "capitalize" },
  cardRow:        { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  amount:         { fontSize: 15, fontWeight: "700", color: "#16a34a" },
  meta:           { fontSize: 12, color: "#64748b" },
  date:           { fontSize: 11, color: "#94a3b8" },
  note:           { fontSize: 12, color: "#475569", marginTop: 4, fontStyle: "italic" },
});