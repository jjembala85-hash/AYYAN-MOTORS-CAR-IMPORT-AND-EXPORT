# Deploying

Neon for Postgres, Vercel for the app, Cloudflare R2 for photos. All three have
free tiers that comfortably fit this catalogue, and none of them needs the other
two to be from the same vendor.

Nothing here is a code change — deployment is entirely environment variables.

## 1. Neon

The connection string is needed at **build** time as well as runtime: the
vehicle detail pages are prerendered, so `next build` reads the catalogue.

1. <https://neon.tech> → new project. Pick the region closest to your visitors;
   `eu-central` is the nearest Neon offers to East Africa.
2. Copy the **pooled** connection string. It looks like
   `postgresql://user:pass@ep-xxx.eu-central-1.aws.neon.tech/neondb?sslmode=require`.
3. Load the schema and the catalogue into it from your machine:

   ```bash
   DATABASE_URL="<neon url>" npm run db:migrate
   DATABASE_URL="<neon url>" npm run db:seed      # destructive: truncates first
   DATABASE_URL="<neon url>" npm run admin:create -- \
       --email you@example.com --name "Your Name" --owner
   ```

`src/server/db/client.ts` detects the `*.neon.tech` host and switches to Neon's
HTTP driver automatically — no configuration, and no connection pool to exhaust
between serverless invocations.

> **Use a real password for the production admin account.** `/admin/login` is
> reachable by anyone who finds it. The local test account exists only on the
> Docker database and must not be recreated here.

## 2. Vercel

1. <https://vercel.com> → **Add New → Project** → import the GitHub repo.
   Framework and build command are detected; change nothing.
2. Add the environment variables below **before** the first deploy — the build
   fails without `DATABASE_URL`, because prerendering queries the catalogue.
3. Deploy. Subsequent pushes to `main` deploy automatically.

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | the Neon pooled connection string |
| `ADMIN_SESSION_SECRET` | **a new one**, not the local value — `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `NEXT_PUBLIC_SITE_URL` | the deployed origin, e.g. `https://ayyan-motors.vercel.app` — resolves Open Graph image URLs |
| `S3_BUCKET` | `ayyan-photos` |
| `S3_REGION` | `auto` |
| `S3_ENDPOINT` | `https://<account-id>.r2.cloudflarestorage.com` |
| `S3_ACCESS_KEY_ID` | R2 token key id |
| `S3_SECRET_ACCESS_KEY` | R2 token secret |
| `S3_PUBLIC_URL` | the r2.dev URL, or your custom domain |

`REDIS_URL` is optional — leave it unset and the app reads Postgres directly,
which is the right choice until traffic justifies otherwise.

Set `NEXT_PUBLIC_SITE_URL` again once a real domain is attached; it is baked
into the build, so it needs a redeploy to take effect.

## 3. Check it

- `/` and `/vehicles` list the catalogue
- a detail page shows photos — if these are broken, `S3_PUBLIC_URL` is wrong or
  the R2 bucket is not public (`npm run storage:check` diagnoses it)
- `/admin/login` accepts the account created in step 1
- add a vehicle, upload a photo, set it Active, confirm it appears publicly

## Gotchas

**Uploads are capped by the platform, not just by us.** Vercel limits a request
body to 4.5 MB; `storage.ts` allows 12 MB per image. A photo between those two
sizes fails with a platform error rather than one of ours. Either resize before
upload, or move to presigned direct-to-R2 uploads, which bypass the app entirely.

**Local disk uploads are refused in production** — deliberately. On Vercel the
filesystem is not durable, so photos written there would disappear on the next
deploy. If `S3_BUCKET` is missing the upload action throws with an explanation
rather than pretending to work.

**Photo URLs are stored absolute.** Changing `S3_PUBLIC_URL` affects only new
uploads; see [storage.md](storage.md) before switching domains.

**Two databases now exist.** Docker locally, Neon in production. `npm run
db:seed` truncates — pointing it at the wrong one destroys hand-entered
inventory. Always pass `DATABASE_URL` explicitly on the command line rather than
relying on whatever `.env.local` currently says.
