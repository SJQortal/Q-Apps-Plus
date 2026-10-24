import { beforeEach, describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { SETTINGS_STORAGE_KEY } from "../constants/plus";
import { getProductView, productLayout, resetProductView, setProductView, useProductView } from "./productView";

beforeEach(() => {
  localStorage.clear();
  resetProductView();
});

describe("the product view", () => {
  it("is Automatic until chosen, and reads what was saved, ignoring anything unknown", () => {
    expect(getProductView()).toBe("auto");
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({ preferredCoin: "ARRR", productView: "list" }));
    resetProductView();
    expect(getProductView()).toBe("list");
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({ productView: "mosaic" }));
    resetProductView();
    expect(getProductView()).toBe("auto");
  });

  it("is saved with the other settings, and every page follows a change", () => {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({ preferredCoin: "ARRR" }));
    const { result } = renderHook(() => useProductView());
    expect(result.current).toBe("auto");
    act(() => setProductView("grid"));
    expect(result.current).toBe("grid");
    expect(JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY)!)).toEqual({ preferredCoin: "ARRR", productView: "grid" });
  });

  it("Automatic is rows on phones and tiles elsewhere; a choice is the same everywhere", () => {
    expect(productLayout("auto", true)).toBe("row");
    expect(productLayout("auto", false)).toBe("tile");
    expect(productLayout("grid", true)).toBe("tile");
    expect(productLayout("list", false)).toBe("row");
  });
});
