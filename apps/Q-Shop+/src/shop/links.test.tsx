import { describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { isShopLinkUrl, shopLinksOf, shopLinkTarget, MAX_SHOP_LINKS } from "./links";
import { shopFormValues, toStoreFields, validateShopForm } from "../seller/shopFields";
import { buildEditStorePublish } from "../qdn/payloads";
import { renderWithProviders } from "../test/renderWithProviders";
import { ShopLinks } from "./ShopLinks";

const store = { id: "q-store-general-shop", title: "Shop", description: "d", location: "l", shipsTo: "Europe", logo: "x", foreignCoins: { ARRR: "" }, supportedCoins: ["QORT"] };

describe("a shop's links", () => {
  it("are qortal:// addresses only, each once, at most four, with a name of up to 40 characters", () => {
    expect(isShopLinkUrl("qortal://APP/Q-Blog")).toBe(true);
    expect(isShopLinkUrl("https://example.com")).toBe(false);
    expect(isShopLinkUrl("qortal://APP/Q Blog")).toBe(false);
    const links = shopLinksOf({
      links: [
        { url: "qortal://APP/Q-Blog", label: "  Our blog  " },
        { url: "https://example.com" },
        { url: "QORTAL://APP/Q-Blog" },
        "junk",
        { url: "qortal://WEBSITE/Biohackers Corner" },
        ...Array.from({ length: 5 }, (_, i) => ({ url: `qortal://Site${i}`, label: "x".repeat(60) })),
      ],
    });
    expect(links).toHaveLength(MAX_SHOP_LINKS);
    expect(links[0]).toEqual({ url: "qortal://APP/Q-Blog", label: "Our blog" });
    expect(links[1]).toEqual({ url: "qortal://Site0", label: "x".repeat(40) });
    expect(shopLinksOf({ links: "qortal://APP/Q-Blog" })).toEqual([]);
  });

  it("say whose app, website or file they open", () => {
    expect(shopLinkTarget("qortal://APP/Q-Blog/blog/Ann")).toEqual({ name: "Q-Blog", kind: "Q-App" });
    expect(shopLinkTarget("qortal://WEBSITE/Biohackers%20Corner")).toEqual({ name: "Biohackers Corner", kind: "Website" });
    expect(shopLinkTarget("qortal://Biohackers%20Corner")).toEqual({ name: "Biohackers Corner", kind: "Website" });
    expect(shopLinkTarget("qortal://VIDEO/Ann/vid1")).toEqual({ name: "Ann", kind: "Video" });
  });

  it("go from the form to the shop's JSON, and out when emptied; a web address is refused", () => {
    const values = shopFormValues({ ...store, links: [{ url: "qortal://APP/Q-Blog", label: "Blog" }] });
    expect(values.links).toEqual([{ url: "qortal://APP/Q-Blog", label: "Blog" }]);
    const more = buildEditStorePublish({
      name: "Seller",
      currentStore: store,
      fields: toStoreFields({ ...values, links: [...values.links, { url: " qortal://Site ", label: "" }, { url: "", label: "Empty" }] }),
    });
    expect(more.storeObj.links).toEqual([{ url: "qortal://APP/Q-Blog", label: "Blog" }, { url: "qortal://Site" }]);
    const none = buildEditStorePublish({ name: "Seller", currentStore: { ...store, links: more.storeObj.links }, fields: toStoreFields({ ...values, links: [] }) });
    expect("links" in none.storeObj).toBe(false);
    expect(validateShopForm({ ...values, links: [{ url: "https://example.com", label: "" }] })).toMatch(/qortal:\/\//);
  });

  it("show as cards with the app's avatar and open in a new Hub tab", async () => {
    const request = vi.fn(async () => true);
    vi.stubGlobal("qortalRequest", request);
    renderWithProviders(<ShopLinks links={[{ url: "qortal://APP/Q-Blog", label: "Our blog" }]} />);
    const card = screen.getByRole("link", { name: /^Our blog\s*Q-App · Q-Blog$/ });
    expect(card).toHaveTextContent("Q-App · Q-Blog");
    fireEvent.click(card);
    await waitFor(() => expect(request).toHaveBeenCalledWith({ action: "OPEN_NEW_TAB", qortalLink: "qortal://APP/Q-Blog" }));
    vi.unstubAllGlobals();
  });
});
