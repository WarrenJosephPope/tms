"use client";

import { useState, useEffect } from "react";
import StopsMap from "@/components/loads/StopsMap";

/**
 * LoadStopsMap — fetches stops for a load and renders the map.
 * Used on the shipper load detail page (server component passes loadId).
 */
export default function LoadStopsMap({ stops: initialStops }) {
  const [mapsLoaded, setMapsLoaded] = useState(false);

  useEffect(() => {
    if (window.google?.maps) { setMapsLoaded(true); return; }
    const handler = () => setMapsLoaded(true);
    window.addEventListener("google-maps-loaded", handler);
    return () => window.removeEventListener("google-maps-loaded", handler);
  }, []);

  return <StopsMap stops={initialStops} mapsLoaded={mapsLoaded} className="mt-2" />;
}

