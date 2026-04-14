const DIRECTIONS_API = "https://maps.googleapis.com/maps/api/directions/json";

/**
 * Decodes a Google Maps encoded polyline string into an array of
 * { latitude, longitude } objects.
 */
function decodePolyline(encoded) {
  const points = [];
  let index = 0, lat = 0, lng = 0;
  while (index < encoded.length) {
    let shift = 0, result = 0, b;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;

    shift = 0; result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;

    points.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
  }
  return points;
}

/**
 * Fetches a real road route from the Google Maps Directions API.
 * Stop ordering mirrors the web: all pickups first (in seq), then all deliveries.
 *
 * @param {Array<{stop_type: string, lat: number|string, lng: number|string}>} stops
 * @returns {Promise<Array<{latitude: number, longitude: number}>|null>}
 *   Decoded polyline coordinates, or null if the request fails / no API key.
 */
export async function fetchRoutePolyline(stops) {
  const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) return null;

  const valid = stops.filter((s) => s.lat != null && s.lng != null);
  if (valid.length < 2) return null;

  // Enforce same ordering as the web StopsMap: pickups first, deliveries after
  const ordered = [
    ...valid.filter((s) => s.stop_type === "pickup"),
    ...valid.filter((s) => s.stop_type === "delivery"),
  ];

  const origin      = `${Number(ordered[0].lat)},${Number(ordered[0].lng)}`;
  const destination = `${Number(ordered[ordered.length - 1].lat)},${Number(ordered[ordered.length - 1].lng)}`;
  const waypointParts = ordered
    .slice(1, -1)
    .map((s) => `${Number(s.lat)},${Number(s.lng)}`);

  const params = new URLSearchParams({ origin, destination, key: apiKey });
  if (waypointParts.length > 0) params.set("waypoints", waypointParts.join("|"));

  try {
    const res  = await fetch(`${DIRECTIONS_API}?${params.toString()}`);
    const data = await res.json();
    if (data.status !== "OK" || !data.routes?.[0]?.overview_polyline?.points) return null;
    return decodePolyline(data.routes[0].overview_polyline.points);
  } catch {
    return null;
  }
}
