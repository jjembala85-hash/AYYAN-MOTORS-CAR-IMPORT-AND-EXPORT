import { config } from "dotenv";

/**
 * Loads the same environment files `next dev` does, in the same order.
 *
 *   import "./env";     // must come before anything that reads process.env
 *
 * `import "dotenv/config"` — which every script here used to do — reads only
 * `.env`. But the setup docs and `.env.example` both tell you to create
 * `.env.local`, and Next itself reads `.env.local` first. So the scripts were
 * silently seeing none of your configuration: `npm run db:seed` fell back to
 * postgres.js's own default of localhost with the OS username (an auth error
 * that looks like a wrong password), and `npm run storage:check` reported
 * "S3_BUCKET is not set" with the bucket sitting right there in `.env.local`.
 *
 * Order is precedence: dotenv keeps the first value it sees for a key and never
 * overwrites a variable already in the real environment, so an explicit
 * `DATABASE_URL=… npm run db:seed` still wins over both files.
 */
config({ path: [".env.local", ".env"], quiet: true });
