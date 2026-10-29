import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { loadEnv } from "../env.js";

const client = postgres(loadEnv().DATABASE_URL, { prepare: false });

export const db = drizzle({ client });
