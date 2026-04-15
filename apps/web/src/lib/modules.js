/**
 * Module system helpers
 *
 * A company's `modules` column is a text[] with zero or more of:
 *   'bidding'  – load posting, auctions, bid placement
 *   'tracking' – trip management, live location, delivery confirmation
 *
 * When both are enabled the platform syncs seamlessly: accepting a bid
 * automatically promotes the load into the tracking module as a trip.
 */

export const MODULES = /** @type {const} */ ({
  BIDDING: "bidding",
  TRACKING: "tracking",
});

/**
 * Names / descriptions shown in the admin UI.
 */
export const MODULE_META = {
  [MODULES.BIDDING]: {
    label: "Bidding",
    description:
      "Post loads, run reverse auctions, manage bids and award carriers.",
    color: "brand",
  },
  [MODULES.TRACKING]: {
    label: "Tracking",
    description:
      "Track live carrier location, manage trip lifecycle and delivery confirmations.",
    color: "green",
  },
};

/**
 * Returns true if the given modules array includes the requested module.
 * Falls back to allowing everything when the array is empty or null (safety net).
 *
 * @param {string[] | null | undefined} modules
 * @param {string} module
 */
export function hasModule(modules, module) {
  if (!modules || modules.length === 0) return true; // open by default
  return modules.includes(module);
}

/**
 * Convenience: does the profile's company have the given module?
 * Works with the profile object that comes from the dashboard layout.
 *
 * @param {{ company?: { modules?: string[] } } | null} profile
 * @param {string} module
 */
export function profileHasModule(profile, module) {
  return hasModule(profile?.company?.modules, module);
}
