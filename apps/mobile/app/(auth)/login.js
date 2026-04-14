import { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, StyleSheet, Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "../../src/lib/supabase";
import { resolveHomeRoute } from "../index";

export default function LoginScreen() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState("phone");
  const [loading, setLoading] = useState(false);

  const formatted = phone.startsWith("+91")
    ? phone
    : `+91${phone.replace(/\D/g, "")}`;

  async function sendOtp() {
    if (phone.replace(/\D/g, "").length !== 10) {
      Alert.alert("Invalid number", "Enter a valid 10-digit mobile number.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({ phone: formatted });
    setLoading(false);
    if (error) { Alert.alert("Error", error.message); return; }
    setStep("otp");
  }

  async function verifyOtp() {
    if (otp.length !== 6) { Alert.alert("Invalid OTP", "Enter the 6-digit OTP."); return; }
    setLoading(true);
    const { data, error } = await supabase.auth.verifyOtp({
      phone: formatted, token: otp, type: "sms",
    });
    setLoading(false);
    if (error) { Alert.alert("Error", error.message); return; }
    if (!data.session) { Alert.alert("Error", "Verification succeeded but no session was returned. Please try again."); return; }
    try {
      const route = await resolveHomeRoute(data.session);
      if (route === "/(auth)/login") {
        Alert.alert("Access Denied", "No account profile found for this number. Please contact support.");
        return;
      }
      router.replace(route);
    } catch (e) {
      Alert.alert("Error", e.message ?? "Failed to load your profile. Please try again.");
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={styles.card}>
        <Text style={styles.logo}>Tracking Management System</Text>
        <Text style={styles.subtitle}>Sign in to your account</Text>

        {step === "phone" ? (
          <>
            <Text style={styles.label}>Mobile Number</Text>
            <View style={styles.phoneRow}>
              <View style={styles.prefix}><Text style={styles.prefixText}>+91</Text></View>
              <TextInput
                style={styles.input}
                placeholder="9876543210"
                keyboardType="phone-pad"
                maxLength={10}
                value={phone}
                onChangeText={setPhone}
                autoFocus
              />
            </View>
            <TouchableOpacity
              style={[styles.btn, loading && styles.btnDisabled]}
              onPress={sendOtp}
              disabled={loading}
            >
              <Text style={styles.btnText}>{loading ? "Sending…" : "Send OTP"}</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={styles.otpHint}>Enter the 6-digit OTP sent to +91 {phone}</Text>
            <TextInput
              style={[styles.input, styles.otpInput]}
              placeholder="······"
              keyboardType="number-pad"
              maxLength={6}
              value={otp}
              onChangeText={setOtp}
            />
            <TouchableOpacity
              style={[styles.btn, loading && styles.btnDisabled]}
              onPress={verifyOtp}
              disabled={loading}
            >
              <Text style={styles.btnText}>{loading ? "Verifying…" : "Verify & Sign In"}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setStep("phone")} style={styles.back}>
              <Text style={styles.backText}>← Change number</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    padding: 24,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 28,
    width: "100%",
    maxWidth: 380,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
  },
  logo: { fontSize: 26, fontWeight: "800", color: "#1e4dd0", textAlign: "center" },
  subtitle: { fontSize: 13, color: "#94a3b8", textAlign: "center", marginBottom: 28 },
  label: { fontSize: 13, fontWeight: "600", color: "#475569", marginBottom: 6 },
  phoneRow: { flexDirection: "row", alignItems: "center", marginBottom: 16 },
  prefix: {
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRightWidth: 0,
    borderTopLeftRadius: 8,
    borderBottomLeftRadius: 8,
    paddingHorizontal: 12,
    height: 44,
    justifyContent: "center",
  },
  prefixText: { color: "#64748b", fontSize: 14 },
  input: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderTopRightRadius: 8,
    borderBottomRightRadius: 8,
    paddingHorizontal: 12,
    fontSize: 15,
    backgroundColor: "#fff",
  },
  otpInput: {
    flex: 0,
    width: "100%",
    borderRadius: 8,
    textAlign: "center",
    fontSize: 22,
    letterSpacing: 8,
    height: 56,
    marginBottom: 16,
  },
  otpHint: { fontSize: 13, color: "#64748b", marginBottom: 12, textAlign: "center" },
  btn: {
    backgroundColor: "#1e4dd0",
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: "center",
    marginTop: 4,
  },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  back: { marginTop: 16, alignItems: "center" },
  backText: { color: "#1e4dd0", fontSize: 13, fontWeight: "600" },
});