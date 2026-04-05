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
  const directionsRendererRef = useRef(null);

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

    directionsRendererRef.current = new window.google.maps.DirectionsRenderer({
      map: mapRef.current,
      suppressMarkers: true,   // we draw our own pins
      preserveViewport: true,  // we handle fitBounds manually
      polylineOptions: {
        strokeColor: LINE_COLOR,
        strokeOpacity: 0.85,
        strokeWeight: 4,
      },
    });

    markersRef.current = [];
  }, [mapsLoaded]);

  // Update markers + route whenever stops or map readiness change
  useEffect(() => {
    if (!mapsLoaded || !mapRef.current) return;

    // Remove old markers
    markersRef.current.forEach((m) => { m.map = null; });
    markersRef.current = [];

    // Hide previous route
    directionsRendererRef.current?.setMap(null);

    const validStops = stops.filter((s) => s.lat != null && s.lng != null);
    if (!validStops.length) return;

    // Enforce order: all pickups (in their original sequence) then all deliveries
    const orderedStops = [
      ...validStops.filter((s) => s.stop_type === "pickup"),
      ...validStops.filter((s) => s.stop_type === "delivery"),
    ];

    const bounds = new window.google.maps.LatLngBounds();
    let pickupCount = 0;
    let deliveryCount = 0;

    orderedStops.forEach((stop) => {
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

    if (orderedStops.length < 2) {
      // Single stop — just centre on it
      mapRef.current.fitBounds(bounds, 80);
      return;
    }

    // Request road route: pickups in order first, then deliveries in order
    directionsRendererRef.current.setMap(mapRef.current);

    const origin      = { lat: Number(orderedStops[0].lat), lng: Number(orderedStops[0].lng) };
    const destination = { lat: Number(orderedStops[orderedStops.length - 1].lat), lng: Number(orderedStops[orderedStops.length - 1].lng) };
    const waypoints   = orderedStops.slice(1, -1).map((s) => ({
      location: { lat: Number(s.lat), lng: Number(s.lng) },
      stopover: true,
    }));

    new window.google.maps.DirectionsService().route(
      {
        origin,
        destination,
        waypoints,
        travelMode: window.google.maps.TravelMode.DRIVING,
        optimizeWaypoints: false,
      },
      (result, status) => {
        if (status === "OK") {
          directionsRendererRef.current.setDirections(result);
          mapRef.current.fitBounds(result.routes[0].bounds, 60);
        } else {
          console.error("[StopsMap] Directions request failed:", status);
          mapRef.current.fitBounds(bounds, 60); // fall back to marker bounds
        }
      }
    );
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
