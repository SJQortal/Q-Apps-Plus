import { describe, expect, it } from "vitest";
import {
  addDraftFiles,
  describeAddResult,
  describeRejections,
  draftFromRef,
  publishErrorMessage,
  toPublishInputs,
  totalDraftSize,
} from "./shareDraft";

const file = (name: string, size = 10, type = "text/plain") =>
  new File([new Uint8Array(size)], name, { type });

describe("addDraftFiles", () => {
  it("appends new files and skips a file with the same name and size", () => {
    const first = addDraftFiles([], [file("a.txt"), file("b.txt", 20)]);
    expect(first.files.map((f) => f.name)).toEqual(["a.txt", "b.txt"]);
    expect(first.duplicates).toEqual([]);

    const second = addDraftFiles(first.files, [file("a.txt"), file("a.txt", 99)]);
    expect(second.files.map((f) => [f.name, f.size])).toEqual([
      ["a.txt", 10],
      ["b.txt", 20],
      ["a.txt", 99],
    ]);
    expect(second.duplicates).toEqual(["a.txt"]);
    expect(describeAddResult(second)).toEqual(["a.txt is already in the list."]);
  });

  it("stops at 10 files and counts the rest", () => {
    const eight = addDraftFiles([], Array.from({ length: 8 }, (_, i) => file(`f${i}.txt`)));
    const result = addDraftFiles(eight.files, [file("x.txt"), file("y.txt"), file("z.txt"), file("w.txt")]);
    expect(result.files.length).toBe(10);
    expect(result.overLimit).toBe(2);
    expect(describeAddResult(result)).toEqual(["A share holds up to 10 files, so 2 were not added."]);
  });

  it("sums sizes and maps to publish inputs, passing QDN references through", () => {
    const ref = { filename: "old.zip", identifier: "qshare_file_x_abc123", name: "alice", service: "FILE" as const, mimetype: "application/zip", size: 500 };
    const files = [...addDraftFiles([], [file("a.txt")]).files, draftFromRef(ref)];
    expect(totalDraftSize(files)).toBe(510);
    const inputs = toPublishInputs(files);
    expect(inputs[0]).toHaveProperty("file");
    expect(inputs[1]).toEqual({ existing: ref });
  });
});

describe("describeRejections", () => {
  it("explains files over 2 GB and drops of more than 10 files", () => {
    const big = file("big.iso");
    const result = describeRejections([
      { file: big, errors: [{ code: "file-too-large", message: "" }] },
      { file: file("x"), errors: [{ code: "too-many-files", message: "" }] },
    ]);
    expect(result.tooLarge).toBe(true);
    expect(result.warnings).toEqual(["big.iso is over 2 GB and was not added.", "Choose up to 10 files at a time."]);
  });
});

describe("publishErrorMessage", () => {
  it("reads strings, { error } and { message }, then falls back", () => {
    expect(publishErrorMessage("nope", "fb")).toBe("nope");
    expect(publishErrorMessage({ error: "declined" }, "fb")).toBe("declined");
    expect(publishErrorMessage(new Error("boom"), "fb")).toBe("boom");
    expect(publishErrorMessage({ error: { unsuccessfulPublishes: [] } }, "fb")).toBe("fb");
    expect(publishErrorMessage(null, "fb")).toBe("fb");
  });
});
