import { Slot } from "expo-router";
import { useState, useEffect, useCallback } from "react";
import { View } from "react-native";
import { SidebarContext } from "../../src/contexts/SidebarContext";
import AppSidebar from "../../src/components/AppSidebar";
import { supabase } from "../../src/lib/supabase";

export default function AppLayout() {
  const [open, setOpen]       = useState(false);
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data } = await supabase
        .from("user_profiles")
        .select("user_type, transporter_role, full_name, company:companies(name)")
        .eq("id", user.id)
        .single();
      setProfile(data);
    });
  }, []);

  const openSidebar  = useCallback(() => setOpen(true),  []);
  const closeSidebar = useCallback(() => setOpen(false), []);

  return (
    <SidebarContext.Provider value={{ openSidebar, closeSidebar, profile }}>
      <View style={{ flex: 1 }}>
        <Slot />
        <AppSidebar open={open} onClose={closeSidebar} profile={profile} />
      </View>
    </SidebarContext.Provider>
  );
}
