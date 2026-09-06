# Vehicle photo storage

Photos uploaded through the admin panel go to **Cloudflare R2**. R2 was chosen
over S3 and Supabase Storage for one reason: **egress is free**. On a catalogue
where every visitor loads six photos per listing, bandwidth — not storage — is
the cost that grows, and R2 removes it entirely. Storage is 10 GB free, against
a real library of roughly 75 MB.

Nothing in the code is R2-specific. Requests are signed in-process with SigV4
([`src/admin/s3.ts`](../src/admin/s3.ts)), so AWS S3, Supabase Storage,
Backblaze B2 and MinIO all work by changing environment variables alone.

```bash
npm run storage:check    # write · read back · public fetch · delete
```

Run that after any change here. It exercises the same signing code the panel
uses, so a pass means uploads genuinely work — not that a parallel
implementation agrees with itself.

## Setting up the bucket

1. **Create it.** Cloudflare dashboard → R2 → *Create bucket*. Name it
   something like `ayyan-photos`. Location: *Automatic*, or Eastern Europe /
   Middle East if offered — closest to Uganda of what R2 provides.

2. **Get the endpoint.** Bucket → *Settings* → **S3 API**. It looks like
   `https://<32-char-account-id>.r2.cloudflarestorage.com`. Copy the host only,
   without the bucket name on the end — the code appends that.

3. **Create an API token.** R2 → *Manage R2 API Tokens* → *Create token*.
   Permission **Object Read & Write**, and scope it to this one bucket rather
   than all of them. The **secret is shown once**; if you lose it, roll the
   token rather than hunting for it.

4. **Make the photos publicly readable.** This is the step that is easy to miss,
   because uploads succeed without it and only visitors see the breakage. The
   S3 API endpoint is for signed writes and is *not* public. Either:

   - **Testing:** bucket → *Settings* → *Public Development URL* → enable. Gives
     `https://pub-<hash>.r2.dev`. Rate-limited, and Cloudflare say not to use it
     in production.
   - **Production:** bucket → *Settings* → *Custom Domains* → connect e.g.
     `images.ayyanmotorsltd.com`. Also puts Cloudflare's CDN in front, which is
     the point.

5. **Fill in `.env.local`:**

   ```bash
   S3_BUCKET=ayyan-photos
   S3_REGION=auto                 # always "auto" for R2
   S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
   S3_ACCESS_KEY_ID=<access key id>
   S3_SECRET_ACCESS_KEY=<secret>
   S3_PUBLIC_URL=https://pub-<hash>.r2.dev
   ```

6. **Verify:** `npm run storage:check`, then **restart `next dev`**. The dev
   server reads `S3_PUBLIC_URL` at startup to build the `next/image`
   `remotePatterns` allow-list; without a restart, uploaded photos are fetched
   but refused by the image optimiser.

## Rotating the credentials

The secret is only ever shown once, at creation, so rotation is "make a new
token, delete the old one" — there is nothing to look up.

1. R2 → **Manage R2 API Tokens** → **Create token**, permission **Object Read &
   Write**, scoped to this bucket.
2. Put the new pair in `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` and run
   `npm run storage:check` **before** deleting the old token — if the new one is
   wrong you still have a working key.
3. Delete the old token.
4. Update the deployment's environment variables too, not just `.env.local`.

Rotate whenever a secret has been somewhere it should not be: a screenshot, a
chat, a commit, a shared terminal. Existing photos are unaffected — the keys
authorise writes, and reads go through the public domain.

## Moving to a custom domain

`pub-<hash>.r2.dev` is Cloudflare's *development* URL: rate-limited, not
CDN-cached, and explicitly not for production. A custom domain fixes all three
and is the main reason to be on Cloudflare at all — photos then serve from an
edge near the visitor rather than from the bucket's region, which is the largest
single speed win available on a catalogue this image-heavy.

The domain must already use Cloudflare's nameservers. Then: R2 → bucket →
**Settings** → **Custom Domains** → **Connect Domain** → `images.<your-domain>`.
Cloudflare writes the DNS record itself. When it reads **Active**, set
`S3_PUBLIC_URL` to it, run `npm run storage:check`, and restart the app.

> **Do this before entering real inventory.** `vehicle_media.url` stores
> absolute URLs, so changing `S3_PUBLIC_URL` affects only *new* uploads —
> photos added under the old domain keep pointing at it. Switching later means a
> one-off `UPDATE vehicle_media SET url = replace(url, '<old base>', '<new
> base>')`, which is easy but easy to forget.

## How it fits together

| Where | What |
| --- | --- |
| [`src/admin/s3.ts`](../src/admin/s3.ts) | SigV4 signing, `putObject` / `getObject` / `deleteObject`. No `server-only`, so the CLI can use it. |
| [`src/admin/storage.ts`](../src/admin/storage.ts) | Picks the driver, validates the upload, generates the object key. `server-only`. |
| [`src/admin/actions/media.ts`](../src/admin/actions/media.ts) | The Server Action behind the upload form. |
| [`next.config.ts`](../next.config.ts) | Derives `images.remotePatterns` from `S3_PUBLIC_URL`. |
| [`scripts/check-storage.ts`](../scripts/check-storage.ts) | The round-trip check. |

Objects are keyed `<vehicle-slug>/<uuid>.<ext>`. The UUID is generated
server-side and the client's filename is never used in the path — that makes
`../../` traversal structurally impossible rather than filtered.

Uploads are validated on the **bytes**, not the filename or the browser's
declared type: magic-number sniffing, and an allow-list of JPEG / PNG / WebP /
AVIF. `image/svg+xml` is deliberately excluded — an SVG is a script execution
vector when served from a domain you control.

## Without R2 configured

With `S3_BUCKET` unset, uploads write to `public/uploads` on the local disk.
That is correct for development and for a VPS with a real disk, and it is
**refused in production** — on Vercel, Netlify or any serverless host the
filesystem is read-only or wiped on deploy, so the photos would silently
disappear some days later. Override with `ALLOW_LOCAL_UPLOADS=1` only if the
deployment genuinely has persistent storage.

`public/uploads` is gitignored.

## Things worth knowing

**Removing a photo does not delete the object.** `deletePhoto` removes the
`vehicle_media` row and leaves the file in the bucket, so a misclick is
recoverable and a re-shoot is never needed. Storage is cheap next to that.
Orphans can be swept later by diffing bucket keys against the URLs in
`vehicle_media`.

**Uploads are sequential, not parallel.** Twenty concurrent multi-megabyte
uploads in one request is how a small instance runs out of memory. Nineteen
photos plus one clear error beats a dead request.

**The 12 MB per-image cap** is in `storage.ts`. Serverless hosts also cap the
whole request body — Vercel at 4.5 MB — so if uploads start failing there for
large files with a platform error rather than one of ours, that ceiling is why,
and the fix is presigned direct-to-R2 uploads rather than raising the cap.
