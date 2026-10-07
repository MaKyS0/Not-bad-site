/** Pure helpers for developer tools (UUIDs, JWT decoding, hex). */
import { base64ToBytes } from '../text/lib/codec';
import { UserError } from '../../utils/errors';

const hex = (b: Uint8Array): string => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
export const toHex = hex;

function format(b: Uint8Array): string {
  const s = hex(b);
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
}

export function uuidV4(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  return format(b);
}

/** RFC 9562 UUIDv7: 48-bit Unix ms timestamp + random. */
export function uuidV7(now = Date.now()): string {
  const b = crypto.getRandomValues(new Uint8Array(16));
  let ts = now;
  for (let i = 5; i >= 0; i--) {
    b[i] = ts % 256;
    ts = Math.floor(ts / 256);
  }
  b[6] = (b[6] & 0x0f) | 0x70;
  b[8] = (b[8] & 0x3f) | 0x80;
  return format(b);
}

export interface DecodedJwt {
  header: Record<string, unknown>;
  payload: unknown;
  signature: string;
}

export function decodeJwt(token: string): DecodedJwt {
  const parts = token.trim().replace(/^Bearer\s+/i, '').split('.');
  if (parts.length < 2 || parts.length > 3) throw new UserError('This is not a JWT.', 'A JSON Web Token has three parts separated by dots: header.payload.signature');
  const dec = (p: string, what: string) => {
    try {
      return JSON.parse(new TextDecoder().decode(base64ToBytes(p)));
    } catch {
      throw new UserError(`The JWT ${what} is not valid Base64URL-encoded JSON.`);
    }
  };
  const header = dec(parts[0], 'header');
  if (!header || typeof header !== 'object' || Array.isArray(header)) throw new UserError('The JWT header is not valid Base64URL-encoded JSON.');
  let payload: unknown;
  try {
    payload = dec(parts[1], 'payload');
  } catch (e) {
    // JWE / non-JSON payloads
    if (header && typeof header === 'object' && 'enc' in header) throw new UserError('This is an encrypted token (JWE).', 'Its payload cannot be decoded without the key.');
    throw e;
  }
  return { header, payload, signature: parts[2] ?? '' };
}
