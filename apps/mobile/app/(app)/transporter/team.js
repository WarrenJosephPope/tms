import { View, TouchableOpacity, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSidebar } from "../../../src/contexts/SidebarContext";
import ComingSoonScreen from "../../../src/components/ComingSoonScreen";

export default function TransporterTeamScreen() {
  const { openSidebar } = useSidebar();
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={openSidebar} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="menu-outline" size={26} color="#0f172a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Team</Text>
        <View style={{ width: 26 }} />
      </View>
      <ComingSoonScreen
        title="Team Management"
        icon="people-outline"
        message="Manage your team members from the web portal. Mobile team management is coming soon."
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: "#f8fafc" },
  header:      { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 60, paddingBottom: 16, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#e2e8f0" },
  headerTitle: { fontSize: 20, fontWeight: "800", color: "#0f172a", flex: 1, marginHorizontal: 12 },
});
