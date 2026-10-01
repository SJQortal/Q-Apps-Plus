import { describe, expect, it } from "vitest";
import pkg from "../../package.json";
import { APP_VERSION, CHANGELOG } from "./changelog";

// Plain versions only (1.0.0, 1.0.1, …): the version moves after Simon publishes, never before.
describe("version and changelog", () => {
  it("package.json, Settings → About and the newest changelog entry agree", () => {
    expect(APP_VERSION).toBe(pkg.version);
    expect(CHANGELOG[0].version).toBe(pkg.version);
  });

  it("uses plain x.y.z versions with no suffix", () => {
    expect(pkg.version).toMatch(/^\d+\.\d+\.\d+$/);
    for (const release of CHANGELOG) expect(release.version).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
