import type { Database } from "better-sqlite3";
import coreSchema from "./migrations/001_core.sql?raw";
import coreSeed from "./migrations/002_seed.sql?raw";
import type { ElectronModule, ModuleMigration } from "./moduleTypes";

const coreMigrations: ModuleMigration[] = [
  { name: "001_core.sql", sql: coreSchema },
  { name: "002_seed.sql", sql: coreSeed },
];

function applyMigration(
  database: Database,
  moduleId: string,
  migration: ModuleMigration,
): void {
  const applied = database
    .prepare("SELECT 1 FROM schema_migrations WHERE module = ? AND name = ?")
    .get(moduleId, migration.name);

  if (applied) return;

  database.transaction(() => {
    database.exec(migration.sql);
    database
      .prepare("INSERT INTO schema_migrations (module, name) VALUES (?, ?)")
      .run(moduleId, migration.name);
  })();
}

export function sortModulesByDependencies(modules: ElectronModule[]): ElectronModule[] {
  const remaining = new Map(modules.map((module) => [module.id, module]));
  const completed = new Set<string>();
  const ordered: ElectronModule[] = [];

  while (remaining.size > 0) {
    const ready = [...remaining.values()]
      .filter((module) => module.dependsOn.every((id) => completed.has(id)))
      .sort((left, right) => left.order - right.order);

    if (ready.length === 0) {
      throw new Error("Module migration dependencies contain a cycle or unknown module.");
    }

    for (const module of ready) {
      ordered.push(module);
      completed.add(module.id);
      remaining.delete(module.id);
    }
  }

  return ordered;
}

export function runMigrations(database: Database, modules: ElectronModule[]): void {
  database.pragma("foreign_keys = ON");
  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      module TEXT NOT NULL,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (module, name)
    );
  `);

  for (const migration of coreMigrations) {
    applyMigration(database, "core", migration);
  }

  for (const module of sortModulesByDependencies(modules)) {
    for (const migration of module.migrations) {
      applyMigration(database, module.id, migration);
    }
  }
}