import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import * as schema from "./schema";
import { resolve } from "path";

const sqlitePath = resolve(import.meta.dir, "../../data/rocket.db");
const sqlite = new Database(sqlitePath, { create: true });
export const db = drizzle(sqlite, { schema });
