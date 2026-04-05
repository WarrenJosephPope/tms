"use client";

import { useEffect, useRef } from "react";

const PICKUP_PIN = "#16a34a";   // green
const DELIVERY_PIN = "#dc2626"; // red
const LINE_COLOR = "#f97316";   // brand orange

/**
 * StopsMap
 *
 * Props:
 *  stops      {Array}   - [{ address, city, lat, lng, stop_type }]
 *  mapsLoaded {boolean} - true once Google Maps JS API is ready
 *  className  {string}  - extra CSS classes for the container
 */
export default function StopsMap({ stops, mapsLoaded, className = "" }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const polylineRef = useRef(null);

  // Initialise map once
  useEffect(() => {
    if (!mapsLoaded || !containerRef.current || mapRef.current) return;
    mapRef.current = new window.google.maps.Map(containerRef.current, {
      zoom: 5,
      center: { lat: 20.5937, lng: 78.9629 }, // centre of India
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      mapId: "DEMO_MAP_ID", // required for AdvancedMarkerElement
    });
    // Trigger marker rendering for any stops that arrived before the map was ready
    markersRef.current = []; // ensure clean state after map init
  }, [mapsLoaded]);

  // Update markers + polyline whenever stops or map readiness change
  useEffect(() => {
    if (!mapsLoaded) return; // map not yet available
    if (!mapRef.current) return;

    // Remove old markers
    markersRef.current.forEach((m) => { m.map = null; });
    markersRef.current = [];

    if (polylineRef.current) {
      polylineRef.current.setMap(null);
      polylineRef.current = null;
    }

    const validStops = stops.filter((s) => s.lat != null && s.lng != null);
    if (!validStops.length) return;

    const bounds = new window.google.maps.LatLngBounds();
    let pickupCount = 0;
    let deliveryCount = 0;

    validStops.forEach((stop) => {
      const pos = { lat: Number(stop.lat), lng: Number(stop.lng) };
      bounds.extend(pos);

      const isPickup = stop.stop_type === "pickup";
      const label = isPickup ? `P${++pickupCount}` : `D${++deliveryCount}`;

      const pin = new window.google.maps.marker.PinElement({
        background: isPickup ? PICKUP_PIN : DELIVERY_PIN,
        borderColor: "#ffffff",
        glyphColor: "#ffffff",
        glyphText: label,
      });

      const marker = new window.google.maps.marker.AdvancedMarkerElement({
        map: mapRef.current,
        position: pos,
        content: pin,
        title: stop.address || stop.city,
      });

      markersRef.current.push(marker);
    });

    // Draw polyline connecting stops in order
    const path = validStops.map((s) => ({ lat: Number(s.lat), lng: Number(s.lng) }));
    polylineRef.current = new window.google.maps.Polyline({
      map: mapRef.current,
      path,
      strokeColor: LINE_COLOR,
      strokeOpacity: 0.8,
      strokeWeight: 2,
    });

    mapRef.current.fitBounds(bounds, 60);
  }, [stops, mapsLoaded]);

  if (!mapsLoaded) {
    return (
      <div className={`flex items-center justify-center bg-slate-50 rounded-lg border border-surface-border text-slate-400 text-sm h-48 ${className}`}>
        Loading map…
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="flex gap-4 mb-2 text-xs text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-full bg-green-600" /> Pickup stops
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-full bg-red-600" /> Delivery stops
        </span>
      </div>
      <div ref={containerRef} className="w-full h-64 rounded-lg border border-surface-border overflow-hidden" />
    </div>
  );
}
