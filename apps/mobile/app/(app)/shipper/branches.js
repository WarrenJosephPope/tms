import { useEffect, useState } from "react";
import {
  View, Text, FlatList, TouchableOpacity,
  RefreshControl, StyleSheet, ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../../../src/lib/supabase";
import { useSidebar } from "../../../src/contexts/SidebarContext";

export default function ShipperBranchesScreen() {
  const { openSidebar } = useSidebar();
  const [branches, setBranches] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function fetchBranches() {
    const { data } = await supabase
      .from("company_branches")
      .select("id, name, city, state, is_active")
      .order("name");
    setBranches(data ?? []);
    setLoading(false);
  }

  useEffect(() => { fetchBranches(); }, []);

  const onRefresh = async () => { setRefreshing(true); await fetchBranches(); setRefreshing(false); };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={openSidebar} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="menu-outline" size={26} color="#0f172a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Branches</Text>
        <View style={{ width: 26 }} />
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color="#1e4dd0" />
      ) : (
        <FlatList
          data={branches}
          keyExtractor={(b) => b.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1e4dd0" />}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardRow}>
                <Text style={styles.name}>{item.name}</Text>
                <View style={[styles.badge, item.is_active ? styles.activeBadge : styles.inactiveBadge]}>
                  <Text style={[styles.badgeText, item.is_active ? styles.activeText : styles.inactiveText]}>
                    {item.is_active ? "Active" : "Inactive"}
                  </Text>
                </View>
              </View>
              {(item.city || item.state) && (
                <Text style={styles.location}>{[item.city, item.state].filter(Boolean).join(", ")}</Text>
              )}
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="business-outline" size={36} color="#cbd5e1" />
              <Text style={styles.emptyText}>No branches found.</Text>
              <Text style={styles.emptyHint}>Add branches from the web portal.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: "#f8fafc" },
  header:      { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 60, paddingBottom: 16, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#e2e8f0" },
  headerTitle: { fontSize: 20, fontWeight: "800", color: "#0f172a", flex: 1, marginHorizontal: 12 },
  list:        { padding: 16, paddingBottom: 32 },
  card:        { backgroundColor: "#fff", borderRadius: 12, padding: 14, marginBottom: 10, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2 },
  cardRow:     { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  name:        { fontSize: 15, fontWeight: "700", color: "#0f172a", flex: 1, marginRight: 8 },
  location:    { fontSize: 13, color: "#64748b", marginTop: 3 },
  badge:       { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2 },
  activeBadge: { backgroundColor: "#f0fdf4" },
  inactiveBadge:{ backgroundColor: "#f1f5f9" },
  badgeText:   { fontSize: 11, fontWeight: "600" },
  activeText:  { color: "#16a34a" },
  inactiveText:{ color: "#64748b" },
  empty:       { alignItems: "center", paddingTop: 60 },
  emptyText:   { fontSize: 15, fontWeight: "600", color: "#334155", marginTop: 12 },
  emptyHint:   { fontSize: 13, color: "#94a3b8", marginTop: 4 },
});
