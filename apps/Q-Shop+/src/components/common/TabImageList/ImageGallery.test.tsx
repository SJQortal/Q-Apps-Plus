import { describe, expect, it } from "vitest";
import { fireEvent, screen, within } from "@testing-library/react";
import { renderWithProviders } from "../../../test/renderWithProviders";
import { ImageGallery } from "./ImageGallery";

const images = ["data:image/webp;base64,QQ==", "data:image/webp;base64,Qg==", "data:image/webp;base64,Qw==", "data:image/webp;base64,RA=="];
const mainImage = () => screen.getByRole("button", { name: /full screen/ }).querySelector("img")!;

describe("ImageGallery", { timeout: 20_000 }, () => {
  it("shows up to 3 pictures with arrows, thumbnails and the keyboard", () => {
    renderWithProviders(<ImageGallery images={images} title="Mug" />);
    expect(mainImage()).toHaveAttribute("alt", "Mug, picture 1 of 3");
    const thumbs = within(screen.getByRole("group", { name: "Pictures" })).getAllByRole("button");
    expect(thumbs).toHaveLength(3);
    expect(thumbs[0]).toHaveAttribute("aria-current", "true");
    fireEvent.click(screen.getByRole("button", { name: "Next picture" }));
    expect(mainImage()).toHaveAttribute("src", images[1]);
    fireEvent.click(screen.getByRole("button", { name: "Previous picture" }));
    fireEvent.click(screen.getByRole("button", { name: "Previous picture" }));
    expect(mainImage()).toHaveAttribute("src", images[2]);
    fireEvent.click(thumbs[0]);
    expect(mainImage()).toHaveAttribute("src", images[0]);
    fireEvent.keyDown(thumbs[0], { key: "ArrowRight" });
    expect(mainImage()).toHaveAttribute("src", images[1]);
  });

  it("drops the picture's backdrop once it has loaded, so a transparent background shows through", () => {
    renderWithProviders(<ImageGallery images={images} title="Mug" />);
    const area = mainImage().closest("button")!.parentElement!;
    const clear = (el: Element) => ["transparent", "rgba(0, 0, 0, 0)"].includes(getComputedStyle(el).backgroundColor);
    expect(clear(area)).toBe(false);
    fireEvent.load(mainImage());
    expect(clear(area)).toBe(true);
    // The next picture has its backdrop until it loads too.
    fireEvent.click(screen.getByRole("button", { name: "Next picture" }));
    expect(clear(area)).toBe(false);
  });

  it("swipes on touch screens", () => {
    renderWithProviders(<ImageGallery images={images} title="Mug" />);
    const area = mainImage().closest("button")!.parentElement!;
    fireEvent.touchStart(area, { touches: [{ clientX: 200, clientY: 100 }] });
    fireEvent.touchEnd(area, { changedTouches: [{ clientX: 100, clientY: 110 }] });
    expect(mainImage()).toHaveAttribute("src", images[1]);
    // A mostly vertical drag is a scroll, not a swipe.
    fireEvent.touchStart(area, { touches: [{ clientX: 200, clientY: 100 }] });
    fireEvent.touchEnd(area, { changedTouches: [{ clientX: 150, clientY: 300 }] });
    expect(mainImage()).toHaveAttribute("src", images[1]);
  });

  it("opens a full-screen viewer with ← and →, starting at the main picture", async () => {
    renderWithProviders(<ImageGallery images={images} title="Mug" initialIndex={1} />);
    fireEvent.click(screen.getByRole("button", { name: "Open picture 2 of 3 full screen" }));
    const viewer = await screen.findByRole("dialog", { name: "Mug (2 of 3)" });
    expect(within(viewer).getByRole("img")).toHaveAttribute("src", images[1]);
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(within(screen.getByRole("dialog")).getByRole("img")).toHaveAttribute("src", images[2]);
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    expect(within(screen.getByRole("dialog")).getByRole("img")).toHaveAttribute("src", images[0]);
  });

  it("says when there are no pictures", () => {
    renderWithProviders(<ImageGallery images={[]} title="Mug" />);
    expect(screen.getByText("No pictures")).toBeInTheDocument();
  });

  it("zooms a picture in the full-screen viewer: buttons, keys, double click and the wheel; a zoomed picture doesn't swipe", async () => {
    renderWithProviders(<ImageGallery images={images} title="Mug" />);
    fireEvent.click(screen.getByRole("button", { name: "Open picture 1 of 3 full screen" }));
    const viewer = await screen.findByRole("dialog", { name: "Mug (1 of 3)" });
    const zoom = within(viewer).getByRole("group", { name: "Zoom" });
    expect(zoom).toHaveTextContent("100 %");
    expect(within(zoom).getByRole("button", { name: "Zoom out" })).toBeDisabled();
    fireEvent.click(within(zoom).getByRole("button", { name: "Zoom in" }));
    expect(zoom).toHaveTextContent("150 %");
    fireEvent.click(within(zoom).getByRole("button", { name: "Zoom out" }));
    expect(zoom).toHaveTextContent("100 %");
    fireEvent.keyDown(window, { key: "+" });
    fireEvent.keyDown(window, { key: "+" });
    expect(zoom).toHaveTextContent("225 %");
    fireEvent.keyDown(window, { key: "0" });
    expect(zoom).toHaveTextContent("100 %");
    const picture = within(viewer).getByRole("img", { name: "Mug, picture 1 of 3" });
    fireEvent.doubleClick(picture);
    expect(zoom).toHaveTextContent("250 %");
    // Zoomed: a swipe drags the picture instead of going to the next one.
    const area = picture.parentElement!.parentElement!;
    fireEvent.touchStart(area, { touches: [{ clientX: 200, clientY: 100 }] });
    fireEvent.touchEnd(area, { changedTouches: [{ clientX: 100, clientY: 110 }] });
    expect(within(viewer).getByRole("img", { name: "Mug, picture 1 of 3" })).toBeInTheDocument();
    fireEvent.click(within(zoom).getByRole("button", { name: "Fit the picture" }));
    expect(zoom).toHaveTextContent("100 %");
    fireEvent.wheel(picture.parentElement!, { deltaY: -200, clientX: 10, clientY: 10 });
    expect(zoom).not.toHaveTextContent("100 %");
    // The next picture starts fitted.
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(within(screen.getByRole("dialog")).getByRole("group", { name: "Zoom" })).toHaveTextContent("100 %");
  });
});
