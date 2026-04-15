import { useEffect, useState } from "react";
import {
  View, Text, FlatList, TouchableOpacity,
  RefreshControl, StyleSheet, ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../../../src/lib/supabase";
import { useSidebar } from "../../../src/contexts/SidebarContext";

export default function TransporterDriversScreen() {
  const { openSidebar } = useSidebar();
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function fetchDrivers() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: prof } = await supabase
      .from("user_profiles")
      .select("company_id")
      .eq("id", user.id)
      .single();

    if (!prof) { setLoading(false); return; }

    const { data } = await supabase
      .from("user_profiles")
      .select("id, full_name, phone, transporter_role")
      .eq("company_id", prof.company_id)
      .eq("transporter_role", "driver")
      .order("full_name");

    setDrivers(data ?? []);
    setLoading(false);
  }

  useEffect(() => { fetchDrivers(); }, []);
  const onRefresh = async () => { setRefreshing(true); await fetchDrivers(); setRefreshing(false); };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={openSidebar} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="menu-outline" size={26} color="#0f172a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Drivers</Text>
        <View style={{ width: 26 }} />
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color="#1e4dd0" />
      ) : (
        <FlatList
          data={drivers}
          keyExtractor={(d) => d.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1e4dd0" />}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {(item.full_name ?? "?")[0].toUpperCase()}
                </Text>
              </View>
              <View style={styles.info}>
                <Text style={styles.name}>{item.full_name ?? "—"}</Text>
                {item.phone && <Text style={styles.phone}>{item.phone}</Text>}
              </View>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="person-outline" size={36} color="#cbd5e1" />
              <Text style={styles.emptyText}>No drivers found.</Text>
              <Text style={styles.emptyHint}>Add drivers from the web portal.</Text>
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
  card:        { backgroundColor: "#fff", borderRadius: 12, padding: 14, marginBottom: 10, flexDirection: "row", alignItems: "center", gap: 12, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2 },
  avatar:      { width: 40, height: 40, borderRadius: 20, backgroundColor: "#eff3ff", alignItems: "center", justifyContent: "center" },
  avatarText:  { fontSize: 16, fontWeight: "700", color: "#1e4dd0" },
  info:        { flex: 1 },
  name:        { fontSize: 15, fontWeight: "700", color: "#0f172a" },
  phone:       { fontSize: 13, color: "#64748b", marginTop: 2 },
  empty:       { alignItems: "center", paddingTop: 60 },
  emptyText:   { fontSize: 15, fontWeight: "600", color: "#334155", marginTop: 12 },
  emptyHint:   { fontSize: 13, color: "#94a3b8", marginTop: 4 },
});
