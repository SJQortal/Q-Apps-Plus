import { afterEach, describe, expect, it, vi } from "vitest";
import { isLoadError, reloadOnce, retryImport } from "./lazyWithRetry";

const loadError = () => new TypeError("Failed to fetch dynamically imported module: https://127.0.0.1:12391/render/APP/Q-Shop+/assets/ProductsPage-x.js");

afterEach(() => {
  sessionStorage.clear();
  vi.restoreAllMocks();
});

describe("a page that fails to load", () => {
  it("is tried again once after a moment, and then loads", async () => {
    const load = vi.fn().mockRejectedValueOnce(loadError()).mockResolvedValueOnce({ default: "Page" });
    await expect(retryImport(load, 1)).resolves.toEqual({ default: "Page" });
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("reloads the app once when it fails again, and not a second time within a minute", async () => {
    const reload = vi.fn();
    vi.spyOn(window, "location", "get").mockReturnValue({ ...window.location, reload } as Location);
    expect(reloadOnce(1_000_000)).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(reloadOnce(1_030_000)).toBe(false);
    expect(reloadOnce(1_070_000)).toBe(true);
  });

  it("shows the error screen when the reload didn't help, and leaves code errors alone", async () => {
    sessionStorage.setItem("qshopplus-chunk-reload", String(Date.now()));
    const failing = vi.fn().mockRejectedValue(loadError());
    await expect(retryImport(failing, 1)).rejects.toThrow(/dynamically imported module/);
    const broken = vi.fn().mockRejectedValue(new ReferenceError("x is not defined"));
    await expect(retryImport(broken, 1)).rejects.toThrow(/not defined/);
    expect(broken).toHaveBeenCalledTimes(1);
    expect(isLoadError(new TypeError("Importing a module script failed."))).toBe(true);
  });
});
