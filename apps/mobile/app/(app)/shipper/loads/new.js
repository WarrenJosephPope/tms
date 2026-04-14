import { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Switch,
} from "react-native";
import { useRouter } from "expo-router";
import { GooglePlacesAutocomplete } from "react-native-google-places-autocomplete";
import { Ionicons } from "@expo/vector-icons";
import MapView, { Marker, Polyline } from "react-native-maps";
import { supabase } from "../../../../src/lib/supabase";
import { fetchRoutePolyline } from "../../../../src/lib/directions";

const HARDCODED_DEFAULTS = {
  auction_duration_minutes:  15,
  extension_trigger_minutes: 3,
  extension_add_minutes:     5,
  extension_max_count:       3,
};

const DURATION_PRESETS = [
  { label: "15 min", minutes: 15   },
  { label: "30 min", minutes: 30   },
  { label: "1 h",    minutes: 60   },
  { label: "2 h",    minutes: 120  },
  { label: "6 h",    minutes: 360  },
  { label: "12 h",   minutes: 720  },
  { label: "24 h",   minutes: 1440 },
  { label: "48 h",   minutes: 2880 },
];

function isoDate(days = 0) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

const emptyStop = () => ({ address: "", city: "", state: "", pincode: "", lat: null, lng: null });

function StopAddressInput({ stop, onUpdate }) {
  const ref = useRef(null);
  const prevAddress = useRef(stop.address);

  useEffect(() => {
    if (stop.address !== prevAddress.current) {
      prevAddress.current = stop.address;
      ref.current?.setAddressText(stop.address);
    }
  }, [stop.address]);

  function handleSelect(data, details) {
    const comps = details?.address_components ?? [];
    const get = (type) => comps.find((c) => c.types.includes(type))?.long_name ?? "";
    onUpdate({
      address: details?.formatted_address ?? data.description,
      city:    get("locality") || get("sublocality_level_1") || get("administrative_area_level_2"),
      state:   get("administrative_area_level_1"),
      pincode: get("postal_code"),
      lat:     details?.geometry?.location?.lat ?? null,
      lng:     details?.geometry?.location?.lng ?? null,
    });
  }

  return (
    <GooglePlacesAutocomplete
      ref={ref}
      placeholder="Search address…"
      onPress={handleSelect}
      fetchDetails
      query={{
        key: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY,
        language: "en",
        components: "country:in",
      }}
      textInputProps={{
        defaultValue: stop.address,
        placeholderTextColor: "#94a3b8",
      }}
      styles={{
        container:   { flex: 0 },
        textInput:   {
          backgroundColor: "#f8fafc",
          borderWidth: 1,
          borderColor: "#e2e8f0",
          borderRadius: 8,
          paddingHorizontal: 12,
          paddingVertical: 10,
          fontSize: 15,
          color: "#0f172a",
          height: undefined,
        },
        listView:    { borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 8, marginTop: 2, zIndex: 1000 },
        row:         { backgroundColor: "#fff", paddingHorizontal: 12, paddingVertical: 10 },
        description: { fontSize: 14, color: "#0f172a" },
        separator:   { height: 1, backgroundColor: "#f1f5f9" },
      }}
      enablePoweredByContainer={false}
      minLength={3}
      debounce={300}
      keyboardShouldPersistTaps="handled"
    />
  );
}

