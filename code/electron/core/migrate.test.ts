import { describe, expect, it } from "vitest";
import { sortModulesByDependencies } from "./migrate";
import type { ElectronModule } from "./moduleTypes";

function createModule(
  id: string,
  order: number,
  dependsOn: string[] = [],
): ElectronModule {
  return {
    id,
    nameAr: id,
    order,
    routes: [],
    nav: [],
    dependsOn,
    migrationsDir: `modules/${id}/migrations`,
    migrations: [],
    registerIpc: () => undefined,
  };
}

describe("sortModulesByDependencies", () => {
  it("places each module after its dependencies", () => {
    const modules = [
      createModule("documents", 4, ["employees", "decisions"]),
      createModule("decisions", 3, ["employees"]),
      createModule("employees", 1),
      createModule("leaves", 2, ["employees"]),
    ];

    expect(sortModulesByDependencies(modules).map((module) => module.id)).toEqual([
      "employees",
      "leaves",
      "decisions",
      "documents",
    ]);
  });

  it("rejects unknown or cyclic dependencies", () => {
    expect(() =>
      sortModulesByDependencies([createModule("employees", 1, ["missing"])]),
    ).toThrow("Module migration dependencies contain a cycle or unknown module.");

    expect(() =>
      sortModulesByDependencies([
        createModule("employees", 1, ["leaves"]),
        createModule("leaves", 2, ["employees"]),
      ]),
    ).toThrow("Module migration dependencies contain a cycle or unknown module.");
  });
});