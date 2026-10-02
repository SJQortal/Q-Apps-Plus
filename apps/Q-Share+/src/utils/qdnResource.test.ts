import { describe, expect, it } from "vitest";
import { fetchCallsMatching, mockFetch, mockQortalAction, qortalCallsFor } from "../test/setup";
import { resourceProperties, resourceStatus } from "./qdnResource";

const plain = { service: "FILE", name: "Simon James", identifier: "qshare_file_readme_0284a8" };
const slashed = { service: "FILE", name: "Vallot-/8/", identifier: "qshare_file_x_f1" };

describe("resource status and properties", () => {
  it("asks q-apps.js for ordinary names", async () => {
    mockQortalAction("GET_QDN_RESOURCE_STATUS", { status: "READY" });
    mockQortalAction("GET_QDN_RESOURCE_PROPERTIES", { filename: "README.md", size: 7317 });
    await expect(resourceStatus(plain, { build: true })).resolves.toEqual({ status: "READY" });
    await expect(resourceProperties(plain)).resolves.toMatchObject({ filename: "README.md" });
    expect(qortalCallsFor("GET_QDN_RESOURCE_STATUS")[0]).toMatchObject({ ...plain, build: true });
    expect(fetchCallsMatching("/arbitrary/resource/")).toEqual([]);
  });

  it("goes to the node with the name encoded for names q-apps.js breaks", async () => {
    mockFetch("/arbitrary/resource/status/", { status: "DOWNLOADING", percentLoaded: 40 });
    mockFetch("/arbitrary/resource/properties/", { filename: "guide.pdf", mimeType: "application/pdf", size: 628000 });
    await expect(resourceStatus(slashed, { build: false })).resolves.toMatchObject({ status: "DOWNLOADING" });
    await expect(resourceProperties(slashed)).resolves.toMatchObject({ filename: "guide.pdf" });
    expect(fetchCallsMatching("/arbitrary/resource/")).toEqual([
      "/arbitrary/resource/status/FILE/Vallot-%2F8%2F/qshare_file_x_f1?build=false",
      "/arbitrary/resource/properties/FILE/Vallot-%2F8%2F/qshare_file_x_f1",
    ]);
    expect(qortalCallsFor("GET_QDN_RESOURCE_STATUS")).toEqual([]);
  });

  it("rejects a Core error body, as q-apps.js does", async () => {
    mockFetch("/arbitrary/resource/status/", { error: 401, message: "Name not found" });
    await expect(resourceStatus(slashed)).rejects.toMatchObject({ error: 401 });
  });
});
