import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

/**
 * Generic "coming soon" placeholder used for screens that are
 * planned but not yet fully implemented on mobile.
 */
export default function ComingSoonScreen({ title, icon = "construct-outline", message }) {
  return (
    <View style={styles.container}>
      <Ionicons name={icon} size={48} color="#cbd5e1" />
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>
        {message ?? "This screen is coming soon. Use the web portal to manage this area."}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f8fafc",
    paddingHorizontal: 32,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#334155",
    marginTop: 18,
    marginBottom: 8,
    textAlign: "center",
  },
  message: {
    fontSize: 14,
    color: "#94a3b8",
    textAlign: "center",
    lineHeight: 22,
  },
});
