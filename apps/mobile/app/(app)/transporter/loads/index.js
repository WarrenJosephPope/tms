import { useEffect, useState, useCallback } from "react";
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, RefreshControl, ActivityIndicator,
  TextInput,
} from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "../../../../src/lib/supabase";
import { formatINR, timeUntil } from "../../../../src/lib/format";

const PAGE_SIZE = 15;

const VEHICLE_FILTERS = [
  { label: "All", value: "" },
  { label: "Open Trailer", value: "open_trailer" },
  { label: "Container", value: "closed_container" },
  { label: "Flatbed", value: "flatbed" },
  { label: "Tanker", value: "tanker" },
  { label: "Refrigerated", value: "refrigerated" },
  { label: "Mini Truck", value: "mini_truck" },
  { label: "Pickup", value: "pickup" },
];

export default function TransporterLoadsScreen() {
  const router = useRouter();
  const [loads, setLoads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [vehicleFilter, setVehicleFilter] = useState("");
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const fetchLoads = useCallback(async (pageIndex = 0, replace = true) => {
    const from = pageIndex * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let query = supabase
      .from("loads")
      .select("id, load_number, origin_city, dest_city, commodity, opening_price, auction_end_time, vehicle_type_req, weight_tonnes, pickup_date")
      .eq("status", "open")
      .gt("auction_end_time", new Date().toISOString())
      .order("auction_end_time", { ascending: true })
      .range(from, to);

    if (vehicleFilter) query = query.eq("vehicle_type_req", vehicleFilter);

    const { data } = await query;
    const rows = data ?? [];

    setHasMore(rows.length === PAGE_SIZE);
    if (replace) {
      setLoads(rows);
    } else {
      setLoads((prev) => [...prev, ...rows]);
    }
  }, [vehicleFilter]);

  useEffect(() => {
    setLoading(true);
    setPage(0);
    fetchLoads(0, true).finally(() => setLoading(false));
  }, [vehicleFilter]);

  const onRefresh = async () => {
    setRefreshing(true);
    setPage(0);
    await fetchLoads(0, true);
    setRefreshing(false);
  };

  const loadMore = async () => {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    const next = page + 1;
    await fetchLoads(next, false);
    setPage(next);
    setLoadingMore(false);
  };

  const renderLoad = ({ item }) => {
    const isLive = new Date(item.auction_end_time) > new Date();
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => router.push(`/(app)/transporter/loads/${item.id}`)}
        activeOpacity={0.7}
      >
        <View style={styles.cardRow}>
          <Text style={styles.route} numberOfLines={1}>
            {item.origin_city} → {item.dest_city}
          </Text>
          <Text style={styles.price}>{formatINR(item.opening_price)}</Text>
        </View>
        <View style={styles.tags}>
          {item.vehicle_type_req && (
            <View style={styles.tag}><Text style={styles.tagText}>{item.vehicle_type_req.replace(/_/g, " ")}</Text></View>
          )}
          {item.weight_tonnes && (
            <View style={styles.tag}><Text style={styles.tagText}>{item.weight_tonnes}T</Text></View>
          )}
          {item.commodity && (
            <View style={styles.tag}><Text style={styles.tagText}>{item.commodity}</Text></View>
          )}
        </View>
        <View style={[styles.cardRow, { marginTop: 6 }]}>
          <Text style={styles.pickupDate}>
            Pickup: {item.pickup_date
              ? new Date(item.pickup_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })
              : "—"}
          </Text>
          {isLive && item.auction_end_time && (
            <Text style={styles.timer}>Closes in {timeUntil(item.auction_end_time)}</Text>
          )}
        </View>
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
        <Text style={styles.headerTitle}>Load Market</Text>
        <View style={{ width: 50 }} />
      </View>

      {/* Vehicle filter chips */}
      <FlatList
        horizontal
        data={VEHICLE_FILTERS}
        keyExtractor={(f) => f.value}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.chip, vehicleFilter === item.value && styles.chipActive]}
            onPress={() => setVehicleFilter(item.value)}
          >
            <Text style={[styles.chipText, vehicleFilter === item.value && styles.chipTextActive]}>
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
              <Text style={styles.empty}>No open loads right now.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: "#f8fafc" },
  header:          { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 60, paddingBottom: 12, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#e2e8f0" },
  headerTitle:     { fontSize: 18, fontWeight: "800", color: "#0f172a" },
  back:            { fontSize: 14, color: "#1e4dd0", fontWeight: "600", width: 60 },
  filterRow:       { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  chip:            { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: "#f1f5f9", borderWidth: 1, borderColor: "#e2e8f0" },
  chipActive:      { backgroundColor: "#1e4dd0", borderColor: "#1e4dd0" },
  chipText:        { fontSize: 12, fontWeight: "600", color: "#64748b" },
  chipTextActive:  { color: "#fff" },
  list:            { padding: 16, gap: 10, paddingBottom: 32 },
  center:          { flex: 1, justifyContent: "center", alignItems: "center", paddingTop: 60 },
  empty:           { color: "#94a3b8", fontSize: 14, textAlign: "center" },
  card:            { backgroundColor: "#fff", borderRadius: 12, padding: 14, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  cardRow:         { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  route:           { fontSize: 15, fontWeight: "700", color: "#0f172a", flex: 1, marginRight: 8 },
  price:           { fontSize: 15, fontWeight: "700", color: "#16a34a" },
  tags:            { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 6 },
  tag:             { backgroundColor: "#f1f5f9", borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2 },
  tagText:         { fontSize: 11, color: "#64748b", textTransform: "capitalize" },
  pickupDate:      { fontSize: 12, color: "#94a3b8" },
  timer:           { fontSize: 12, color: "#f97316", fontWeight: "600" },
});