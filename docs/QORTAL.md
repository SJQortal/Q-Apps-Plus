# Qortal notes for + app work

These are the platform facts that matter when changing these apps. Where Torq already solved something, the file is named so you can read the real code in `shared/reference/torq/`.

## How a Q-App runs

- **Where it's served:** Hub (desktop) and GO (mobile) load the app's published zip in an iframe at `/render/APP/<Name>/…`. The app talks to the Qortal node through the global `qortalRequest({ action, ... })`, which Hub injects. Read-only Core endpoints are also reachable with a relative `fetch('/arbitrary/…')`, `fetch('/names/…')` and so on.
- **What Hub injects:**
  - `window._qdnTheme` (`'light'|'dark'`), `window._qdnBase` (the `/render/APP/<Name>` prefix), `window._qdnName` and `window._qdnService`.
  - The query string `?theme=&lang=&identifier=&time=`.
  - Torq reads these in `utils/hubBoot.ts` and `utils/hubLocation.ts`, and strips Hub's query keys from the visible URL in `index.html`.
- **Routing:**
  - Client routes must work under the `/render/APP/<Name>` prefix. Torq sets a `<base href>` from `_qdnBase` at boot.
  - Report route changes to Hub with `qortalRequest({ action: 'NAVIGATION_SUCCESS', path })` (Names and Q-Node do this) or the `QDN_RESOURCE_DISPLAYED` postMessage (Torq's `index.html`), so Hub's back button and deep links work.
- **Deep links:** `qortal://APP/<Name>/<path>` opens an app. **These app names contain `+`**, so always build links with `encodeURIComponent(name)`, and decode `_qdnName` / path segments with `decodeURIComponent` (never `URLSearchParams`, which turns `+` into a space). Check that `qortal://APP/Q-Mail+` opens in Hub. If it doesn't, write down the exact failure in the brief.
- **Links between the + apps:** when one + app links to another app that also has a + version (e.g. a Q-Tube video from Q-Mail+), link to the + version.
- **No outside network:** apps can't call web2 services, so bundle every asset.

## QDN in one paragraph

A resource is `{ service, name, identifier }`, where `name` is the publisher's registered Qortal name.

- **Services** these apps use: `THUMBNAIL`, `DOCUMENT`, `DOCUMENT_PRIVATE`, `FILE`, `FILE_PRIVATE`, `VIDEO`, `AUDIO`, `PLAYLIST`, `BLOG`, `BLOG_POST`, `BLOG_COMMENT`, `CHAIN_COMMENT`, `MAIL_PRIVATE`, `STORE`, `PRODUCT` and `JSON`, plus `APP` for the apps themselves. Each brief lists that app's set.
- **Identifiers** are free-form strings, up to 64 characters. Apps namespace them with prefixes such as `qortal_qmail_`, `qtube_vid_` or `mintership-forum-message`.
- **Publishing:** `PUBLISH_QDN_RESOURCE` or `PUBLISH_MULTIPLE_QDN_RESOURCES`. Hub asks the user to confirm. It needs a registered name, and the latest publish for `{service, name, identifier}` wins.
- **Reading:**
  - Metadata: `SEARCH_QDN_RESOURCES` or `/arbitrary/resources/search`.
  - Data: `FETCH_QDN_RESOURCE`, or `GET_QDN_RESOURCE_URL` for binary files.
  - Download progress for data not yet held locally: `GET_QDN_RESOURCE_STATUS`.
- **Encryption:** private data (mail, some shop data) is encrypted, and Hub decrypts it with `DECRYPT_DATA`. Group data uses `ENCRYPT_QORTAL_GROUP_DATA`. Never change these schemes; see ground rule 1 in CLAUDE.md.

## Efficiency rules

Every `SEARCH_QDN_RESOURCES` is a Hub→Core round trip. In GO it also goes over a MessageChannel hop and competes in qapp-core's queue of 6. Most slowness in these apps comes from too many or too broad searches. Torq's `utils/qdnResourceSearch.ts` and `utils/qdnMemoryCache.ts` implement all of the following. Port that approach rather than inventing a new one:

1. **Never unlimited.** `limit: 0` means "everything" to Core and qapp-core. Use pages of about 20, and load more on scroll. (Q-Mintership+ has ~21 unlimited searches.)
2. **Merge duplicates.** Merge identical searches that are already running into one promise, keyed by all params.
3. **Session cache with TTL.** Reuse results for 1–3 minutes, and invalidate the right keys after the user publishes.
4. **Narrow the query:**
   - `name`/`names` + `exactMatchNames: true` when you know the publisher.
   - `identifier` + `prefix: true` for namespaced ids.
   - `mode: 'LATEST'` unless you really need every version.
   - `includeMetadata` only when you show title or description.
5. **Batch name lookups.** Primary name and avatar lookups repeat across lists, so cache them (Torq's `primaryNamesCache.ts` and `profileCache.ts`), and prefetch visible avatars once (`prefetchQortalAvatars.ts`).
6. **Load lazily.** Fetch thumbnails and images when they scroll into view (IntersectionObserver), not for the whole list. Show the thumbnail, not the full-size image, in lists.
7. **Poll politely.** Use no `setInterval` loops at a fixed short period. Poll only while `document.visibilityState === 'visible'`, with backoff, and stop when the view unmounts.
8. **Bundle size.**
   - Lazy-load routes and heavy libraries (editors, PDF, emoji, charts, video).
   - Remove unused dependencies.
   - Keep the biggest JS chunk well under 1 MB where you can.
   - Baseline sizes are in each app's brief. The zip is downloaded from peers, so every KB counts.
9. **Optimistic UI.** For likes, votes, follows and small edits, update the UI at once, then publish, and roll back on failure.
10. **Measure.** In the brief, record before and after numbers: searches on first load (count them with a wrapper or test spy), biggest chunk size, and dist size.

## qapp-core

The newer apps (Q-Tube+, Q-Trade+, Names+ and Q-Node+, like Torq) use `qapp-core`. Its `GlobalProvider` provides auth, lists, identifier hashing (`publicSalt`) and caching:

- `useGlobal`, `usePublish`, `useResources`, `useResourceStatus`;
- `ResourceListDisplay` for lists;
- `VideoPlayer` and `AudioPlayerControls` for media;
- `EnumCollisionStrength` and `hashWordWithoutPublicSalt` for identifiers.

`apps/Q-Tube+/QORTAL.md` has a longer summary. Keep the app's existing `publicSalt` and app name in its qapp-core config, or it will stop finding its own data. The older apps (Q-Mail+, Q-Shop+, Q-Share+, Q-Support+ and Q-Fund+) use Redux and call `qortalRequest` directly. Moving them to qapp-core is a possible later step, not part of a first redesign pass.

## Testing without a Qortal node

None of the upstream apps have tests. Add a harness when you first change logic in an app:

- `vitest` + `jsdom` + `@testing-library/react` (+ `fake-indexeddb` if the app uses IndexedDB).
- A global `qortalRequest` mock in `src/test/setup.ts` that answers by `action`, so tests can assert which calls were made and how many.
- For qapp-core apps, mock the module the way Torq's `src/test/qappCoreMock.ts` does.

Test the logic you change: search params, caching and dedupe, identifier building, data parsing, optimistic updates, and settings persistence. A test that counts `SEARCH_QDN_RESOURCES` calls on first load is the best guard for efficiency work.

## Publishing (Simon does this)

`scripts/build-zip.sh <App+>` writes `release/<App+>.zip` with `index.html` at its root. In Hub, Simon publishes it as service `APP` under the matching name (e.g. `Q-Mail+`). Agents never publish.
