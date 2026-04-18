/**
 * Format a load number as a zero-padded reference string, e.g. #0000042.
 */
export function formatLoadNumber(n) {
  if (n === null || n === undefined) return "—";
  return `#${String(Number(n)).padStart(7, "0")}`;
}

/**
 * Format a number as Indian Rupees.
 */
export function formatINR(amount) {
  if (amount === null || amount === undefined) return "—";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(amount));
}

/**
 * Format a duration from now to a future date as a human-readable string.
 */
export function timeUntil(date) {
  const diff = new Date(date) - new Date();
  if (diff <= 0) return "Ended";
  const totalSec = Math.floor(diff / 1_000);
  const h = Math.floor(totalSec / 3_600);
  const m = Math.floor((totalSec % 3_600) / 60);
  const s = totalSec % 60;
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

const IST = "Asia/Kolkata";
const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;

/**
 * Format a UTC timestamp as a date+time string in IST (en-IN locale).
 */
export function formatDateTime(ts, options = {}) {
  if (ts === null || ts === undefined) return "—";
  return new Date(ts).toLocaleString("en-IN", {
    timeZone: IST,
    dateStyle: "medium",
    timeStyle: "short",
    ...options,
  });
}

/**
 * Format a UTC timestamp as a date-only string in IST (en-IN locale).
 */
export function formatDate(ts, options = {}) {
  if (ts === null || ts === undefined) return "—";
  return new Date(ts).toLocaleDateString("en-IN", {
    timeZone: IST,
    dateStyle: "medium",
    ...options,
  });
}

/**
 * Returns a YYYY-MM-DD string for the IST date `days` from today.
 * Fixes the edge case where toISOString().slice(0,10) gives the previous UTC date
 * between midnight and 05:30 IST.
 */
export function istDateString(days = 0) {
  const istMs = Date.now() + IST_OFFSET_MS + days * 24 * 60 * 60 * 1000;
  return new Date(istMs).toISOString().slice(0, 10);
}

/**
 * Convert a datetime string (user-entered as IST) to a UTC ISO string.
 * Example: "2026-04-18T14:30" (IST) → "2026-04-18T09:00:00.000Z" (UTC)
 */
export function fromISTInputToUTC(localString) {
  if (!localString) return null;
  const utcMs = new Date(localString + "Z").getTime() - IST_OFFSET_MS;
  return new Date(utcMs).toISOString();
}