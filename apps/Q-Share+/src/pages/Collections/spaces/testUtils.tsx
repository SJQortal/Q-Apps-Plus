import { Route, Routes } from "react-router-dom";
import { renderWithProviders } from "../../../test/renderWithProviders";
import { mockFetch, mockQortalAction } from "../../../test/setup";
import { addUser } from "../../../state/features/authSlice";
import { clearMine, upsertCollection } from "../../../state/features/collectionsSlice";
import { removeFromHashMap } from "../../../state/features/fileSlice";
import { store } from "../../../state/store";
import { resetInAppHistory } from "../../../hooks/useSafeBack";
import { parseCollection, resetCollectionCaches, type CollectionFolder, type CollectionItem } from "../../../utils/collections";
import { resetQdnSearchCache } from "../../../utils/qdnSearch";
import { resetOwnerAddresses } from "../../../utils/recipientMarker";
import { CollectionPage } from "../CollectionPage";

export const SPACE_OWNER = "alice";
export const SPACE_COLLECTION_ID = "qshare_collection_space_ab12cd";
export const SPACE_FOLDER_ID = "fold01";

/** A share file in a body. */
export const spaceFile = (filename: string, mimetype: string, identifier = `file_${filename}`, size = 1000) => ({
  filename,
  mimetype,
  identifier,
  name: "bob",
  service: "FILE",
  size,
});

/** Share bodies by identifier; a string body is a delete marker. */
export type SpaceBodies = Record<string, Record<string, unknown> | string>;

/** One share of each kind, a deleted one, and an empty folder's worth of everything else. */
export const SPACE_BODIES: SpaceBodies = {
  qshare_file_songs_aaa111_metadata: {
    title: "Songs",
    files: [spaceFile("one.mp3", "audio/mpeg"), spaceFile("two.mp3", "audio/mpeg")],
  },
  qshare_file_film_bbb222_metadata: {
    title: "Film",
    files: [spaceFile("film.mp4", "video/mp4")],
    thumbnail: { service: "THUMBNAIL", name: "bob", identifier: "qshare_thumb_film" },
  },
  qshare_file_book_ccc333_metadata: { title: "Book", files: [spaceFile("book.pdf", "application/pdf")] },
  qshare_file_photo_ddd444_metadata: { title: "Photo", files: [spaceFile("photo.jpg", "image/jpeg")] },
  qshare_file_gone_eee555_metadata: "D",
};

export const spaceItems = (bodies: SpaceBodies = SPACE_BODIES): CollectionItem[] =>
  Object.keys(bodies).map((identifier) => ({ name: "bob", identifier }));

export const spaceFolder = (overrides: Partial<CollectionFolder> = {}): CollectionFolder => ({
  id: SPACE_FOLDER_ID,
  title: "Live",
  description: "",
  items: [],
  folders: [],
  ...overrides,
});

interface RenderSpaceOptions {
  space?: string;
  /** Who is signed in: the owner by default, null for nobody, or another name. */
  signedInAs?: string | null;
  bodies?: SpaceBodies;
  /** The collection's own shares; by default one per body. */
  items?: CollectionItem[];
  folders?: CollectionFolder[];
  /** Open this folder's page instead of the collection's. */
  folderId?: string;
  /** Anything else in the collection's body (cover, copiedFrom…). */
  body?: Record<string, unknown>;
}

/**
 * The real collection page, with the Qortal calls answered from the fixture,
 * so a space is tested with its dialogs, states and body queue. Publishes
 * succeed without a node. Call in a test, and call resetSpaceTest in beforeEach.
 */
export function renderSpace(options: RenderSpaceOptions = {}) {
  const { space = "music", signedInAs = SPACE_OWNER, bodies = SPACE_BODIES, folders = [], folderId, body = {} } = options;
  store.dispatch(
    addUser(signedInAs ? { address: `Q${signedInAs}`, publicKey: "k", name: signedInAs, names: [{ name: signedInAs, owner: `Q${signedInAs}` }] } : null)
  );
  const stored = {
    version: 1,
    title: "My space",
    description: "Handy things",
    items: options.items ?? spaceItems(bodies),
    created: 1,
    updated: 2,
    space,
    folders,
    ...body,
  };
  // The store outlives a test: it must not show the last test's copy first.
  store.dispatch(upsertCollection({ ...parseCollection(stored)!, name: SPACE_OWNER, identifier: SPACE_COLLECTION_ID, fetchedAt: 1 }));
  mockQortalAction("FETCH_QDN_RESOURCE", (params: Record<string, unknown>) => {
    if (params.identifier === SPACE_COLLECTION_ID) return stored;
    const found = bodies[String(params.identifier)];
    if (found === undefined) throw new Error("Data unavailable");
    return found;
  });
  mockQortalAction("PUBLISH_QDN_RESOURCE", true);
  mockFetch("/names/", { error: 401 });
  mockFetch("/arbitrary/resources/search", []);
  const base = `/collection/${SPACE_OWNER}/${SPACE_COLLECTION_ID}`;
  return renderWithProviders(
    <Routes>
      <Route path="/collection/:name/:id" element={<CollectionPage />} />
      <Route path="/collection/:name/:id/folder/:folderId" element={<CollectionPage />} />
      <Route path="/collections" element={<p>Collections list</p>} />
      <Route path="/share/:name/:id" element={<p>Share page</p>} />
      <Route path="/channel/:name" element={<p>Profile page</p>} />
    </Routes>,
    { initialEntries: [folderId ? `${base}/folder/${folderId}` : base] }
  );
}

/** Clears what a space test leaves in the app's store and caches. */
export function resetSpaceTest(bodies: SpaceBodies = SPACE_BODIES) {
  resetInAppHistory();
  resetQdnSearchCache();
  resetCollectionCaches();
  resetOwnerAddresses();
  store.dispatch(clearMine());
  for (const identifier of Object.keys(bodies)) store.dispatch(removeFromHashMap(identifier));
}
