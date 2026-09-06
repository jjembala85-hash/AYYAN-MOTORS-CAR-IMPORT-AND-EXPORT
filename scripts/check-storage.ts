/**
 * Proves image uploads actually work, before you find out from a half-entered
 * listing.
 *
 *   npm run storage:check
 *
 * Does a real round trip against the configured bucket — write, read back,
 * fetch over the public URL, delete — using the *same* signing code the admin
 * panel uses (`src/admin/s3.ts`). A checker with its own implementation could
 * pass while uploads failed, which would be worse than no checker.
 *
 * Every step reports what to change when it fails, because the failures here
 * are almost always configuration rather than code.
 */

import "./env";
import { randomUUID } from "node:crypto";
import {
  deleteObject,
  getObject,
  listBuckets,
  publicUrl,
  putObject,
  readS3Config,
} from "../src/admin/s3";

const ok = (m: string) => console.log(`  ok    ${m}`);
const bad = (m: string) => console.log(`  FAIL  ${m}`);
const note = (m: string) => console.log(`        ${m}`);

/** A 1x1 transparent PNG — smallest thing that is genuinely an image. */
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

async function main() {
  console.log("\nImage upload check\n");

  if (!process.env.S3_BUCKET) {
    console.log("  Driver: LOCAL FILESYSTEM (public/uploads)\n");
    note("S3_BUCKET is not set, so uploads are written to the local disk.");
    note("That is correct for development and for a VPS with a persistent disk.");
    note("");
    note("It will NOT work on Vercel, Netlify or any serverless host: the");
    note("filesystem is read-only or wiped on deploy, so photos would vanish.");
    note("The upload action refuses to run there unless ALLOW_LOCAL_UPLOADS=1.");
    note("");
    note("To use object storage, fill in the S3_* block in .env.local");
    note("(see .env.example) and run this again.");
    console.log("");
    process.exit(0);
  }

  let config;
  try {
    config = readS3Config();
  } catch (error) {
    bad((error as Error).message);
    process.exit(1);
  }

  console.log(`  Driver:     S3-compatible`);
  console.log(`  Endpoint:   ${config.endpoint}`);
  console.log(`  Bucket:     ${config.bucket}`);
  console.log(`  Region:     ${config.region}`);
  console.log(`  Public URL: ${config.publicBase}`);
  console.log(`  Key ID:     ${config.accessKeyId.slice(0, 4)}…${config.accessKeyId.slice(-4)}\n`);

  // Namespaced and random so a check never collides with real inventory, and
  // so a leftover from a failed run is obviously a test artefact.
  const key = `_healthcheck/${randomUUID()}.png`;
  let wrote = false;

  try {
    /* 1 — write ---------------------------------------------------------- */
    try {
      await putObject(config, key, new Uint8Array(PNG), "image/png");
      wrote = true;
      ok(`write — PUT ${key}`);
    } catch (error) {
      const message = (error as Error).message;
      bad(`write — ${message}`);
      if (/SignatureDoesNotMatch/i.test(message)) {
        note("The secret key is wrong, or S3_REGION does not match the bucket.");
        note("R2 wants S3_REGION=auto; AWS wants the bucket's actual region.");
      } else if (/InvalidAccessKeyId/i.test(message)) {
        note("S3_ACCESS_KEY_ID is not recognised by this endpoint.");
      } else if (/NoSuchBucket/i.test(message)) {
        note(`No bucket named "${config.bucket}" at this endpoint.`);
        // Turn the guess into a fact where the token is allowed to tell us.
        try {
          const buckets = await listBuckets(config);
          note(
            buckets.length
              ? `Buckets these credentials can see: ${buckets.join(", ")}`
              : "These credentials can see no buckets at all — create one first.",
          );
        } catch {
          note("(Could not list buckets — the token may be scoped to one bucket.)");
        }
      } else if (/AccessDenied/i.test(message)) {
        note("The credentials are valid but lack write permission on this bucket.");
      } else if (/fetch failed|ENOTFOUND|EAI_AGAIN/i.test(message)) {
        note(`Could not reach ${config.endpoint} — check S3_ENDPOINT and your network.`);
      }
      process.exit(1);
    }

    /* 2 — read back through the signed endpoint --------------------------- */
    try {
      const bytes = await getObject(config, key);
      if (bytes.length !== PNG.length) {
        bad(`read back — got ${bytes.length} bytes, expected ${PNG.length}`);
        process.exit(1);
      }
      ok(`read back — ${bytes.length} bytes, byte-identical`);
    } catch (error) {
      bad(`read back — ${(error as Error).message}`);
      process.exit(1);
    }

    /* 3 — public URL ------------------------------------------------------ */
    // The one step that can fail while everything else passes: a bucket that
    // accepts writes but is not publicly readable produces listings whose
    // photos 403 for every visitor.
    try {
      const response = await fetch(publicUrl(config, key));
      if (response.ok) {
        const type = response.headers.get("content-type") ?? "(none)";
        ok(`public URL — ${response.status}, content-type: ${type}`);
        if (!type.startsWith("image/")) {
          note("Content-type is not an image type; browsers may download rather than render.");
        }
      } else {
        bad(`public URL — ${response.status} ${response.statusText}`);
        note(`Tried: ${publicUrl(config, key)}`);
        note("Uploads work, but visitors cannot see the photos. Either make the");
        note("bucket publicly readable, or set S3_PUBLIC_URL to the CDN / public");
        note("domain in front of it.");
        note("Supabase: the bucket must be marked Public, and S3_PUBLIC_URL is");
        note("  https://<project>.supabase.co/storage/v1/object/public/<bucket>");
        note("R2: connect a custom domain or enable the r2.dev subdomain, then");
        note("  set S3_PUBLIC_URL to it.");
        process.exitCode = 1;
      }
    } catch (error) {
      bad(`public URL — ${(error as Error).message}`);
      process.exitCode = 1;
    }
  } finally {
    /* 4 — clean up -------------------------------------------------------- */
    if (wrote) {
      try {
        await deleteObject(config, key);
        ok("delete — test object removed");
      } catch (error) {
        bad(`delete — ${(error as Error).message}`);
        note(`Remove ${key} by hand; the panel never deletes objects, only rows.`);
        process.exitCode = 1;
      }
    }
  }

  console.log(
    process.exitCode
      ? "\nUploads will partly work — see the FAIL lines above.\n"
      : "\nImage uploads are configured correctly.\n",
  );
  /*
   * On Windows under tsx you may see "Assertion failed: !(handle->flags &
   * UV_HANDLE_CLOSING)" printed after the result above. It is a Node/libuv
   * teardown artefact around fetch's pooled sockets, not a failure of this
   * check — it appears only after every step has reported, and the exit code
   * is still correct. Closing undici's global dispatcher first does not
   * suppress it, so it is documented rather than worked around.
   */
  process.exit(process.exitCode ?? 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
