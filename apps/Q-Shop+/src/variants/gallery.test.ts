import { describe, expect, it } from "vitest";
import { firstPictureOf, groupPictures, itemForPicture, pictureCaption, shownPicture } from "./gallery";

const options = [
  { name: "Round", values: [{ name: "Pale" }, { name: "Orange" }, { name: "Red" }] },
  { name: "Square", values: [{ name: "Pale" }] },
  { name: "Gift box", values: [] },
];

describe("a variant group's gallery", () => {
  // The lead's first picture is its own; the rest are the product's.
  const members = [
    { values: ["Square", "Pale"], images: ["square"], lead: false },
    { values: ["Round", "Pale"], images: ["pale", "p1", "p2"], lead: true },
    { values: ["Round", "Orange"], images: ["round"], lead: false },
    { values: ["Round", "Red"], images: ["round"], lead: false },
    { values: ["Gift box"], images: ["p1"], lead: false },
  ];
  const list = groupPictures(options, members, ["p3"]);

  it("lists each item's pictures in the group's order, then the product's, each once", () => {
    expect(list.map((p) => p.src)).toEqual(["pale", "round", "square", "p1", "p2", "p3"]);
    expect(list.find((p) => p.src === "round")?.items).toEqual([
      ["Round", "Orange"],
      ["Round", "Red"],
    ]);
    // A product picture an item uses is that item's.
    expect(list.find((p) => p.src === "p1")?.items).toEqual([["Gift box"]]);
    expect(list.find((p) => p.src === "p2")?.items).toEqual([]);
  });

  it("leaves out items not loaded yet, and an item the options no longer have", () => {
    expect(groupPictures(options, [members[0], { values: ["Oval"], images: ["oval"], lead: false }]).map((p) => p.src)).toEqual(["square"]);
  });

  it("opens on the item's first picture", () => {
    expect(firstPictureOf(list, ["Round", "Red"])).toBe(1);
    expect(firstPictureOf(list, ["Gift box"])).toBe(3);
    expect(firstPictureOf(list, ["Nowhere"])).toBe(0);
  });

  it("a picture leads to its item: none for the item's own or the product's, else the same variant, or the same value", () => {
    const at = (src: string) => list.find((p) => p.src === src);
    expect(itemForPicture(at("round"), ["Round", "Red"])).toBeNull();
    expect(itemForPicture(at("p2"), ["Round", "Red"])).toBeNull();
    expect(itemForPicture(at("square"), ["Round", "Red"])).toEqual(["Square", "Pale"]);
    expect(itemForPicture(at("round"), ["Square", "Pale"])).toEqual(["Round", "Orange"]);
    expect(itemForPicture({ src: "x", items: [["Round", "Orange"], ["Square", "Pale"]] }, ["Round", "Pale"])).toEqual(["Round", "Orange"]);
    expect(itemForPicture({ src: "x", items: [["Round", "Orange"], ["Square", "Pale"]] }, ["Gift box"])).toEqual(["Round", "Orange"]);
    expect(itemForPicture({ src: "x", items: [["Round", "Orange"], ["Round", "Pale"]] }, ["Square", "Pale"])).toEqual(["Round", "Pale"]);
  });

  it("shows the chosen picture while it fits the item, else the item's", () => {
    expect(shownPicture(list, "p2", ["Round", "Red"])).toBe(4);
    expect(shownPicture(list, "square", ["Round", "Red"])).toBe(1);
    expect(shownPicture(list, "gone", ["Square", "Pale"])).toBe(2);
    expect(shownPicture(list, null, ["Square", "Pale"])).toBe(2);
  });

  it("says what each picture is of", () => {
    expect(list.map((p) => pictureCaption(p, options))).toEqual(["Round / Pale", "Round / Orange, Red", "Square / Pale", "Gift box", undefined, undefined]);
    expect(pictureCaption({ src: "x", items: [["Round", "Pale"], ["Round", "Orange"], ["Round", "Red"]] }, options)).toBe("Round");
    expect(pictureCaption({ src: "x", items: [["Round", "Pale"], ["Square", "Pale"]] }, options)).toBeUndefined();
  });
});
