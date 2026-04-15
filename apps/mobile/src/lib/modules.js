/**
 * Module system helpers — React Native / Expo
 *
 * A company's `modules` column is a text[] with zero or more of:
 *   'bidding'  – load posting, auctions, bid placement
 *   'tracking' – trip management, live location, delivery confirmation
 *
 * When both modules are enabled the platform syncs automatically:
 * accepting a bid creates a trip that immediately appears in tracking.
 */

export const MODULES = {
  BIDDING:  "bidding",
  TRACKING: "tracking",
};

/**
 * Returns true if the modules array includes the given module.
 * Defaults to allowing everything when the array is null/empty (retrocompatible).
 */
export function hasModule(modules, module) {
  if (!modules || modules.length === 0) return true;
  return modules.includes(module);
}

/**
 * Convenience wrapper that reads modules from the profile object
 * provided by SidebarContext (profile.company.modules).
 */
export function profileHasModule(profile, module) {
  return hasModule(profile?.company?.modules, module);
}
