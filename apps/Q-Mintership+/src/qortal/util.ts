/**
 * Pure helpers ported from legacy/assets/js/QortalApi.js. Identifier suffixes,
 * base64 encodings and the date format must match the original app exactly.
 */
import { QORTAL_ADDRESS_RE } from './constants';

const ID_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

/** Six random characters, the suffix on every identifier the app creates. */
export function randomID(): string {
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += ID_ALPHABET.charAt(Math.floor(Math.random() * ID_ALPHABET.length));
  }
  return result;
}

/** The legacy async variant of randomID; same output. */
export async function uid(): Promise<string> {
  return randomID();
}

/** `YYYY-MM-DD @ HH:mm:ss` in local time, as the original app shows dates. */
export function formatLegacyTimestamp(timestamp: number | string | Date): string {
  const date = new Date(timestamp);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} @ ${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

export function isBase58(value: unknown): value is string {
  if (typeof value !== 'string' || !value.length) return false;
  return /^[1-9A-HJ-NP-Za-km-z]+$/.test(value);
}

export function isBase64(value: unknown, attemptDecode = false): value is string {
  if (typeof value !== 'string') return false;
  if (value.length % 4 !== 0) return false;
  if (!/^[A-Za-z0-9+/]*(={1,2})?$/.test(value)) return false;
  if (attemptDecode) {
    try {
      atob(value);
    } catch {
      return false;
    }
  }
  return true;
}

export function isQortalAddress(value: unknown): value is string {
  return typeof value === 'string' && QORTAL_ADDRESS_RE.test(value);
}

/** Legacy `validateQortalAddress` (async in the original). */
export async function validateQortalAddress(address: unknown): Promise<boolean> {
  return isQortalAddress(address);
}

/** UTF-8 bytes of a string as base64 (legacy base64EncodeString). */
export function base64EncodeString(value: string): string {
  return bytesToBase64(new TextEncoder().encode(value));
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export function base64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function uint8ArrayToObject<T = unknown>(bytes: Uint8Array): T {
  return JSON.parse(new TextDecoder().decode(bytes)) as T;
}

/**
 * JSON → base64 of its UTF-8 bytes. The original read a Blob through a
 * FileReader data URL, which yields exactly this; its fallback was
 * `btoa(JSON.stringify(obj))`, which only differs for non-Latin-1 text.
 */
export function objectToBase64(value: unknown): string {
  return base64EncodeString(JSON.stringify(value));
}

/** Decode base64 JSON (the inverse of objectToBase64, UTF-8 aware). */
export function base64ToObject<T = unknown>(base64: string): T {
  return uint8ArrayToObject<T>(base64ToUint8Array(base64));
}

export function base64ToBlob(base64: string, mimeType: string): Blob {
  return new Blob([base64ToUint8Array(base64)], { type: mimeType });
}

export function base64ToBlobUrl(base64: string, mimeType: string): string {
  return URL.createObjectURL(base64ToBlob(base64, mimeType));
}

export function trimString(value: unknown): string {
  return String(value ?? '').trim();
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
