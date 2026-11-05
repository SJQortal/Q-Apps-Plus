import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { renderWithProviders } from "../../test/renderWithProviders";
import { mockFetch, mockQortalAction, qortalCallsFor } from "../../test/setup";
import { store } from "../../state/store";
import { addUser } from "../../state/features/authSlice";
import { addToHashMap, removeFromHashMap } from "../../state/features/fileSlice";
import { resetOwnerAddresses } from "../../utils/recipientMarker";
import type { Collection, CollectionItem } from "../../utils/collections";
import { CollectionDialog } from "./CollectionDialog";
import { suggestSpace } from "./spaces/suggestSpace";

const collection = (space?: string, items: CollectionItem[] = []): Collection => ({
  version: 1,
  title: "Mine",
  description: "",
  items,
  created: 1,
  updated: 2,
  name: "alice",
  identifier: "qshare_collection_mine_ab12cd",
  fetchedAt: 3,
  ...(space ? { space } : {}),
});

const published = () => JSON.parse(atob(String(qortalCallsFor("PUBLISH_QDN_RESOURCE")[0].data64)));
const save = async (label = "Save") => {
  fireEvent.click(screen.getByRole("button", { name: label }));
  await waitFor(() => expect(qortalCallsFor("PUBLISH_QDN_RESOURCE").length).toBe(1));
};
const radio = (name: RegExp) => screen.getByRole("radio", { name });

const render = (props: Partial<Parameters<typeof CollectionDialog>[0]>) =>
  renderWithProviders(<CollectionDialog open onClose={vi.fn()} {...props} />);

describe("choosing a space", () => {
  beforeEach(() => {
    resetOwnerAddresses();
    store.dispatch(addUser({ address: "Qabc", publicKey: "k", name: "alice", names: [{ name: "alice", owner: "Qabc" }] }));
    mockFetch("/names/", { error: 401 });
    mockQortalAction("PUBLISH_QDN_RESOURCE", true);
  });

  it("offers five tiles in one radio group, with Standard chosen and nothing stored by default", async () => {
    render({});
    expect(screen.getByRole("radiogroup", { name: "Space" })).toBeInTheDocument();
    expect(screen.getAllByRole("radio")).toHaveLength(5);
    expect(new Set(screen.getAllByRole("radio").map((el) => el.getAttribute("name"))).size).toBe(1);
    expect(radio(/^Standard/)).toBeChecked();
    expect(screen.getByText(/Folders inside take the same look/)).toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: /title/i }), { target: { value: "New" } });
    await save("Create");
    expect("space" in published()).toBe(false);
  });

  it("publishes a new collection with the chosen space", async () => {
    render({});
    fireEvent.change(screen.getByRole("textbox", { name: /title/i }), { target: { value: "Films" } });
    fireEvent.click(radio(/^Cinema/));
    expect(radio(/^Cinema/)).toBeChecked();
    await save("Create");
    expect(published().space).toBe("cinema");
  });

  it("shows the stored space on edit, changes it, and clears it with Standard", async () => {
    const first = render({ collection: collection("music") });
    expect(radio(/^Music/)).toBeChecked();
    fireEvent.click(radio(/^Standard/));
    await save();
    expect("space" in published()).toBe(false);
    first.unmount();
  });

  it("leaves a look from a later version alone unless a tile is tapped", async () => {
    render({ collection: collection("arcade") });
    expect(radio(/^Standard/)).toBeChecked();
    await save();
    expect(published().space).toBe("arcade");
  });

  it("suggests from the bodies it holds, fetches none, and never picks by itself", async () => {
    const identifier = "qshare_file_song_aaa111_metadata";
    store.dispatch(
      addToHashMap({ id: identifier, user: "bob", title: "Songs", isValid: true, files: [{ filename: "a.mp3" }, { filename: "b.mp3" }] } as never)
    );
    render({ collection: collection(undefined, [{ name: "bob", identifier }]) });
    expect(screen.getByText(/Music may suit this collection/)).toBeInTheDocument();
    expect(radio(/^Standard/)).toBeChecked();
    expect(qortalCallsFor("FETCH_QDN_RESOURCE").length).toBe(0);
    await save();
    expect("space" in published()).toBe(false);
    store.dispatch(removeFromHashMap(identifier));
  });

  it("makes no suggestion once a space is stored", () => {
    const identifier = "qshare_file_song_aaa112_metadata";
    store.dispatch(addToHashMap({ id: identifier, user: "bob", title: "Songs", isValid: true, files: [{ filename: "a.mp3" }] } as never));
    render({ collection: collection("album", [{ name: "bob", identifier }]) });
    expect(screen.queryByText(/may suit/)).not.toBeInTheDocument();
    store.dispatch(removeFromHashMap(identifier));
  });
});

describe("suggestSpace", () => {
  it("names the kind most files are", () => {
    expect(suggestSpace([{ filename: "a.mp3" }, { mimetype: "audio/flac" }, { filename: "c.jpg" }])).toBe("music");
    expect(suggestSpace([{ filename: "a.mp4" }])).toBe("cinema");
    expect(suggestSpace([{ filename: "a.pdf" }, { filename: "b.epub" }])).toBe("library");
    expect(suggestSpace([{ filename: "a.png" }])).toBe("album");
  });

  it("names none when no kind stands out, or for files it can't place", () => {
    expect(suggestSpace([{ filename: "a.mp3" }, { filename: "b.jpg" }])).toBeNull();
    expect(suggestSpace([{ filename: "a.zip" }])).toBeNull();
    expect(suggestSpace([])).toBeNull();
  });
});
