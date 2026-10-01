import { describe, expect, it } from "vitest";
import { moduleRegistry } from "./index";

describe("renderer module registry", () => {
  it("contains the four P1a modules with basic navigation entries", () => {
    expect(moduleRegistry.map((module) => module.id)).toEqual([
      "employees",
      "leaves",
      "documents",
      "decisions",
    ]);
    expect(moduleRegistry.every((module) => module.nav.length === 1)).toBe(true);
    expect(moduleRegistry.every((module) => module.routes.length === 0)).toBe(true);
  });
});