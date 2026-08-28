export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export function toIsoString(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString();
}

export function toNullableIsoString(value: string | Date | null) {
  return value === null ? null : toIsoString(value);
}
