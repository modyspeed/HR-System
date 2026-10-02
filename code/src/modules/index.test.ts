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
    expect(moduleRegistry.find((module) => module.id === "employees")?.routes).toEqual([
      "/employees",
      "/employees/:id",
    ]);
  });
});