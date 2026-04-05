import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { resolve } from "path";

const sqlitePath = resolve(import.meta.dir, "../../data/rocket.db");
const sqlite = new Database(sqlitePath);
const db = drizzle(sqlite);

const migrationsFolder = resolve(import.meta.dir, "../../drizzle");

console.log(`Running migrations from ${migrationsFolder}...`);

try {
  migrate(db, { migrationsFolder });
  console.log("Migrations complete!");
} catch (error) {
  console.error("Migration failed:", error);
  process.exit(1);
}
