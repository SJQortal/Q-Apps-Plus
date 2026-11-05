import { describe, expect, it } from "vitest";
import pkg from "../../package.json";
import { APP_VERSION, CHANGELOG } from "./changelog";

describe("version and changelog", () => {
  it("shows the package version, plain semver, and the newest entry is that version", () => {
    expect(APP_VERSION).toBe(pkg.version);
    expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    expect(CHANGELOG[0].version).toBe(APP_VERSION);
  });

  it("lists releases newest first, each dated and with notes", () => {
    const dates = CHANGELOG.map((r) => r.date);
    expect([...dates].sort().reverse()).toEqual(dates);
    for (const release of CHANGELOG) {
      expect(release.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(release.notes.length).toBeGreaterThan(0);
    }
  });
});
