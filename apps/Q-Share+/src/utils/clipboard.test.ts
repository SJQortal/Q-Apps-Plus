import { afterEach, describe, expect, it, vi } from "vitest";
import { copyText } from "./clipboard";

const secure = (value: boolean) => Object.defineProperty(window, "isSecureContext", { value, configurable: true });

describe("copyText", () => {
  afterEach(() => vi.restoreAllMocks());

  it("uses the async clipboard in a secure context", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    secure(true);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    await expect(copyText("qortal://APP/Q-Share+/share/a/b")).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith("qortal://APP/Q-Share+/share/a/b");
  });

  it("falls back to execCommand on a plain-http node", async () => {
    secure(false);
    const exec = vi.fn().mockReturnValue(true);
    Object.defineProperty(document, "execCommand", { value: exec, configurable: true });
    await expect(copyText("hello")).resolves.toBe(true);
    expect(exec).toHaveBeenCalledWith("copy");
    expect(document.querySelector("textarea")).toBeNull();
  });

  it("reports failure so the caller can show the text", async () => {
    secure(false);
    Object.defineProperty(document, "execCommand", { value: vi.fn().mockReturnValue(false), configurable: true });
    await expect(copyText("hello")).resolves.toBe(false);
  });
});
