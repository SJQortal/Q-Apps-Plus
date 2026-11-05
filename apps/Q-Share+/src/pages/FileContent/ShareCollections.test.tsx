import { beforeEach, describe, expect, it } from "vitest";
import { configure, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { Route, Routes, useLocation } from "react-router-dom";
import { renderWithProviders } from "../../test/renderWithProviders";
import { mockFetch, mockQortalAction } from "../../test/setup";
import { store } from "../../state/store";
import { addUser } from "../../state/features/authSlice";
import { clearMine } from "../../state/features/collectionsSlice";
import { resetQdnSearchCache } from "../../utils/qdnSearch";
import { resetCollectionCaches } from "../../utils/collections";
import { resetMyCollectionsLoader } from "../../components/common/SaveToCollection/useMyCollections";
import { ShareCollections } from "./ShareCollections";

configure({ asyncUtilTimeout: 5_000 });

const share = { name: "bob", identifier: "qshare_file_song_aa1111_metadata" };
const row = (slug: string, title: string) => ({
  name: "alice",
  service: "DOCUMENT",
  identifier: `qshare_collection_${slug}_${slug.slice(0, 2)}0000`,
  updated: 10,
  metadata: { title, description: "" },
});
const bodies: Record<string, object> = {
  qshare_collection_plain_pl0000: { title: "Plain", items: [share] },
  qshare_collection_nested_ne0000: {
    title: "Nested",
    items: [],
    cover: { service: "THUMBNAIL", name: "alice", identifier: "qshare_cover_nest0001" },
    folders: [{ id: "live01", title: "Live", description: "", items: [share], folders: [] }],
  },
  qshare_collection_other_ot0000: { title: "Other", items: [{ name: "bob", identifier: "qshare_file_else_bb2222_metadata" }] },
};

function Where() {
  return <p data-testid="where">{useLocation().pathname}</p>;
}

function renderCard() {
  return renderWithProviders(
    <>
      <Routes>
        <Route path="*" element={<ShareCollections share={share} />} />
      </Routes>
      <Where />
    </>,
    { initialEntries: ["/share/bob/x"] }
  );
}

beforeEach(() => {
  resetQdnSearchCache();
  resetCollectionCaches();
  resetMyCollectionsLoader();
  store.dispatch(clearMine());
  store.dispatch(addUser({ address: "Qalice", publicKey: "k", name: "alice", names: [{ name: "alice", owner: "Qalice" }] }));
  mockFetch("/arbitrary/resources/search", [row("plain", "Plain"), row("nested", "Nested"), row("other", "Other")]);
  mockQortalAction("FETCH_QDN_RESOURCE", (params) => ({ version: 1, description: "", created: 1, updated: 2, ...bodies[String(params.identifier)] }));
});

describe("a share's collections on its page", { timeout: 20_000 }, () => {
  it("shows yours that hold it, with their cover and what they hold, and opens them where the share is", async () => {
    const { container } = renderCard();
    fireEvent.click(await screen.findByRole("button", { name: "Open Nested" }));
    expect(screen.getByTestId("where")).toHaveTextContent("/collection/alice/qshare_collection_nested_ne0000/folder/live01");
    expect(screen.getByRole("button", { name: "Open Plain" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Open Other" })).not.toBeInTheDocument();
    expect(screen.getByText("1 share · 1 folder · in Live")).toBeInTheDocument();
    expect(container.querySelector('img[src="/arbitrary/THUMBNAIL/alice/qshare_cover_nest0001?async=true"]')).not.toBeNull();
  });

  it("offers Add cover or Change cover, through the collection's Edit", async () => {
    renderCard();
    expect(await screen.findByRole("button", { name: "Add the cover of Plain" })).toHaveTextContent("Add cover");
    expect(screen.getByRole("button", { name: "Change the cover of Nested" })).toHaveTextContent("Change cover");
    fireEvent.click(screen.getByRole("button", { name: "Add the cover of Plain" }));
    const dialog = within(await screen.findByRole("dialog", { name: "Edit collection" }));
    await waitFor(() => expect(dialog.getByRole("textbox", { name: /title/i })).toHaveValue("Plain"));
  });

  it("shows nothing when signed out", async () => {
    store.dispatch(addUser(null));
    const { container } = renderCard();
    await new Promise((r) => setTimeout(r, 30));
    expect(container.querySelector("[aria-label^='In your collection']")).toBeNull();
  });
});
