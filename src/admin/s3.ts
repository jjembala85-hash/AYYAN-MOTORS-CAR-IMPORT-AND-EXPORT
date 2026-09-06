import { createHash, createHmac } from "node:crypto";

/**
 * A minimal S3 client: SigV4 request signing, and the three operations this
 * project needs (PUT, GET, DELETE).
 *
 * Deliberately free of `server-only`, unlike `./storage.ts` which imports it —
 * `scripts/check-storage.ts` runs in plain Node, where that import throws. Same
 * split, and same reason, as `./password.ts` versus `./auth.ts`.
 *
 * No @aws-sdk/client-s3: it is ~15 MB of dependency for a handful of requests,
 * and signing by hand means one implementation covers every S3-compatible
 * provider — AWS S3, Cloudflare R2, Supabase Storage, Backblaze B2, MinIO.
 */

export interface S3Config {
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  endpoint: string;
  /** Where objects are *served* from — often a CDN, not the signing endpoint. */
  publicBase: string;
}

/** Reads the S3_* environment, or explains precisely what is missing. */
export function readS3Config(env: NodeJS.ProcessEnv = process.env): S3Config {
  const missing = (
    ["S3_BUCKET", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"] as const
  ).filter((k) => !env[k]);

  if (missing.length > 0) {
    throw new Error(`Missing ${missing.join(", ")}. See the S3_* block in .env.example.`);
  }

  // `||`, not `??`, throughout: a variable present but empty ("S3_PUBLIC_URL="
  // with nothing after it, which is exactly how .env.example ships it) is not
  // null or undefined, so `??` keeps the empty string and every URL built from
  // it comes out relative — "Failed to parse URL from /key.png". Blank means
  // unset here.
  const region = env.S3_REGION || "auto";
  // Path-style ("<endpoint>/<bucket>/<key>"): R2, Supabase and MinIO all serve
  // that way, and virtual-host style is an AWS-ism the others reject.
  const endpoint = (env.S3_ENDPOINT || `https://s3.${region}.amazonaws.com`).replace(/\/+$/, "");
  const bucket = env.S3_BUCKET!;

  return {
    bucket,
    region,
    accessKeyId: env.S3_ACCESS_KEY_ID!,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY!,
    endpoint,
    publicBase: (env.S3_PUBLIC_URL || `${endpoint}/${bucket}`).replace(/\/+$/, ""),
  };
}

/* -------------------------------------------------------------------------- */
/* Signing                                                                     */
/* -------------------------------------------------------------------------- */

const sha256 = (data: Uint8Array | string) => createHash("sha256").update(data).digest("hex");
const hmac = (key: Uint8Array | string, data: string) =>
  createHmac("sha256", key).update(data).digest();

/** The public URL an object key is served from. */
export function publicUrl(config: S3Config, key: string): string {
  return `${config.publicBase}/${key}`;
}

/** The absolute path of an object on the endpoint: "/<bucket>/<key>". */
function objectPath(config: S3Config, key: string): string {
  return `/${config.bucket}/${key}`;
}

interface SignedRequest {
  url: URL;
  headers: Record<string, string>;
}

/**
 * Signs a request for an absolute path on the endpoint.
 *
 * Takes the path rather than bucket + key because ListBuckets is addressed at
 * the root ("/") and has no bucket segment at all. The signature covers the
 * canonical URI, so building the path here and the URL somewhere else is how
 * you get a `SignatureDoesNotMatch` that looks like bad credentials.
 */
function sign(
  config: S3Config,
  method: "PUT" | "GET" | "DELETE" | "HEAD",
  path: string,
  body: Uint8Array | null,
  contentType?: string,
): SignedRequest {
  const url = new URL(config.endpoint + path);
  const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = sha256(body ?? "");

  // Each path segment is encoded separately: the "/" between them is structural
  // and must survive, everything else must not.
  const canonicalUri = url.pathname
    .split("/")
    .map((segment) => encodeURIComponent(decodeURIComponent(segment)))
    .join("/");

  const headers: Record<string, string> = {
    host: url.host,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
  };
  if (contentType) headers["content-type"] = contentType;

  const names = Object.keys(headers).sort();
  const signedHeaders = names.join(";");
  const canonicalHeaders = names.map((h) => `${h}:${headers[h]}\n`).join("");

  const canonicalRequest = [
    method,
    canonicalUri,
    "",
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const scope = `${dateStamp}/${config.region}/s3/aws4_request`;
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, scope, sha256(canonicalRequest)].join("\n");

  const signingKey = hmac(
    hmac(hmac(hmac(`AWS4${config.secretAccessKey}`, dateStamp), config.region), "s3"),
    "aws4_request",
  );
  const signature = createHmac("sha256", signingKey).update(stringToSign).digest("hex");

  headers.Authorization =
    `AWS4-HMAC-SHA256 Credential=${config.accessKeyId}/${scope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return { url, headers };
}

/** S3 errors are XML; the <Message> is the only part worth showing a person. */
async function describeFailure(response: Response): Promise<string> {
  const body = await response.text().catch(() => "");
  const message = body.match(/<Message>([^<]+)<\/Message>/)?.[1];
  const code = body.match(/<Code>([^<]+)<\/Code>/)?.[1];
  return `${response.status} ${code ?? ""} ${message ?? response.statusText}`.replace(/\s+/g, " ").trim();
}

/* -------------------------------------------------------------------------- */
/* Operations                                                                  */
/* -------------------------------------------------------------------------- */

export async function putObject(
  config: S3Config,
  key: string,
  bytes: Uint8Array<ArrayBuffer>,
  contentType: string,
): Promise<string> {
  const { url, headers } = sign(config, "PUT", objectPath(config, key), bytes, contentType);

  const response = await fetch(url, {
    method: "PUT",
    headers,
    // Wrapped in a Blob: fetch's BodyInit type does not accept a bare
    // Uint8Array. Same bytes, so the signature stays valid.
    body: new Blob([bytes]),
  });

  if (!response.ok) throw new Error(`Upload failed (${await describeFailure(response)})`);
  return publicUrl(config, key);
}

export async function deleteObject(config: S3Config, key: string): Promise<void> {
  const { url, headers } = sign(config, "DELETE", objectPath(config, key), null);
  const response = await fetch(url, { method: "DELETE", headers });

  // S3 returns 204 for a successful delete and, by design, also for a key that
  // was never there. 404 is treated as success for the same reason: the
  // post-condition ("this key does not exist") holds either way.
  if (!response.ok && response.status !== 404) {
    throw new Error(`Delete failed (${await describeFailure(response)})`);
  }
}

/**
 * Names of the buckets these credentials can see.
 *
 * Only used to turn "NoSuchBucket" into something actionable — the name in
 * S3_BUCKET is a guess until someone checks it, and "no bucket called X, but
 * here are the ones that exist" is the difference between a fix and a hunt.
 * Some providers deny ListBuckets to a bucket-scoped token, so callers must
 * treat a failure here as "unknown", never as "no buckets".
 */
export async function listBuckets(config: S3Config): Promise<string[]> {
  // Addressed at the endpoint root, not at a bucket.
  const { url, headers } = sign(config, "GET", "/", null);
  const response = await fetch(url, { method: "GET", headers });

  if (!response.ok) throw new Error(await describeFailure(response));

  const xml = await response.text();
  return [...xml.matchAll(/<Name>([^<]+)<\/Name>/g)].map((m) => m[1]);
}

/** Reads an object back through the *signed* endpoint — proves the write landed. */
export async function getObject(config: S3Config, key: string): Promise<Uint8Array> {
  const { url, headers } = sign(config, "GET", objectPath(config, key), null);
  const response = await fetch(url, { method: "GET", headers });

  if (!response.ok) throw new Error(`Read failed (${await describeFailure(response)})`);
  return new Uint8Array(await response.arrayBuffer());
}
