import { describe, expect, it } from "vitest";
import {
  addDraftFiles,
  describeAddResult,
  keptFilesText,
  landedRefs,
  newFileRefs,
  withPublishedFiles,
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

  it("stops at 300 files and counts the rest", () => {
    const many = addDraftFiles([], Array.from({ length: 298 }, (_, i) => file(`f${i}.txt`)));
    expect(many.files.length).toBe(298);
    const result = addDraftFiles(many.files, [file("x.txt"), file("y.txt"), file("z.txt"), file("w.txt")]);
    expect(result.files.length).toBe(300);
    expect(result.overLimit).toBe(2);
    expect(describeAddResult(result)).toEqual(["A share holds up to 300 files, so 2 were not added."]);
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

describe("files kept after a stopped publish", () => {
  const ref = (identifier: string, filename: string) => ({
    filename,
    identifier,
    name: "alice",
    service: "FILE" as const,
    mimetype: "text/plain",
    size: 10,
  });

  it("maps new draft files to where they go, and turns those that landed into references", () => {
    const old = ref("qshare_file_x_old111", "old.txt");
    const { files } = addDraftFiles([draftFromRef(old)], [file("a.txt"), file("b.txt")]);
    const refs = newFileRefs(files, [old, ref("qshare_file_x_aaa111", "a.txt"), ref("qshare_file_x_bbb111", "b.txt")]);
    expect(Object.values(refs).map((r) => r.filename)).toEqual(["a.txt", "b.txt"]);

    const landed = landedRefs(refs, ["qshare_file_x_aaa111", "qshare_file_x_metadata"]);
    const next = withPublishedFiles(files, landed);
    expect(next.map((f) => [f.name, f.existing?.identifier ?? null])).toEqual([
      ["old.txt", "qshare_file_x_old111"],
      ["a.txt", "qshare_file_x_aaa111"],
      ["b.txt", null],
    ]);
    expect(toPublishInputs(next).map((input) => ("existing" in input ? "ref" : "file"))).toEqual(["ref", "ref", "file"]);
  });

  it("says what stays in the draft", () => {
    expect(keptFilesText(1, 1)).toBe("The file is on QDN and stays in the draft: publishing again sends only the share details.");
    expect(keptFilesText(3, 3)).toBe("All 3 files are on QDN and stay in the draft: publishing again sends only the share details.");
    expect(keptFilesText(1, 4)).toBe("1 of 4 files is on QDN and stays in the draft: publishing again sends only the rest.");
    expect(keptFilesText(20, 25)).toBe("20 of 25 files are on QDN and stay in the draft: publishing again sends only the rest.");
  });
});

describe("describeRejections", () => {
  it("explains files over 2 GB and drops of too many files", () => {
    const big = file("big.iso");
    const result = describeRejections([
      { file: big, errors: [{ code: "file-too-large", message: "" }] },
      { file: file("x"), errors: [{ code: "too-many-files", message: "" }] },
    ]);
    expect(result.tooLarge).toBe(true);
    expect(result.warnings).toEqual(["big.iso is over 2 GB and was not added.", "Choose up to 300 files at a time."]);
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
