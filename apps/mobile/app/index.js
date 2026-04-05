import { useEffect } from "react";
import { View, Text, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "../src/lib/supabase";

export default function IndexPage() {
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        router.replace("/(app)/trips");
      } else {
        router.replace("/(auth)/login");
      }
    });
  }, []);

  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#fff7ed" }}>
      <Text style={{ fontSize: 24, fontWeight: "800", color: "#ea580c", marginBottom: 16 }}>
        eParivahan
      </Text>
      <ActivityIndicator color="#f97316" />
    </View>
  );
}
