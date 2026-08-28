function getCryptoApi() {
  if (!globalThis.crypto?.getRandomValues) {
    throw new Error("Web Crypto API is not available");
  }

  return globalThis.crypto;
}

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function generateRequestReferenceCode() {
  const bytes = new Uint8Array(6);
  getCryptoApi().getRandomValues(bytes);
  const hex = bytesToHex(bytes).toUpperCase();

  return `SZ-${hex.slice(0, 4)}-${hex.slice(4, 8)}-${hex.slice(8, 12)}`;
}

export function normalizeRequestReference(value: string) {
  const compact = value.toUpperCase().replace(/[^A-Z0-9]/g, "");

  if (compact.startsWith("SZ") && compact.length === 14) {
    return `SZ-${compact.slice(2, 6)}-${compact.slice(6, 10)}-${compact.slice(10, 14)}`;
  }

  if (compact.length === 12) {
    return `SZ-${compact.slice(0, 4)}-${compact.slice(4, 8)}-${compact.slice(8, 12)}`;
  }

  return value.trim().toUpperCase();
}

export async function ensureRequestTrackingSchema() {
  // Schema is fully managed by Drizzle ORM
  return;
}
