import "dotenv/config";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "./index.js";
import { comments, tickets, users } from "./schema.js";

const BCRYPT_ROUNDS = 12;

/**
 * Seeding never falls back to a hard-coded password: a committed default would
 * be a real credential in the repository, and one that works on every clone.
 * SEED_PASSWORD sets the password for the seeded user accounts and
 * SEED_ADMIN_PASSWORD the admin's; if the admin one is unset it reuses
 * SEED_PASSWORD, and if neither is set a random password is generated and
 * printed once here.
 */
const MIN_LENGTH = 8;

function resolvePassword(...envKeys: string[]): {
  password: string;
  source: string;
} {
  for (const key of envKeys) {
    const value = process.env[key];
    if (typeof value === "string" && value.length >= MIN_LENGTH) {
      return { password: value, source: key };
    }
  }
  return {
    password: randomBytes(12).toString("base64url"),
    source: "generated",
  };
}

async function upsertUser(input: {
  name: string;
  email: string;
  role: "user" | "admin";
  passwordHash: string;
}) {
  const email = input.email.toLowerCase();
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existing) {
    return { id: existing.id, created: false };
  }

  const [inserted] = await db
    .insert(users)
    .values({ ...input, email })
    .returning({ id: users.id });

  if (!inserted) {
    throw new Error(`Failed to insert user ${email}`);
  }
  return { id: inserted.id, created: true };
}

async function main() {
  const adminSecret = resolvePassword("SEED_ADMIN_PASSWORD", "SEED_PASSWORD");
  const userSecret = resolvePassword("SEED_PASSWORD");

  // Hashed separately so the admin and the user accounts can differ.
  const [adminHash, userHash] = await Promise.all([
    bcrypt.hash(adminSecret.password, BCRYPT_ROUNDS),
    bcrypt.hash(userSecret.password, BCRYPT_ROUNDS),
  ]);

  const admin = await upsertUser({
    name: "Avery Admin",
    email: "admin@example.com",
    role: "admin",
    passwordHash: adminHash,
  });
  const alice = await upsertUser({
    name: "Alice User",
    email: "alice@example.com",
    role: "user",
    passwordHash: userHash,
  });
  const bob = await upsertUser({
    name: "Bob User",
    email: "bob@example.com",
    role: "user",
    passwordHash: userHash,
  });

  // Sample tickets are only created on a first run, so re-seeding to reset a
  // password does not keep appending duplicates.
  const [anyTicket] = await db.select({ id: tickets.id }).from(tickets).limit(1);

  if (!anyTicket) {
    const rows = await db
      .insert(tickets)
      .values([
        {
          title: "Cannot reset my password",
          description: "The reset email never arrives, even after retrying.",
          creatorId: alice.id,
        },
        {
          title: "Printer on 3rd floor is offline",
          description: "Shows as offline for everyone on the floor.",
          status: "IN_PROGRESS",
          creatorId: alice.id,
          assigneeId: admin.id,
        },
        {
          title: "VPN drops every few minutes",
          description: "Connection drops roughly every five minutes.",
          status: "RESOLVED",
          creatorId: bob.id,
          assigneeId: admin.id,
        },
        {
          title: "Request a second monitor",
          description: "Would like a second monitor for the new desk.",
          status: "CLOSED",
          creatorId: bob.id,
        },
      ])
      .returning({ id: tickets.id, creatorId: tickets.creatorId });

    const first = rows[0];
    if (first) {
      await db.insert(comments).values([
        {
          ticketId: first.id,
          authorId: first.creatorId,
          body: "Tried again this morning, still nothing in my inbox.",
        },
        {
          ticketId: first.id,
          authorId: admin.id,
          body: "Thanks — checking the mail queue now.",
        },
      ]);
    }
  }

  const describe = (s: { password: string; source: string }) =>
    s.source === "generated" ? `${s.password}  (generated)` : `from ${s.source}`;

  console.log("Seed complete.");
  console.log("");
  console.log(
    `  admin@example.com  admin  ${admin.created ? "created" : "existing"}   password ${describe(adminSecret)}`,
  );
  console.log(
    `  alice@example.com  user   ${alice.created ? "created" : "existing"}   password ${describe(userSecret)}`,
  );
  console.log(
    `  bob@example.com    user   ${bob.created ? "created" : "existing"}   password ${describe(userSecret)}`,
  );

  if (adminSecret.source === "generated" || userSecret.source === "generated") {
    console.log("");
    console.log(
      "Set SEED_PASSWORD and SEED_ADMIN_PASSWORD to choose your own.",
    );
  }
  if (!admin.created && !alice.created && !bob.created) {
    console.log("");
    console.log(
      "Note: existing accounts keep their current password; empty the users table first to re-key.",
    );
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
