import { describe, expect, it } from "vitest";
import { electronModuleRegistry } from "./index";

describe("Electron module registry", () => {
  it("registers all four modules with route and navigation placeholders", () => {
    expect(electronModuleRegistry.map((module) => module.id)).toEqual([
      "employees",
      "leaves",
      "decisions",
      "documents",
    ]);
    expect(
      electronModuleRegistry.every(
        (module) => module.routes.length === 1 && module.nav.length === 1,
      ),
    ).toBe(true);
  });
});