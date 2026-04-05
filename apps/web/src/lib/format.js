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
 * @param {string|Date} date
 */
export function timeUntil(date) {
  const diff = new Date(date) - new Date();
  if (diff <= 0) return "Ended";
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  if (h > 24) return `${Math.floor(h / 24)}d ${h % 24}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
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
