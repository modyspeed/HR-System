import { mkdirSync } from "node:fs";
import { join } from "node:path";
import Database from "better-sqlite3";
import { electronModuleRegistry } from "../modules";
import { runMigrations } from "./migrate";

export function openApplicationDatabase(dataDirectory: string): Database.Database {
  mkdirSync(dataDirectory, { recursive: true });
  const database = new Database(join(dataDirectory, "leavedesk.db"));
  database.pragma("foreign_keys = ON");
  runMigrations(database, electronModuleRegistry);
  return database;
}