/**
 * Format a load number as a zero-padded reference string, e.g. #0000042.
 * @param {number|string|null} n
 */
export function formatLoadNumber(n) {
  if (n === null || n === undefined) return "—";
  return `#${String(Number(n)).padStart(7, "0")}`;
}

/**
 * Format a number as Indian Rupees.
 * @param {number|string} amount
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
 * Shows seconds when under 1 hour (suitable for short auction windows).
 * @param {string|Date} date
 */
export function timeUntil(date) {
  const diff = new Date(date) - new Date();
  if (diff <= 0) return "Ended";
  const totalSec = Math.floor(diff / 1_000);
  const h = Math.floor(totalSec / 3_600);
  const m = Math.floor((totalSec % 3_600) / 60);
  const s = totalSec % 60;
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h`;
  if (h > 0)   return `${h}h ${m}m`;
  if (m > 0)   return `${m}m ${s}s`;
  return `${s}s`;
}

/**
 * Format a phone number for display: +91-98765-43210
 * @param {string} phone
 */
export function formatPhone(phone) {
  const d = phone?.replace(/\D/g, "") ?? "";
  if (d.length === 12 && d.startsWith("91")) {
    return `+91-${d.slice(2, 7)}-${d.slice(7)}`;
  }
  return phone;
}
