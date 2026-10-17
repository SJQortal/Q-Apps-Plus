import { beforeEach, describe, expect, it } from "vitest";
import { configure, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { Route, Routes, useLocation } from "react-router-dom";
import { renderWithProviders } from "../../test/renderWithProviders";
import { mockFetch, mockQortalAction, qortalCallsFor } from "../../test/setup";
import { store } from "../../state/store";
import { addUser } from "../../state/features/authSlice";
import { clearMine } from "../../state/features/collectionsSlice";
import { resetQdnSearchCache } from "../../utils/qdnSearch";
import { resetCollectionCaches } from "../../utils/collections";
import { resetInAppHistory } from "../../hooks/useSafeBack";
import { resetOwnerAddresses } from "../../utils/recipientMarker";
import { CollectionPage } from "./CollectionPage";

configure({ asyncUtilTimeout: 5_000 });

const ID = "qshare_collection_music_ab12cd";
const share = (n: number) => ({ name: "bob", identifier: `qshare_file_song${n}_aaa${n}_metadata` });
const stored = () => ({
  version: 1,
  title: "Music",
  description: "Mixes",
  items: [share(1)],
  created: 1,
  updated: 2,
  folders: [
    {
      id: "live01",
      title: "Live",
      description: "On stage",
      items: [share(2), share(3)],
      folders: [{ id: "tokyo1", title: "Tokyo", description: "", items: [share(4)], folders: [] }],
    },
    { id: "demo01", title: "Demos", description: "", items: [], folders: [] },
  ],
});

function Where() {
  return <p data-testid="where">{useLocation().pathname}</p>;
}

function renderPage(path = `/collection/alice/${ID}`) {
  return renderWithProviders(
    <>
      <Routes>
        <Route path="/collection/:name/:id" element={<CollectionPage />} />
        <Route path="/collection/:name/:id/folder/:folderId" element={<CollectionPage />} />
      </Routes>
      <Where />
    </>,
    { initialEntries: [path] }
  );
}

const published = () => JSON.parse(atob(String(qortalCallsFor("PUBLISH_QDN_RESOURCE").at(-1)?.data64)));
const signInAsOwner = () =>
  store.dispatch(addUser({ address: "Qabc", publicKey: "k", name: "alice", names: [{ name: "alice", owner: "Qabc" }] }));

describe("folders in a collection", { timeout: 20_000 }, () => {
  beforeEach(() => {
    resetInAppHistory();
    resetQdnSearchCache();
    resetCollectionCaches();
    resetOwnerAddresses();
    store.dispatch(clearMine());
    mockFetch("/names/", { error: 401 });
    mockQortalAction("PUBLISH_QDN_RESOURCE", true);
    mockQortalAction("FETCH_QDN_RESOURCE", (params) => {
      if (params.identifier === ID) return stored();
      const n = String(params.identifier).match(/song(\d)/)?.[1];
      return { title: `Song ${n}`, files: [] };
    });
  });

  it("shows the collection's folders as tiles and opens one with a way back up", async () => {
    store.dispatch(addUser(null));
    renderPage();
    expect(await screen.findByRole("heading", { level: 1, name: "Music" })).toBeInTheDocument();
    expect(screen.getByText("· 4 shares")).toBeInTheDocument();
    expect(screen.getByText("· 2 folders")).toBeInTheDocument();
    const tiles = within(screen.getByRole("list", { name: "Folders" }));
    expect(tiles.getByRole("button", { name: "Open folder Live" })).toHaveTextContent("3 shares · 1 folder");
    expect(tiles.getByRole("button", { name: "Open folder Demos" })).toHaveTextContent("Empty");
    expect(await screen.findByText("Song 1")).toBeInTheDocument();
    expect(screen.queryByText("Song 2")).not.toBeInTheDocument();

    fireEvent.click(tiles.getByRole("button", { name: "Open folder Live" }));
    expect(screen.getByTestId("where")).toHaveTextContent(`/collection/alice/${ID}/folder/live01`);
    expect(await screen.findByRole("heading", { level: 1, name: "Live" })).toBeInTheDocument();
    expect(screen.getByText("On stage")).toBeInTheDocument();
    expect(await screen.findByText("Song 2")).toBeInTheDocument();
    expect(screen.getByText("Song 3")).toBeInTheDocument();
    expect(screen.queryByText("Song 1")).not.toBeInTheDocument();
    // One fetch of the collection serves every folder page.
    expect(qortalCallsFor("FETCH_QDN_RESOURCE").filter((c) => c.identifier === ID).length).toBe(1);

    fireEvent.click(within(screen.getByRole("list", { name: "Folders" })).getByRole("button", { name: "Open folder Tokyo" }));
    const crumbs = within(await screen.findByRole("navigation", { name: "Where this folder is" }));
    expect(crumbs.getByRole("button", { name: "Music" })).toBeInTheDocument();
    fireEvent.click(crumbs.getByRole("button", { name: "Live" }));
    expect(screen.getByTestId("where")).toHaveTextContent(`/collection/alice/${ID}/folder/live01`);
  });

  it("lets the owner make a folder inside a folder, kept with everything else", async () => {
    signInAsOwner();
    renderPage(`/collection/alice/${ID}/folder/live01`);
    fireEvent.click(await screen.findByRole("button", { name: "New folder" }));
    const dialog = within(await screen.findByRole("dialog", { name: "New folder" }));
    fireEvent.change(dialog.getByRole("textbox", { name: /title/i }), { target: { value: "Berlin" } });
    fireEvent.click(dialog.getByRole("button", { name: "Create" }));

    await waitFor(() => expect(qortalCallsFor("PUBLISH_QDN_RESOURCE").length).toBe(1));
    const body = published();
    const live = body.folders.find((f: any) => f.id === "live01");
    expect(live.folders.map((f: any) => f.title)).toEqual(["Tokyo", "Berlin"]);
    expect(live.items).toEqual([share(2), share(3)]);
    expect(body.items).toEqual([share(1)]);
    expect(body.folders.map((f: any) => f.id)).toEqual(["live01", "demo01"]);
    const berlin = live.folders[1];
    expect(berlin).toMatchObject({ title: "Berlin", description: "", items: [], folders: [] });
    expect(berlin.id).toMatch(/^[a-z0-9]{6}$/);
    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent(`/folder/${berlin.id}`));
    expect(await screen.findByRole("heading", { level: 1, name: "Berlin" })).toBeInTheDocument();
  });

  it("moves a share into a folder in one publish", async () => {
    signInAsOwner();
    renderPage();
    await screen.findByText("Song 1");
    fireEvent.click(screen.getByRole("button", { name: "Move Song 1" }));
    const dialog = within(await screen.findByRole("dialog", { name: "Move to" }));
    expect(dialog.getByRole("button", { name: /Music/ })).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(dialog.getByRole("button", { name: "Tokyo" }));

    await waitFor(() => expect(qortalCallsFor("PUBLISH_QDN_RESOURCE").length).toBe(1));
    const body = published();
    expect(body.items).toEqual([]);
    expect(body.folders[0].folders[0].items).toEqual([share(4), share(1)]);
    await waitFor(() => expect(screen.queryByText("Song 1")).not.toBeInTheDocument());
    expect(store.getState().notifications.alertTypes.alertSuccess).toBe("Moved to Tokyo");
  });

  it("deletes a folder and what is in it, and goes back to where it was", async () => {
    signInAsOwner();
    renderPage(`/collection/alice/${ID}/folder/live01`);
    fireEvent.click(await screen.findByRole("button", { name: "Delete" }));
    const dialog = within(await screen.findByRole("dialog", { name: "Delete folder?" }));
    expect(dialog.getByText(/3 shares, 1 folder/)).toBeInTheDocument();
    fireEvent.click(dialog.getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(qortalCallsFor("PUBLISH_QDN_RESOURCE").length).toBe(1));
    const body = published();
    expect(body.folders.map((f: any) => f.id)).toEqual(["demo01"]);
    expect(body.items).toEqual([share(1)]);
    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent(new RegExp(`/collection/alice/${ID}$`)));
  });

  it("says so when a folder isn't there", async () => {
    store.dispatch(addUser(null));
    renderPage(`/collection/alice/${ID}/folder/gone00`);
    expect(await screen.findByText("Folder not found")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Open the collection" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Music" })).toBeInTheDocument();
  });
});
