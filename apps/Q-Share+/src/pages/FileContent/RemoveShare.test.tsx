import { beforeEach, describe, expect, it } from "vitest";
import { configure, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { Route, Routes } from "react-router-dom";
import { FileContent } from "./FileContent";
import { renderWithProviders } from "../../test/renderWithProviders";
import { mockFetch, mockQortalAction, qortalCallsFor } from "../../test/setup";
import { store } from "../../state/store";
import { addUser } from "../../state/features/authSlice";
import { addToHashMap, removeFromHashMap } from "../../state/features/fileSlice";
import { resetQdnSearchCache } from "../../utils/qdnSearch";
import { resetPublishUnitFee } from "../../utils/publishBatches";

configure({ asyncUtilTimeout: 5_000 });

const ID = "qshare_file_unsorted_abc123_metadata";
const file = (n: number) => ({
  filename: `${n}.pdf`,
  identifier: `qshare_file_unsorted_f${n}`,
  name: "alice",
  service: "FILE",
  mimetype: "application/pdf",
  size: 1000,
});
const share = {
  id: ID,
  user: "alice",
  title: "Unsorted",
  version: 1,
  commentsId: "c",
  category: "3",
  files: [file(1), file(2)],
  thumbnail: { service: "THUMBNAIL", name: "alice", identifier: "qshare_thumb_unsorted_t1" },
  created: 1,
};

function renderShare() {
  store.dispatch(removeFromHashMap(ID));
  store.dispatch(addToHashMap(share));
  return renderWithProviders(
    <Routes>
      <Route path="/share/:name/:id" element={<FileContent />} />
      <Route path="/" element={<p>Home page</p>} />
    </Routes>,
    { initialEntries: [`/share/alice/${ID}`] }
  );
}

const sent = () => (qortalCallsFor("PUBLISH_MULTIPLE_QDN_RESOURCES").at(-1) as any).resources as any[];

async function confirmRemoval() {
  fireEvent.click(await screen.findByRole("button", { name: "Remove from QDN" }));
  const dialog = await screen.findByRole("dialog", { name: "Remove from QDN?" });
  await within(dialog).findByText(/4 publishes, 0\.04 QORT in fees/);
  fireEvent.click(within(dialog).getByRole("button", { name: "Remove" }));
}

beforeEach(() => {
  resetQdnSearchCache();
  resetPublishUnitFee();
  store.dispatch(addUser({ address: "Qalice", publicKey: "pk", name: "alice", names: [{ name: "alice", owner: "Qalice" }] }));
  mockFetch(/service=BLOG_COMMENT/, []);
  mockFetch("/transactions/unitfee", "1000000");
  mockQortalAction("GET_LIST_ITEMS", []);
});

describe("Remove from QDN", { timeout: 20_000 }, () => {
  it("says what it costs, sends delete markers, and the share is gone at once", async () => {
    mockQortalAction("PUBLISH_MULTIPLE_QDN_RESOURCES", true);
    renderShare();
    await confirmRemoval();
    await waitFor(() => expect(qortalCallsFor("PUBLISH_MULTIPLE_QDN_RESOURCES")).toHaveLength(1));
    expect(sent().map((r) => r.service)).toEqual(["FILE", "FILE", "THUMBNAIL", "DOCUMENT"]);
    expect(sent().at(-1)).toMatchObject({ identifier: ID, data64: "RA==", title: "deleted" });

    expect(await screen.findByText("Home page")).toBeInTheDocument();
    expect(store.getState().file.hashMapFiles[ID]).toMatchObject({ deleted: true, isValid: false });
    expect(store.getState().notifications.alertTypes.alertSuccess).toBe("Removed from QDN");
  });

  it("is only for the publisher", async () => {
    store.dispatch(addUser({ address: "Qbob", publicKey: "pk", name: "bob", names: [{ name: "bob", owner: "Qbob" }] }));
    renderShare();
    expect(await screen.findByRole("heading", { name: "Unsorted" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remove from QDN" })).not.toBeInTheDocument();
  });

  it("after a stop, keeps the share and sends only the rest", async () => {
    let call = 0;
    mockQortalAction("PUBLISH_MULTIPLE_QDN_RESOURCES", (params: any) => {
      call += 1;
      if (call > 1) return true;
      const failed = params.resources.filter((r: any) => r.identifier !== "qshare_file_unsorted_f1");
      throw { error: { unsuccessfulPublishes: failed.map((r: any) => ({ identifier: r.identifier })) }, message: "x" };
    });
    renderShare();
    await confirmRemoval();
    fireEvent.click(await screen.findByText("1 of 4 published").then(() => screen.getAllByRole("button", { name: "Close" }).at(-1)!));
    await waitFor(() => expect(store.getState().notifications.alertTypes.alertInfo).toMatch(/^1 of 4 removed/));
    expect(store.getState().file.hashMapFiles[ID]?.deleted).toBeUndefined();

    fireEvent.click(await screen.findByRole("button", { name: "Remove from QDN" }));
    const dialog = await screen.findByRole("dialog", { name: "Remove from QDN?" });
    await within(dialog).findByText(/3 publishes/);
    fireEvent.click(within(dialog).getByRole("button", { name: "Remove" }));
    await waitFor(() => expect(qortalCallsFor("PUBLISH_MULTIPLE_QDN_RESOURCES")).toHaveLength(2));
    expect(sent().map((r) => r.identifier)).toEqual(["qshare_file_unsorted_f2", "qshare_thumb_unsorted_t1", ID]);
    expect(await screen.findByText("Home page")).toBeInTheDocument();
  });
});
