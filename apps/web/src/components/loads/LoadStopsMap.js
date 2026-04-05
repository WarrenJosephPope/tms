"use client";

import { useState, useEffect } from "react";
import Script from "next/script";
import StopsMap from "@/components/loads/StopsMap";

/**
 * LoadStopsMap — fetches stops for a load and renders the map.
 * Used on the shipper load detail page (server component passes loadId).
 */
export default function LoadStopsMap({ stops: initialStops }) {
  const [mapsLoaded, setMapsLoaded] = useState(false);

  return (
    <>
      <Script
        src={`https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=places,marker,directions&v=beta`}
        onLoad={() => setMapsLoaded(true)}
        strategy="lazyOnload"
      />
      <StopsMap stops={initialStops} mapsLoaded={mapsLoaded} className="mt-2" />
    </>
  );
}
