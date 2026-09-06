import {
  randomBytes,
  scrypt as scryptCallback,
  type ScryptOptions,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";

/**
 * Password hashing.
 *
 * Deliberately free of `server-only`, unlike `./auth.ts` which imports it:
 * `scripts/create-admin.ts` runs in plain Node, where that import throws. Same
 * split, and same reason, as `server/db/client.ts` versus `server/db/index.ts`.
 *
 * scrypt rather than bcrypt or argon2 because it ships in Node's standard
 * library — no native module to rebuild per platform, which is where bcrypt
 * usually goes wrong on Windows.
 */

/**
 * `promisify` resolves to scrypt's 3-argument overload, which drops the options
 * parameter these cost settings need — so the signature is stated explicitly.
 */
const scrypt = promisify(scryptCallback) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: ScryptOptions,
) => Promise<Buffer>;

/**
 * OWASP's floor for scrypt is N=2^17, r=8, p=1 (~128 MB, ~100 ms per hash).
 * Stored *inside* each hash, so raising these later doesn't invalidate the
 * passwords already set — `verifyPassword` uses whatever the row was written
 * with, and a rehash-on-login can be added without a migration.
 */
const SCRYPT_N = 1 << 17;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LENGTH = 64;

/** Node's default maxmem (32 MB) is below what these parameters need. */
const MAX_MEM = 256 * 1024 * 1024;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = (await scrypt(password, salt, KEY_LENGTH, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    maxmem: MAX_MEM,
  })) as Buffer;

  return [
    "scrypt",
    SCRYPT_N,
    SCRYPT_R,
    SCRYPT_P,
    salt.toString("base64"),
    key.toString("base64"),
  ].join(":");
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split(":");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;

  const [, n, r, p, saltB64, keyB64] = parts;
  const salt = Buffer.from(saltB64, "base64");
  const expected = Buffer.from(keyB64, "base64");
  if (expected.length === 0) return false;

  let actual: Buffer;
  try {
    actual = (await scrypt(password, salt, expected.length, {
      N: Number(n),
      r: Number(r),
      p: Number(p),
      maxmem: MAX_MEM,
    })) as Buffer;
  } catch {
    // Corrupt or hostile parameters in the stored hash — a failed login, not a
    // 500, so a bad row cannot be used to probe the server.
    return false;
  }

  // Length check first: timingSafeEqual throws on a length mismatch rather than
  // returning false, and that throw would itself be an observable signal.
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