export default function PostLoadScreen() {
  const router = useRouter();

  const [profile,      setProfile]      = useState(null);
  const [loading,      setLoading]      = useState(true);
  const [submitting,   setSubmitting]   = useState(false);

  const [branches,     setBranches]     = useState([]);
  const [commodities,  setCommodities]  = useState([]);
  const [vehicleTypes, setVehicleTypes] = useState([]);

  const [selectedBranch,  setSelectedBranch]  = useState(null);
  const [commodity,       setCommodity]       = useState("");
  const [weightTonnes,    setWeightTonnes]    = useState("");
  const [vehicleType,     setVehicleType]     = useState("");

  const [pickupStops,   setPickupStops]   = useState([emptyStop()]);
  const [deliveryStops, setDeliveryStops] = useState([emptyStop()]);

  const [pickupDate,        setPickupDate]        = useState(isoDate(1));
  const [pickupWindowStart, setPickupWindowStart] = useState("");
  const [pickupWindowEnd,   setPickupWindowEnd]   = useState("");

  const [openingPrice,           setOpeningPrice]           = useState("");
  const [auctionDurationMinutes, setAuctionDurationMinutes] = useState(HARDCODED_DEFAULTS.auction_duration_minutes);
  const [blindPhaseEnabled,      setBlindPhaseEnabled]      = useState(false);
  const [bidStartDate,           setBidStartDate]           = useState(isoDate(0));
  const [bidStartTime,           setBidStartTime]           = useState("");
  const [extensionTrigger,       setExtensionTrigger]       = useState(String(HARDCODED_DEFAULTS.extension_trigger_minutes));
  const [extensionAdd,           setExtensionAdd]           = useState(String(HARDCODED_DEFAULTS.extension_add_minutes));
  const [extensionMax,           setExtensionMax]           = useState(String(HARDCODED_DEFAULTS.extension_max_count));
  const [autoAcceptLowest,       setAutoAcceptLowest]       = useState(false);

  const [notes,               setNotes]               = useState("");
  const [specialInstructions, setSpecialInstructions] = useState("");

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/(auth)/login"); return; }

      const { data: prof } = await supabase
        .from("user_profiles")
        .select("id, company_id")
        .eq("id", user.id)
        .single();

      if (!prof) { setLoading(false); return; }
      setProfile(prof);
      const companyId = prof.company_id;

      const [branchRes, allottedCommRes, allottedVehRes, auctionRes] = await Promise.all([
        supabase
          .from("company_branches")
          .select("id, name, address_line1, city, state, pincode, lat, lng")
          .eq("company_id", companyId)
          .eq("is_active", true)
          .order("name"),
        supabase
          .from("company_commodity_types")
          .select("commodity_type_id")
          .eq("company_id", companyId),
        supabase
          .from("company_vehicle_types")
          .select("vehicle_type_key")
          .eq("company_id", companyId),
        supabase
          .from("company_auction_settings")
          .select("auction_duration_minutes, extension_trigger_minutes, extension_add_minutes, extension_max_count")
          .eq("company_id", companyId)
          .maybeSingle(),
      ]);

      setBranches(branchRes.data ?? []);

      const allottedCommIds = allottedCommRes.data?.map((r) => r.commodity_type_id) ?? [];
      let commQuery = supabase.from("commodity_types").select("id, name").eq("is_active", true).order("name");
      if (allottedCommIds.length > 0) commQuery = commQuery.in("id", allottedCommIds);
      const { data: commData } = await commQuery;
      setCommodities(commData ?? []);
      if (commData?.length) setCommodity(commData[0].name);

      const allottedVehKeys = allottedVehRes.data?.map((r) => r.vehicle_type_key) ?? [];
      let vehQuery = supabase.from("vehicle_type_refs").select("key, label").eq("is_active", true).order("label");
      if (allottedVehKeys.length > 0) vehQuery = vehQuery.in("key", allottedVehKeys);
      const { data: vehData } = await vehQuery;
      setVehicleTypes(vehData ?? []);
      if (vehData?.length) setVehicleType(vehData[0].key);

      if (auctionRes.data) {
        const s = auctionRes.data;
        setAuctionDurationMinutes(s.auction_duration_minutes ?? HARDCODED_DEFAULTS.auction_duration_minutes);
        setExtensionTrigger(String(s.extension_trigger_minutes ?? HARDCODED_DEFAULTS.extension_trigger_minutes));
        setExtensionAdd(String(s.extension_add_minutes          ?? HARDCODED_DEFAULTS.extension_add_minutes));
        setExtensionMax(String(s.extension_max_count            ?? HARDCODED_DEFAULTS.extension_max_count));
      }

      setLoading(false);
    }
    init();
  }, []);

  async function handleBranchSelect(branch) {
    setSelectedBranch(branch);
    setPickupStops((prev) => {
      const first = prev[0];
      if (first.address || first.city) return prev;
      return [
        { address: branch.address_line1 || "", city: branch.city || "", state: branch.state || "", pincode: branch.pincode || "" },
        ...prev.slice(1),
      ];
    });

    const { data } = await supabase
      .from("branch_auction_settings")
      .select("auction_duration_minutes, extension_trigger_minutes, extension_add_minutes, extension_max_count")
      .eq("branch_id", branch.id)
      .maybeSingle();

    if (data) {
      setAuctionDurationMinutes(data.auction_duration_minutes ?? HARDCODED_DEFAULTS.auction_duration_minutes);
      setExtensionTrigger(String(data.extension_trigger_minutes ?? HARDCODED_DEFAULTS.extension_trigger_minutes));
      setExtensionAdd(String(data.extension_add_minutes          ?? HARDCODED_DEFAULTS.extension_add_minutes));
      setExtensionMax(String(data.extension_max_count            ?? HARDCODED_DEFAULTS.extension_max_count));
    }
  }

  function updateStop(type, idx, patch) {
    const setter = type === "pickup" ? setPickupStops : setDeliveryStops;
    setter((prev) => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  }
  function addStop(type) {
    const setter = type === "pickup" ? setPickupStops : setDeliveryStops;
    setter((prev) => [...prev, emptyStop()]);
  }
  function removeStop(type, idx) {
    const setter = type === "pickup" ? setPickupStops : setDeliveryStops;
    setter((prev) => prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev);
  }

  async function handleSubmit() {
    if (!selectedBranch) return Alert.alert("Missing field", "Select a branch.");
    if (!commodity)      return Alert.alert("Missing field", "Select a commodity.");
    if (!vehicleType)    return Alert.alert("Missing field", "Select a vehicle type.");
    const validPickups    = pickupStops.filter((s) => s.address.trim());
    const validDeliveries = deliveryStops.filter((s) => s.address.trim());
    if (!validPickups.length)    return Alert.alert("Missing field", "At least one pickup address is required.");
    if (!validDeliveries.length) return Alert.alert("Missing field", "At least one delivery address is required.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(pickupDate))
      return Alert.alert("Invalid date", "Pickup date must be YYYY-MM-DD (e.g. 2026-04-20).");
    const price = parseFloat(openingPrice);
    if (!openingPrice || isNaN(price) || price <= 0)
      return Alert.alert("Missing field", "Enter a valid opening price.");
    if (auctionDurationMinutes < 1)
      return Alert.alert("Invalid", "Auction duration must be at least 1 minute.");

    let bidStartTimeISO = null;
    if (blindPhaseEnabled) {
      if (!bidStartDate || !bidStartTime)
        return Alert.alert("Missing field", "Set a blind phase start date and time.");
      const parsed = new Date(`${bidStartDate}T${bidStartTime}:00`);
      if (isNaN(parsed.getTime()))
        return Alert.alert("Invalid", "Blind phase datetime is invalid.");
      if (parsed <= new Date())
        return Alert.alert("Invalid", "Blind phase start must be in the future.");
      bidStartTimeISO = parsed.toISOString();
    }

    if (!profile?.company_id) {
      Alert.alert("Error", "Profile not loaded. Please try again.");
      return;
    }

    setSubmitting(true);

    const auctionBase    = bidStartTimeISO ? new Date(bidStartTimeISO) : new Date();
    const auctionEndTime = new Date(auctionBase.getTime() + auctionDurationMinutes * 60_000).toISOString();

    const { data: load, error } = await supabase
      .from("loads")
      .insert({
        shipper_company_id:        profile.company_id,
        posted_by:                 profile.id,
        commodity,
        weight_tonnes:             weightTonnes ? parseFloat(weightTonnes) : null,
        vehicle_type_req:          vehicleType,
        origin_address:            validPickups[0].address || null,
        origin_city:               validPickups[0].city || "",
        origin_state:              validPickups[0].state || null,
        origin_pincode:            validPickups[0].pincode || null,
        dest_address:              validDeliveries[validDeliveries.length - 1].address || null,
        dest_city:                 validDeliveries[validDeliveries.length - 1].city || "",
        dest_state:                validDeliveries[validDeliveries.length - 1].state || null,
        dest_pincode:              validDeliveries[validDeliveries.length - 1].pincode || null,
        pickup_date:               pickupDate.trim(),
        pickup_window_start:       pickupWindowStart || null,
        pickup_window_end:         pickupWindowEnd   || null,
        opening_price:             price,
        auction_end_time:          auctionEndTime,
        bid_start_time:            bidStartTimeISO,
        extension_trigger_minutes: parseInt(extensionTrigger) > 0 ? parseInt(extensionTrigger) : null,
        extension_add_minutes:     parseInt(extensionAdd)     > 0 ? parseInt(extensionAdd)     : null,
        extension_max_count:       parseInt(extensionMax)     || 0,
        extension_count:           0,
        auto_accept_lowest:        autoAcceptLowest,
        branch_id:                 selectedBranch.id,
        notes:                     notes.trim() || null,
        special_instructions:      specialInstructions.trim() || null,
        status:                    "open",
      })
      .select("id")
      .single();

    if (error) {
      setSubmitting(false);
      Alert.alert("Error posting load", error.message);
      return;
    }

    const stopRows = [
      ...validPickups.map((s, i) => ({
        load_id: load.id, stop_type: "pickup", stop_order: i,
        address: s.address, city: s.city, state: s.state || null, pincode: s.pincode || null, lat: s.lat ?? null, lng: s.lng ?? null,
      })),
      ...validDeliveries.map((s, i) => ({
        load_id: load.id, stop_type: "delivery", stop_order: i,
        address: s.address, city: s.city, state: s.state || null, pincode: s.pincode || null, lat: s.lat ?? null, lng: s.lng ?? null,
      })),
    ];
    if (stopRows.length) {
      await supabase.from("load_stops").insert(stopRows);
    }

    setSubmitting(false);
    router.replace(`/(app)/shipper/loads/${load.id}`);
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#1e4dd0" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="arrow-back" size={24} color="#0f172a" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Post a Load</Text>
          <View style={{ width: 24 }} />
        </View>

        <FlatList
          data={[]}
          renderItem={null}
          keyExtractor={() => ""}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            <View style={styles.content}>
          {/* Branch */}
          <SectionCard title="Branch">
            {branches.length === 0 ? (
              <Text style={styles.empty}>
                No active branches found. Ask your account owner to add branches.
              </Text>
            ) : (
              <>
                {branches.map((b) => (
                  <TouchableOpacity
                    key={b.id}
                    style={[
                      styles.selectOption,
                      selectedBranch?.id === b.id && styles.selectOptionActive,
                    ]}
                    onPress={() => handleBranchSelect(b)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.selectOptionText,
                        selectedBranch?.id === b.id && styles.selectOptionTextActive,
                      ]}
                    >
                      {b.name}{b.city ? ` - ${b.city}` : ""}
                    </Text>
                    {selectedBranch?.id === b.id && (
                      <Ionicons name="checkmark-circle" size={18} color="#1e4dd0" />
                    )}
                  </TouchableOpacity>
                ))}
                <Text style={styles.hint}>
                  Selecting a branch pre-fills the pickup address and loads branch-level auction settings.
                </Text>
              </>
            )}
          </SectionCard>

          {/* Cargo Details */}
          <SectionCard title="Cargo Details">
            <Label text="Commodity *" />
            {commodities.length === 0 ? (
              <Text style={styles.empty}>No commodity types available. Contact an admin.</Text>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                {commodities.map((c) => (
                  <TouchableOpacity
                    key={c.id}
                    style={[styles.chip, commodity === c.name && styles.chipActive]}
                    onPress={() => setCommodity(c.name)}
                  >
                    <Text style={[styles.chipText, commodity === c.name && styles.chipTextActive]}>
                      {c.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            <Label text="Weight (Tonnes) *" />
            <TextInput
              style={styles.input}
              placeholder="e.g. 12.500"
              value={weightTonnes}
              onChangeText={setWeightTonnes}
              keyboardType="decimal-pad"
              placeholderTextColor="#94a3b8"
            />

            <Label text="Vehicle Type *" />
            {vehicleTypes.length === 0 ? (
              <Text style={styles.empty}>No vehicle types available. Contact an admin.</Text>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                {vehicleTypes.map((v) => (
                  <TouchableOpacity
                    key={v.key}
                    style={[styles.chip, vehicleType === v.key && styles.chipActive]}
                    onPress={() => setVehicleType(v.key)}
                  >
                    <Text style={[styles.chipText, vehicleType === v.key && styles.chipTextActive]}>
                      {v.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </SectionCard>

          {/* Pickup Stops */}
          <StopEditor
            type="pickup"
            stops={pickupStops}
            onUpdate={(idx, patch) => updateStop("pickup", idx, patch)}
            onAdd={() => addStop("pickup")}
            onRemove={(idx) => removeStop("pickup", idx)}
          />

          {/* Delivery Stops */}
          <StopEditor
            type="delivery"
            stops={deliveryStops}
            onUpdate={(idx, patch) => updateStop("delivery", idx, patch)}
            onAdd={() => addStop("delivery")}
            onRemove={(idx) => removeStop("delivery", idx)}
          />

          {/* Route Preview */}
          <RouteMapPreview pickupStops={pickupStops} deliveryStops={deliveryStops} />

          {/* Pickup Schedule */}
          <SectionCard title="Pickup Schedule">
            <Label text="Pickup Date * (YYYY-MM-DD)" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.chipRow, { marginBottom: 8 }]}>
              {[
                { label: "Tomorrow",   days: 1  },
                { label: "In 2 days",  days: 2  },
                { label: "In 3 days",  days: 3  },
                { label: "In a week",  days: 7  },
                { label: "In 2 weeks", days: 14 },
              ].map(({ label, days }) => {
                const val = isoDate(days);
                return (
                  <TouchableOpacity
                    key={days}
                    style={[styles.chip, pickupDate === val && styles.chipActive]}
                    onPress={() => setPickupDate(val)}
                  >
                    <Text style={[styles.chipText, pickupDate === val && styles.chipTextActive]}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <TextInput
              style={styles.input}
              placeholder="2026-04-20"
              value={pickupDate}
              onChangeText={setPickupDate}
              placeholderTextColor="#94a3b8"
              keyboardType="numbers-and-punctuation"
            />
            <View style={styles.row2}>
              <View style={{ flex: 1 }}>
                <Label text="Window Start (HH:MM)" />
                <TextInput style={styles.input} placeholder="08:00" value={pickupWindowStart} onChangeText={setPickupWindowStart} placeholderTextColor="#94a3b8" keyboardType="numbers-and-punctuation" />
              </View>
              <View style={{ width: 12 }} />
              <View style={{ flex: 1 }}>
                <Label text="Window End (HH:MM)" />
                <TextInput style={styles.input} placeholder="18:00" value={pickupWindowEnd} onChangeText={setPickupWindowEnd} placeholderTextColor="#94a3b8" keyboardType="numbers-and-punctuation" />
              </View>
            </View>
          </SectionCard>

          {/* Pricing & Auction */}
          <SectionCard title="Pricing & Auction">
            <Label text="Opening Price (Rs.) *" />
            <TextInput
              style={styles.input}
              placeholder="e.g. 85000"
              value={openingPrice}
              onChangeText={setOpeningPrice}
              keyboardType="numeric"
              placeholderTextColor="#94a3b8"
            />
            <Text style={styles.hint}>Budget ceiling - bids start here and go lower.</Text>

            <Label text="Auction Duration" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              {DURATION_PRESETS.map(({ label, minutes }) => (
                <TouchableOpacity
                  key={minutes}
                  style={[styles.chip, auctionDurationMinutes === minutes && styles.chipActive]}
                  onPress={() => setAuctionDurationMinutes(minutes)}
                >
                  <Text style={[styles.chipText, auctionDurationMinutes === minutes && styles.chipTextActive]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.toggleRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.toggleLabel}>Blind Phase (Sealed Bids)</Text>
                <Text style={styles.hint}>Bids are hidden from everyone until the open phase begins.</Text>
              </View>
              <Switch
                value={blindPhaseEnabled}
                onValueChange={setBlindPhaseEnabled}
                trackColor={{ false: "#e2e8f0", true: "#1e4dd0" }}
                thumbColor="#fff"
              />
            </View>
            {blindPhaseEnabled && (
              <View style={styles.row2}>
                <View style={{ flex: 1 }}>
                  <Label text="Start Date (YYYY-MM-DD)" />
                  <TextInput style={styles.input} placeholder={isoDate(0)} value={bidStartDate} onChangeText={setBidStartDate} placeholderTextColor="#94a3b8" keyboardType="numbers-and-punctuation" />
                </View>
                <View style={{ width: 12 }} />
                <View style={{ flex: 1 }}>
                  <Label text="Start Time (HH:MM)" />
                  <TextInput style={styles.input} placeholder="14:00" value={bidStartTime} onChangeText={setBidStartTime} placeholderTextColor="#94a3b8" keyboardType="numbers-and-punctuation" />
                </View>
              </View>
            )}

            <View style={styles.extensionBox}>
              <Text style={styles.extensionTitle}>Auto-extension</Text>
              <View style={styles.row2}>
                <View style={{ flex: 1 }}>
                  <Label text="Trigger (last X min)" />
                  <TextInput style={styles.input} placeholder="3" value={extensionTrigger} onChangeText={setExtensionTrigger} keyboardType="numeric" placeholderTextColor="#94a3b8" />
                </View>
                <View style={{ width: 8 }} />
                <View style={{ flex: 1 }}>
                  <Label text="Extend by (min)" />
                  <TextInput style={styles.input} placeholder="5" value={extensionAdd} onChangeText={setExtensionAdd} keyboardType="numeric" placeholderTextColor="#94a3b8" />
                </View>
                <View style={{ width: 8 }} />
                <View style={{ flex: 1 }}>
                  <Label text="Max exts" />
                  <TextInput style={styles.input} placeholder="3" value={extensionMax} onChangeText={setExtensionMax} keyboardType="numeric" placeholderTextColor="#94a3b8" />
                </View>
              </View>
              <Text style={styles.hint}>Set Max to 0 to disable auto-extension.</Text>
            </View>

            <TouchableOpacity
              style={styles.checkRow}
              onPress={() => setAutoAcceptLowest((v) => !v)}
              activeOpacity={0.7}
            >
              <View style={[styles.checkbox, autoAcceptLowest && styles.checkboxChecked]}>
                {autoAcceptLowest && <Ionicons name="checkmark" size={14} color="#fff" />}
              </View>
              <Text style={styles.checkLabel}>Auto-accept lowest bid when auction ends</Text>
            </TouchableOpacity>
          </SectionCard>

          {/* Additional Information */}
          <SectionCard title="Additional Information">
            <Label text="Notes" />
            <TextInput
              style={[styles.input, styles.multiline]}
              placeholder="Any special handling requirements, loading bay info..."
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={3}
              placeholderTextColor="#94a3b8"
              textAlignVertical="top"
            />
            <Label text="Special Instructions for Driver" />
            <TextInput
              style={[styles.input, styles.multiline]}
              placeholder="Contact site manager before entering, bring original e-way bill..."
              value={specialInstructions}
              onChangeText={setSpecialInstructions}
              multiline
              numberOfLines={2}
              placeholderTextColor="#94a3b8"
              textAlignVertical="top"
            />
          </SectionCard>

          <TouchableOpacity
            style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
            activeOpacity={0.85}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitText}>Post Load</Text>
            )}
          </TouchableOpacity>
            </View>
          }
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const PICKUP_COLOR  = "#16a34a";
const DELIVERY_COLOR = "#dc2626";

function RouteMapPreview({ pickupStops, deliveryStops }) {
  const mapRef = useRef(null);
  const [routeCoords, setRouteCoords] = useState(null);
  const [routeLoading, setRouteLoading] = useState(false);

  const valid = [
    ...pickupStops.filter((s) => s.lat != null).map((s, i) => ({ ...s, stop_type: "pickup",  stop_order: i })),
    ...deliveryStops.filter((s) => s.lat != null).map((s, i) => ({ ...s, stop_type: "delivery", stop_order: i })),
  ];
  const coordKey = valid.map((s) => `${s.lat},${s.lng}`).join("|");

  function fitToPoints(coords) {
    if (!mapRef.current || !coords?.length) return;
    mapRef.current.fitToCoordinates(coords, {
      edgePadding: { top: 60, right: 60, bottom: 60, left: 60 },
      animated: true,
    });
  }

  useEffect(() => {
    if (valid.length === 0) { setRouteCoords(null); return; }
    if (valid.length === 1) {
      setRouteCoords(null);
      fitToPoints([{ latitude: valid[0].lat, longitude: valid[0].lng }]);
      return;
    }
    setRouteLoading(true);
    fetchRoutePolyline(valid).then((coords) => {
      setRouteCoords(coords);
      setRouteLoading(false);
      fitToPoints(coords ?? valid.map((s) => ({ latitude: s.lat, longitude: s.lng })));
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coordKey]);

  if (!valid.length) return null;

  return (
    <SectionCard title="Route Preview">
      <View>
        <MapView
          ref={mapRef}
          style={styles.map}
          onMapReady={() => fitToPoints(valid.map((s) => ({ latitude: s.lat, longitude: s.lng })))}
        >
          {valid.map((s, i) => (
            <Marker
              key={i}
              coordinate={{ latitude: s.lat, longitude: s.lng }}
              title={`${s.stop_type === "pickup" ? "Pickup" : "Delivery"} ${s.stop_order + 1}`}
              description={s.address || s.city}
              pinColor={s.stop_type === "pickup" ? PICKUP_COLOR : DELIVERY_COLOR}
            />
          ))}
          {routeCoords && routeCoords.length > 1 && (
            <Polyline coordinates={routeCoords} strokeColor="#f97316" strokeWidth={3} />
          )}
        </MapView>
        {routeLoading && (
          <View style={styles.mapLoader}>
            <ActivityIndicator color="#1e4dd0" size="small" />
            <Text style={styles.mapLoaderText}>Loading route…</Text>
          </View>
        )}
      </View>
    </SectionCard>
  );
}

function StopEditor({ type, stops, onUpdate, onAdd, onRemove }) {
  const label = type === "pickup" ? "Pickup" : "Delivery";
  return (
    <SectionCard title={`${label} Stops`}>
      {stops.map((stop, idx) => (
        <View key={idx} style={styles.stopBox}>
          <View style={styles.stopHeader}>
            <Text style={styles.stopLabel}>{label} {idx + 1}</Text>
            {stops.length > 1 && (
              <TouchableOpacity onPress={() => onRemove(idx)}>
                <Text style={styles.stopRemove}>Remove</Text>
              </TouchableOpacity>
            )}
          </View>
          <StopAddressInput
            stop={stop}
            onUpdate={(patch) => onUpdate(idx, patch)}
          />
          {(stop.city || stop.state || stop.pincode) && (
            <View style={styles.locationPills}>
              {stop.city    && <Text style={styles.locationPill}>{stop.city}</Text>}
              {stop.state   && <Text style={styles.locationPill}>{stop.state}</Text>}
              {stop.pincode && <Text style={[styles.locationPill, styles.locationPillMono]}>{stop.pincode}</Text>}
            </View>
          )}
        </View>
      ))}
      <TouchableOpacity style={styles.addStopBtn} onPress={onAdd} activeOpacity={0.7}>
        <Ionicons name="add-circle-outline" size={16} color="#1e4dd0" />
        <Text style={styles.addStopText}>Add {label} Stop</Text>
      </TouchableOpacity>
    </SectionCard>
  );
}

function SectionCard({ title, children }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Label({ text }) {
  return <Text style={styles.label}>{text}</Text>;
}

const styles = StyleSheet.create({
  container:              { flex: 1, backgroundColor: "#f8fafc" },
  centered:               { flex: 1, justifyContent: "center", alignItems: "center" },
  header:                 { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 60, paddingBottom: 14, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#e2e8f0" },
  headerTitle:            { fontSize: 18, fontWeight: "800", color: "#0f172a", flex: 1, marginHorizontal: 12 },
  content:                { padding: 16, paddingBottom: 48, gap: 12 },
  card:                   { backgroundColor: "#fff", borderRadius: 12, padding: 16, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  cardTitle:              { fontSize: 13, fontWeight: "700", color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12 },
  label:                  { fontSize: 13, fontWeight: "600", color: "#374151", marginBottom: 6, marginTop: 10 },
  input:                  { backgroundColor: "#f8fafc", borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: "#0f172a" },
  multiline:              { minHeight: 70 },
  row2:                   { flexDirection: "row" },
  hint:                   { fontSize: 12, color: "#94a3b8", marginTop: 4 },
  locationPills:          { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
  locationPill:           { fontSize: 12, fontWeight: "500", color: "#374151", backgroundColor: "#f1f5f9", borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 },
  locationPillMono:       { fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" },
  empty:                  { fontSize: 13, color: "#94a3b8", textAlign: "center", paddingVertical: 8 },
  chipRow:                { gap: 8, paddingVertical: 4 },
  chip:                   { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: "#f1f5f9", borderWidth: 1, borderColor: "#e2e8f0" },
  chipActive:             { backgroundColor: "#1e4dd0", borderColor: "#1e4dd0" },
  chipText:               { fontSize: 13, fontWeight: "600", color: "#64748b" },
  chipTextActive:         { color: "#fff" },
  selectOption:           { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 10, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: "#e2e8f0", marginBottom: 6, backgroundColor: "#f8fafc" },
  selectOptionActive:     { borderColor: "#1e4dd0", backgroundColor: "#eff3ff" },
  selectOptionText:       { fontSize: 14, color: "#374151", fontWeight: "500" },
  selectOptionTextActive: { color: "#1e4dd0", fontWeight: "600" },
  stopBox:                { borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 8, padding: 12, marginBottom: 10, backgroundColor: "#f8fafc" },
  stopHeader:             { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  stopLabel:              { fontSize: 12, fontWeight: "700", color: "#64748b", textTransform: "uppercase", letterSpacing: 0.4 },
  stopRemove:             { fontSize: 13, color: "#ef4444", fontWeight: "500" },
  addStopBtn:             { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 10, justifyContent: "center", borderWidth: 1, borderColor: "#c7d2fe", borderRadius: 8, marginTop: 4 },
  addStopText:            { fontSize: 14, color: "#1e4dd0", fontWeight: "600" },
  map:                    { width: "100%", height: 200, borderRadius: 8, overflow: "hidden", marginTop: 4 },
  mapLoader:              { position: "absolute", top: 4, left: 0, right: 0, bottom: 0, borderRadius: 8, backgroundColor: "rgba(248,250,252,0.80)", justifyContent: "center", alignItems: "center", gap: 8 },
  mapLoaderText:          { fontSize: 12, color: "#64748b" },
  toggleRow:              { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 14 },
  toggleLabel:            { fontSize: 14, fontWeight: "600", color: "#374151" },
  extensionBox:           { backgroundColor: "#f8fafc", borderRadius: 8, borderWidth: 1, borderColor: "#e2e8f0", padding: 12, marginTop: 14 },
  extensionTitle:         { fontSize: 12, fontWeight: "700", color: "#64748b", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 4 },
  checkRow:               { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 14 },
  checkbox:               { width: 20, height: 20, borderRadius: 4, borderWidth: 2, borderColor: "#cbd5e1", alignItems: "center", justifyContent: "center", backgroundColor: "#fff" },
  checkboxChecked:        { backgroundColor: "#1e4dd0", borderColor: "#1e4dd0" },
  checkLabel:             { fontSize: 14, color: "#374151", flex: 1 },
  submitBtn:              { backgroundColor: "#1e4dd0", borderRadius: 12, paddingVertical: 16, alignItems: "center", marginTop: 4 },
  submitBtnDisabled:      { opacity: 0.6 },
  submitText:             { fontSize: 16, fontWeight: "700", color: "#fff" },
});
