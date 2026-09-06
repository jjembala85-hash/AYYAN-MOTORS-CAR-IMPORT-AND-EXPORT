import "server-only";

import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { putObject, readS3Config } from "./s3";

/**
 * Where uploaded vehicle photos go.
 *
 * Two drivers, chosen from the environment rather than from a build flag so the
 * same image is not written to different places in dev and prod by accident:
 *
 *   S3_BUCKET set  →  S3-compatible object storage
 *   otherwise      →  the local filesystem under public/uploads
 *
 * The S3 driver signs its own requests (SigV4, ~80 lines below) instead of
 * pulling in @aws-sdk/client-s3, which is ~15 MB for the one PUT this panel
 * makes. Signing by hand also means one driver covers every provider worth
 * choosing — AWS S3, Cloudflare R2, Supabase Storage, Backblaze B2, MinIO — so
 * the decision of *which* can be deferred to whenever the credentials arrive.
 *
 * The local driver exists so the panel is usable the moment you clone the repo,
 * with no account anywhere. It is NOT viable in production on Vercel, Netlify or
 * any serverless host: the filesystem there is read-only, and where it is
 * writable the file is discarded on the next deploy. `assertUploadsConfigured`
 * makes that a startup-time error rather than a silent data-loss bug.
 */

export interface StoredFile {
  url: string;
  bytes: number;
  contentType: string;
}

const MAX_BYTES = 12 * 1024 * 1024;

/**
 * Allow-list, not a block-list, and keyed on the bytes rather than the filename.
 * An `image/*` prefix test would accept `image/svg+xml`, which is a script
 * execution vector when served from the site's own origin.
 */
const ALLOWED: Record<string, string> = {
  "image/jpeg": ".jpeg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/avif": ".avif",
};

/** Magic-number check — a renamed .exe reports whatever type the browser guessed. */
function sniff(bytes: Uint8Array): string | null {
  if (bytes.length < 12) return null;
  const b = bytes;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";

  const brand = String.fromCharCode(b[8], b[9], b[10], b[11]);
  const container = String.fromCharCode(b[4], b[5], b[6], b[7]);
  if (container === "ftyp" && (brand === "avif" || brand === "avis")) return "image/avif";
  if (
    String.fromCharCode(b[0], b[1], b[2], b[3]) === "RIFF" &&
    String.fromCharCode(b[8], b[9], b[10], b[11]) === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

export function uploadsDriver(): "s3" | "local" {
  return process.env.S3_BUCKET ? "s3" : "local";
}

/**
 * Fails fast when the local driver would be used somewhere it cannot work.
 * Called from the upload action, so the error surfaces in the panel as a clear
 * message instead of as photos that vanish after the next deploy.
 */
export function assertUploadsConfigured(): void {
  if (uploadsDriver() === "s3") return;
  if (process.env.NODE_ENV !== "production") return;
  if (process.env.ALLOW_LOCAL_UPLOADS === "1") return;

  throw new Error(
    "Image uploads are not configured. Set S3_BUCKET, S3_REGION, S3_ENDPOINT, " +
      "S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY and S3_PUBLIC_URL. " +
      "If this deployment really does have a persistent disk, set ALLOW_LOCAL_UPLOADS=1.",
  );
}

/* -------------------------------------------------------------------------- */
/* Public entry point                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Validates and stores one uploaded image.
 *
 * `folder` is the vehicle slug, so objects land under the same
 * "<slug>/<file>" shape the seeded library already uses and the two are not
 * distinguishable downstream.
 */
export async function storeImage(file: File, folder: string): Promise<StoredFile> {
  assertUploadsConfigured();

  if (file.size === 0) throw new Error("That file is empty.");
  if (file.size > MAX_BYTES) {
    throw new Error(
      `That image is ${(file.size / 1024 / 1024).toFixed(1)} MB — the limit is ${MAX_BYTES / 1024 / 1024} MB.`,
    );
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const contentType = sniff(bytes);
  if (!contentType || !(contentType in ALLOWED)) {
    throw new Error("Only JPEG, PNG, WebP and AVIF images can be uploaded.");
  }

  // Never trust the client's filename — it decides a path. A generated name
  // makes "../../" and every other traversal trick structurally impossible.
  const safeFolder = folder.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-");
  const key = `${safeFolder}/${randomUUID()}${ALLOWED[contentType]}`;

  const url =
    uploadsDriver() === "s3"
      ? await putToS3(key, bytes, contentType)
      : await putToDisk(key, bytes);

  return { url, bytes: file.size, contentType };
}

/* -------------------------------------------------------------------------- */
/* Local driver                                                                */
/* -------------------------------------------------------------------------- */

async function putToDisk(key: string, bytes: Uint8Array<ArrayBuffer>): Promise<string> {
  const target = path.join(process.cwd(), "public", "uploads", key);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, bytes);
  return `/uploads/${key}`;
}

/* -------------------------------------------------------------------------- */
/* S3 driver                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Signing lives in `./s3.ts` rather than here so `scripts/check-storage.ts` can
 * exercise exactly the same code path from plain Node — this module imports
 * `server-only`, which throws outside a React Server Component. A checker that
 * reimplemented signing could pass while the real upload failed.
 */
async function putToS3(
  key: string,
  bytes: Uint8Array<ArrayBuffer>,
  contentType: string,
): Promise<string> {
  return putObject(readS3Config(), key, bytes, contentType);
}
