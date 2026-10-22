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
});
