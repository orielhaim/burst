import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { dbEnv } from "./env";

export const sqlClient = postgres(dbEnv.DATABASE_URL, { max: 10 });

export const db = drizzle({ client: sqlClient });

export type Db = typeof db;
