import { createClient } from "@supabase/supabase-js";
import { Platform } from "react-native";

const supabaseUrl  = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// AsyncStorage uses window.localStorage on web which is unavailable during SSR.
// On native we load it synchronously via require; on web we omit it so Supabase
// uses its built-in localStorage adapter (runs only in the browser).
const storage =
  Platform.OS !== "web"
    ? require("@react-native-async-storage/async-storage").default
    : undefined;

export const supabase = createClient(supabaseUrl, supabaseAnon, {
  auth: {
    ...(storage ? { storage } : {}),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
