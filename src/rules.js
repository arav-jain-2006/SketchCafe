// Domain failures carry a public message and an HTTP-compatible status for the adapter.
export class Problem extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// Reject a failed precondition using a message safe to return to the caller.
export function requireValue(condition, message, status = 400) {
  if (!condition) throw new Problem(status, message);
}

// Trim before measuring length. A minimum of zero permits optional fields.
export function field(value, label, max, min = 1) {
  const cleaned = typeof value === 'string' ? value.trim() : '';
  requireValue(cleaned.length >= min && cleaned.length <= max,
    label + ' must contain ' + min + '–' + max + ' characters.');
  return cleaned;
}

// Accept safe whole numbers. Convert strings explicitly at the transport boundary.
export function integer(value, label, min, max = Number.MAX_SAFE_INTEGER) {
  requireValue(Number.isSafeInteger(value) && value >= min && value <= max,
    label + ' must be a whole number between ' + min + ' and ' + max + '.');
  return value;
}

// Map +91 and domestic input to the same ten-digit order and support lookup key.
export function phone(value) {
  const normalized = typeof value === 'string' ? value.trim().replace(/^\+91\s*/, '') : '';
  requireValue(/^[6-9][0-9]{9}$/.test(normalized), 'Enter a valid 10-digit Indian mobile number.');
  return normalized;
}

// Monetary values stay in integer paise until formatted for display.
export function inr(paise) {
  return '₹' + (paise / 100).toFixed(2);
}
