"use client";

import Script from "next/script";

/**
 * Loads the Google Maps JS API once at the dashboard layout level.
 * Fires a "google-maps-loaded" window event when ready so that any
 * component lower in the tree can react without needing prop drilling
 * or a separate <Script> tag.
 */
export default function GoogleMapsScript() {
  return (
    <Script
      src={`https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=places,marker&v=beta`}
      strategy="lazyOnload"
      onLoad={() => window.dispatchEvent(new Event("google-maps-loaded"))}
    />
  );
}
