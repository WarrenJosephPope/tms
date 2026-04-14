import { useEffect } from "react";
import { View, Text, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "../src/lib/supabase";

export async function resolveHomeRoute(session) {
  if (!session) return "/(auth)/login";
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("user_type, transporter_role")
    .eq("id", session.user.id)
    .single();
  if (!profile) return "/(auth)/login";
  if (profile.user_type === "shipper") return "/(app)/shipper/";
  if (profile.user_type === "transporter") {
    return profile.transporter_role === "driver"
      ? "/(app)/trips"
      : "/(app)/transporter/";
  }
  return "/(auth)/login";
}

export default function IndexPage() {
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const route = await resolveHomeRoute(session);
      router.replace(route);
    });
  }, []);

  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#fff" }}>
      <Text style={{ fontSize: 24, fontWeight: "800", color: "#1e4dd0", marginBottom: 16 }}>
        Tracking Management System
      </Text>
      <ActivityIndicator color="#1e4dd0" />
    </View>
  );
}
