import {
  View,
  Text,
  Animated,
  TouchableOpacity,
  StyleSheet,
  Pressable,
} from "react-native";
import { useEffect, useRef } from "react";
import { useRouter, usePathname } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "../lib/supabase";
import { hasModule, MODULES } from "../lib/modules";

const SIDEBAR_WIDTH = 280;

// module: MODULES.BIDDING | MODULES.TRACKING | null (always visible)
// ownerOnly: only account owners see this item
const NAV_SHIPPER = [
  { label: "Dashboard",   icon: "home-outline",        href: "/(app)/shipper/",                  path: "/shipper",               module: null },
  // — Bidding —
  { label: "My Loads",    icon: "list-outline",         href: "/(app)/shipper/loads/",            path: "/shipper/loads",         module: MODULES.BIDDING },
  { label: "Post a Load", icon: "add-circle-outline",   href: "/(app)/shipper/loads/new",         path: "/shipper/loads/new",     module: MODULES.BIDDING },
  // — Tracking —
  { label: "Trips",       icon: "map-outline",          href: "/(app)/shipper/tracking/",         path: "/shipper/tracking",      module: MODULES.TRACKING },
  // — General —
  { label: "Branches",    icon: "business-outline",     href: "/(app)/shipper/branches",          path: "/shipper/branches",      module: null, ownerOnly: true },
  { label: "Team",        icon: "people-outline",       href: "/(app)/shipper/team",              path: "/shipper/team",          module: null, ownerOnly: true },
  { label: "Analytics",   icon: "bar-chart-outline",    href: "/(app)/shipper/analytics",         path: "/shipper/analytics",     module: null },
];

const NAV_TRANSPORTER = [
  { label: "Dashboard",    icon: "home-outline",        href: "/(app)/transporter/",              path: "/transporter",           module: null },
  // — Bidding —
  { label: "Load Market",  icon: "cube-outline",        href: "/(app)/transporter/loads/",        path: "/transporter/loads",     module: MODULES.BIDDING },
  { label: "My Bids",      icon: "pricetag-outline",    href: "/(app)/transporter/bids",          path: "/transporter/bids",      module: MODULES.BIDDING },
  // — Tracking —
  { label: "Active Trips", icon: "map-outline",         href: "/(app)/transporter/tracking/",     path: "/transporter/tracking",  module: MODULES.TRACKING },
  { label: "Fleet",        icon: "car-outline",         href: "/(app)/transporter/fleet",         path: "/transporter/fleet",     module: MODULES.TRACKING },
  { label: "Drivers",      icon: "person-outline",      href: "/(app)/transporter/drivers",       path: "/transporter/drivers",   module: MODULES.TRACKING },
  // — General —
  { label: "Team",         icon: "people-outline",      href: "/(app)/transporter/team",          path: "/transporter/team",      module: null, ownerOnly: true },
  { label: "Documents",    icon: "document-text-outline",href: "/(app)/transporter/documents",    path: "/transporter/documents", module: null },
];

const NAV_DRIVER = [
  { label: "My Trips", icon: "map-outline", href: "/(app)/trips", path: "/trips", module: null },
];

const SECTION_LABELS = {
  [MODULES.BIDDING]:  "Bidding",
  [MODULES.TRACKING]: "Tracking",
};

function getNavItems(profile) {
  if (!profile) return [];

  const companyModules = profile.company?.modules;
  const isAccountOwner =
    profile.shipper_role === "account_owner" ||
    profile.transporter_role === "account_owner";

  let base = [];
  if (profile.user_type === "shipper") base = NAV_SHIPPER;
  else if (profile.user_type === "transporter") {
    base = profile.transporter_role === "driver" ? NAV_DRIVER : NAV_TRANSPORTER;
  }

  return base.filter((item) => {
    if (item.ownerOnly && !isAccountOwner) return false;
    if (item.module && !hasModule(companyModules, item.module)) return false;
    return true;
  });
}

/** Returns the nav item whose path is the longest prefix of the current pathname. */
function getActiveItem(navItems, pathname) {
  return navItems.reduce((best, item) => {
    const matches = pathname === item.path || pathname.startsWith(item.path + "/");
    if (matches && (!best || item.path.length > best.path.length)) return item;
    return best;
  }, null);
}

