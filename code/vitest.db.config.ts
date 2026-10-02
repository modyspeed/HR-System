import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["**/*.db.test.ts"],
    pool: "threads",
  },
});