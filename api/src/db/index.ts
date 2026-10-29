import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { loadEnv } from "../env.js";

// Tables are imported explicitly where they are queried, so the client does not
// need the schema registered (drizzle-orm v1 wires relations separately).
const client = postgres(loadEnv().DATABASE_URL, { prepare: false });

export const db = drizzle({ client });
