import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { resolve } from "path";

const sqlite = new Database("data/rocket.db");
const db = drizzle(sqlite);

const migrationsFolder = resolve(process.cwd(), "drizzle");

console.log(`Running migrations from ${migrationsFolder}...`);

try {
  migrate(db, { migrationsFolder });
  console.log("Migrations complete!");
} catch (error) {
  console.error("Migration failed:", error);
  process.exit(1);
}