export default function AppSidebar({ open, onClose, profile }) {
  const router    = useRouter();
  const pathname  = usePathname();
  const insets    = useSafeAreaInsets();

  const translateX     = useRef(new Animated.Value(-SIDEBAR_WIDTH)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(translateX, {
        toValue: open ? 0 : -SIDEBAR_WIDTH,
        useNativeDriver: true,
        bounciness: 4,
      }),
      Animated.timing(overlayOpacity, {
        toValue: open ? 0.45 : 0,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start();
  }, [open]);

  const navItems   = getNavItems(profile);
  const activeItem = getActiveItem(navItems, pathname);

  async function handleSignOut() {
    onClose();
    await supabase.auth.signOut();
    router.replace("/(auth)/login");
  }

  function navigate(item) {
    onClose();
    router.push(item.href);
  }

  // Build grouped list: inject section divider labels when module changes
  const grouped = [];
  let lastModule = undefined;
  for (const item of navItems) {
    if (item.module !== null && item.module !== lastModule) {
      grouped.push({ type: "divider", label: SECTION_LABELS[item.module] ?? item.module });
      lastModule = item.module;
    } else if (item.module === null && lastModule !== undefined) {
      grouped.push({ type: "divider", label: null });
      lastModule = undefined;
    }
    grouped.push({ type: "item", ...item });
  }

  return (
    <>
      {/* Dimmed backdrop */}
      <Animated.View
        pointerEvents={open ? "auto" : "none"}
        style={[styles.overlay, { opacity: overlayOpacity }]}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      {/* Slide-in panel */}
      <Animated.View
        style={[
          styles.drawer,
          { transform: [{ translateX }], paddingTop: insets.top + 16 },
        ]}
      >
        {/* Brand */}
        <View style={styles.brand}>
          <Text style={styles.brandName}>TMS</Text>
          {profile?.company?.name ? (
            <Text style={styles.companyName} numberOfLines={1}>
              {profile.company.name}
            </Text>
          ) : null}
        </View>

        {/* Navigation links */}
        <View style={styles.nav}>
          {grouped.map((entry, i) => {
            if (entry.type === "divider") {
              return (
                <View key={`div-${i}`} style={styles.dividerRow}>
                  {entry.label ? (
                    <Text style={styles.dividerLabel}>{entry.label.toUpperCase()}</Text>
                  ) : (
                    <View style={styles.dividerLine} />
                  )}
                </View>
              );
            }
            const active = entry === activeItem;
            return (
              <TouchableOpacity
                key={entry.path}
                style={[styles.navItem, active && styles.navItemActive]}
                onPress={() => navigate(entry)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={entry.icon}
                  size={20}
                  color={active ? "#1e4dd0" : "#64748b"}
                />
                <Text style={[styles.navLabel, active && styles.navLabelActive]}>
                  {entry.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Footer: user name + sign out */}
        <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
          {profile?.full_name ? (
            <Text style={styles.userName} numberOfLines={1}>
              {profile.full_name}
            </Text>
          ) : null}
          <TouchableOpacity style={styles.signOutRow} onPress={handleSignOut}>
            <Ionicons name="log-out-outline" size={18} color="#ef4444" />
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000",
    zIndex: 50,
  },
  drawer: {
    position: "absolute",
    top: 0,
    left: 0,
    bottom: 0,
    width: SIDEBAR_WIDTH,
    backgroundColor: "#fff",
    zIndex: 100,
    shadowColor: "#000",
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 12,
  },
  brand: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  brandName: {
    fontSize: 22,
    fontWeight: "800",
    color: "#1e4dd0",
    letterSpacing: 0.5,
  },
  companyName: {
    fontSize: 13,
    color: "#64748b",
    marginTop: 2,
  },
  nav: {
    flex: 1,
    paddingHorizontal: 12,
    paddingTop: 12,
    overflowY: "scroll",
  },
  dividerRow: {
    paddingHorizontal: 4,
    paddingTop: 14,
    paddingBottom: 4,
  },
  dividerLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#94a3b8",
    letterSpacing: 1,
  },
  dividerLine: {
    height: 1,
    backgroundColor: "#f1f5f9",
    marginVertical: 4,
  },
  navItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 8,
    marginBottom: 1,
  },
  navItemActive: {
    backgroundColor: "#eff3ff",
  },
  navLabel: {
    fontSize: 15,
    fontWeight: "500",
    color: "#475569",
  },
  navLabelActive: {
    color: "#1e4dd0",
    fontWeight: "600",
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
  },
  userName: {
    fontSize: 13,
    color: "#64748b",
    marginBottom: 12,
  },
  signOutRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  signOutText: {
    fontSize: 14,
    color: "#ef4444",
    fontWeight: "500",
  },
});
