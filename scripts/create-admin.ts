/**
 * Creates or updates an admin account.
 *
 *   npm run admin:create -- --email sam@ayyanmotorsltd.com --name "Sam Okello" --owner
 *
 * Prompts for the password rather than taking it as an argument: a password on
 * the command line ends up in the shell history and in the process list, where
 * anyone on the machine can read it. Set ADMIN_PASSWORD in the environment
 * instead for a scripted first-run.
 *
 * Builds its own connection for the same reason `seed.ts` does — `@/server/db`
 * carries `server-only`, which throws outside a React Server Component.
 */

import "./env";
import { randomBytes } from "node:crypto";
import { createInterface } from "node:readline";
import { eq, sql } from "drizzle-orm";
import { createDbClient } from "../src/server/db/client";
import { adminUsers } from "../src/server/db/schema";
// `../src/admin/password`, never `../src/admin/auth` — the latter imports
// `server-only`, which throws outside a React Server Component.
import { hashPassword } from "../src/admin/password";

interface Args {
  email?: string;
  name?: string;
  owner: boolean;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { owner: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--email") args.email = argv[++i];
    else if (argv[i] === "--name") args.name = argv[++i];
    else if (argv[i] === "--owner") args.owner = true;
  }
  return args;
}

/**
 * Reads a line without echoing it.
 *
 * Node's readline has no built-in masked input, so this suppresses the terminal
 * echo by overriding the output write. The `finally` restores it — leaving a
 * terminal that doesn't echo would be a nasty parting gift.
 */
function promptHidden(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const output = rl as unknown as { output: NodeJS.WriteStream; _writeToOutput?: (s: string) => void };
    const original = output._writeToOutput;

    process.stdout.write(question);
    output._writeToOutput = () => {};

    rl.question("", (answer) => {
      output._writeToOutput = original;
      rl.close();
      process.stdout.write("\n");
      resolve(answer);
    });
  });
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set — copy .env.example to .env.local first.");
    process.exit(1);
  }

  const args = parseArgs(process.argv.slice(2));
  if (!args.email || !args.name) {
    console.error(
      'Usage: npm run admin:create -- --email you@example.com --name "Your Name" [--owner]',
    );
    process.exit(1);
  }

  if (!/^[^@\s]+@[^@\s]+$/.test(args.email)) {
    console.error(`"${args.email}" is not a valid e-mail address.`);
    process.exit(1);
  }

  let password = process.env.ADMIN_PASSWORD ?? "";
  if (!password) {
    password = await promptHidden("Password: ");
    const again = await promptHidden("Confirm password: ");
    if (password !== again) {
      console.error("Those passwords don't match.");
      process.exit(1);
    }
  }

  // 12 is the floor, not a recommendation. A short password is the weakest link
  // in the whole panel — everything else here is only as good as this value.
  if (password.length < 12) {
    console.error("Password must be at least 12 characters.");
    process.exit(1);
  }

  const db = createDbClient(url);
  const passwordHash = await hashPassword(password);
  const role = args.owner ? "owner" : "editor";

  const [existing] = await db
    .select({ id: adminUsers.id })
    .from(adminUsers)
    .where(sql`lower(${adminUsers.email}) = lower(${args.email})`)
    .limit(1);

  if (existing) {
    await db
      .update(adminUsers)
      .set({ name: args.name, passwordHash, role, isActive: true })
      .where(eq(adminUsers.id, existing.id));
    console.log(`Updated ${args.email} (${role}) — password reset, account active.`);
  } else {
    await db
      .insert(adminUsers)
      .values({ email: args.email, name: args.name, passwordHash, role });
    console.log(`Created ${args.email} (${role}).`);
  }

  if (!process.env.ADMIN_SESSION_SECRET) {
    console.log(
      "\nADMIN_SESSION_SECRET is not set — sign-in will fail without it. Add to .env.local:\n" +
        `  ADMIN_SESSION_SECRET=${randomBytes(32).toString("hex")}`,
    );
  }

  console.log("\nSign in at /admin/login");
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
