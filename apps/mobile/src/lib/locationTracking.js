import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { supabase } from "./supabase";

export const LOCATION_TASK = "EPARIVAHAN_LOCATION_TASK";

// Interval in ms between location pushes
const PUSH_INTERVAL_MS = 45_000;

let _activeTripId = null;
let _lastPushTime = 0;

/**
 * Define the background task. Must be called at module load time (top level).
 */
TaskManager.defineTask(LOCATION_TASK, async ({ data, error }) => {
  if (error) {
    console.warn("[LocationTask] error:", error.message);
    return;
  }

  const now = Date.now();
  if (now - _lastPushTime < PUSH_INTERVAL_MS) return; // rate-limit
  _lastPushTime = now;

  const { locations } = data;
  const loc = locations?.[0];
  if (!loc || !_activeTripId) return;

  const { coords } = loc;

  try {
    const { error: pingError } = await supabase.from("location_pings").insert({
      trip_id:       _activeTripId,
      tracking_mode: coords.accuracy && coords.accuracy < 50 ? "GPS_APP" : "NETWORK_APP",
      latitude:      coords.latitude,
      longitude:     coords.longitude,
      speed_kmph:    coords.speed != null ? coords.speed * 3.6 : null, // m/s → km/h
      accuracy_m:    coords.accuracy ?? null,
      heading_deg:   coords.heading ?? null,
      altitude_m:    coords.altitude ?? null,
      is_moving:     (coords.speed ?? 0) > 0.5,
    });
    if (pingError) console.warn("[LocationTask] ping error:", pingError.message);
  } catch (e) {
    console.warn("[LocationTask] exception:", e.message);
  }
});

/**
 * Start background location tracking for a trip.
 */
export async function startTracking(tripId) {
  _activeTripId = tripId;

  const { status: fg } = await Location.requestForegroundPermissionsAsync();
  if (fg !== "granted") throw new Error("Foreground location permission denied");

  const { status: bg } = await Location.requestBackgroundPermissionsAsync();
  if (bg !== "granted") throw new Error("Background location permission denied");

  const isRunning = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK).catch(() => false);
  if (isRunning) return;

  await Location.startLocationUpdatesAsync(LOCATION_TASK, {
    accuracy: Location.Accuracy.Balanced,
    distanceInterval: 100,           // At least 100m moved before triggering
    timeInterval: PUSH_INTERVAL_MS,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: "eParivahan — Trip Active",
      notificationBody:  "Sharing your location with the shipper.",
      notificationColor: "#f97316",
    },
  });
}

/**
 * Stop background location tracking.
 */
export async function stopTracking() {
  _activeTripId = null;
  const isRunning = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK).catch(() => false);
  if (isRunning) await Location.stopLocationUpdatesAsync(LOCATION_TASK);
}
