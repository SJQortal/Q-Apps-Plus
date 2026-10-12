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
- **Deep links:** `qortal://APP/<Name>/<path>` opens an app. **These app names contain `+`, and Hub never decodes the app name**, so write it literally: `qortal://APP/Q-Share+/share/<name>/<id>`. `Q-Share%2B` opens a blank tab, because the router's basename never matches `/render/APP/Q-Share+` (checked in Hub, 2026-09-30). Encode the path segments after the app name with `encodeURIComponent` (a space becomes `%20`, as Hub's own Copy link does), and let the router accept the `%2B` spelling too. Decode `_qdnName` and path segments with `decodeURIComponent`, never `URLSearchParams`, which turns `+` into a space.
- **Links between the + apps:** when one + app links to another app that also has a + version (e.g. a Q-Tube video from Q-Mail+), link to the + version.
- **No outside network:** apps can't call web2 services, so bundle every asset.

## Hub & GO pitfalls

Q-Share+'s Hub Dev Mode check (2026-09-30) found these in real Hub. None of them showed up in unit tests or the screenshot check, and most apply to every app. Check each one in an app's Hub round (docs/HUB-TESTING.md). Reuse Q-Share+'s fix where one is named.

**Theme and layout**

1. **Hub light/dark switch.** Hub doesn't reload the app when its light/dark switch flips; it posts `THEME_CHANGED` instead. The theme kit handles this from 2026-09-30, so keep the app's kit copy synced (`scripts/sync-theme.sh --check`).
2. **Sticky headers.** `overflow-x: hidden` on `html` or `body` makes `body` a scroll container, and sticky headers and Back bars then scroll away. Use `overflow-x: clip`.
3. **Frame height.** Size the app to Hub's frame, never `100vh`. A phone held sideways gives the app a frame only about 266 px tall in Hub. Plan a compact landscape layout: a bar of 52 px or less, and no floating button (Q-Share+ `utils/hubFrame.ts`, `PHONE_MEDIA`).
4. **Bottom sheets.** MUI's `SwipeableDrawer` forces `keepMounted`. One sheet per list row added 458 of 2,020 DOM nodes on one page, so mount sheets when they're first opened.
5. **Avatars.** MUI's `Avatar` starts loading its `src` on mount, whatever `loading="lazy"` says. In long lists, use an `<img>` that loads only when it scrolls into view (Q-Share+ `NameAvatar`).
6. **Overlaps.** Floating buttons and toasts covered real controls, such as "Submit comment". Keep content clear of the floating button, and put toasts above the bottom bar.

**Navigation**

7. **Deep links.** Write the app name with a literal `+` (see Deep links above).
8. **Back.** Never use `window.history` for Back, because all Hub tabs share it. Use the router's own history (Q-Share+ `useSafeBack`).

**Qortal requests**

9. **Unusual names.** q-apps.js builds some URLs with the raw name, for example `SEARCH_NAMES`, `GET_QDN_RESOURCE_STATUS` and `GET_QDN_RESOURCE_PROPERTIES`.
   - In direct fetches, encode names yourself (`encodeURIComponent`, `URLSearchParams`).
   - Test with names that contain a space, `+`, `/` or non-ASCII letters.
10. **Publish timeouts.** Hub allows up to 30 minutes for a publish, so don't give up after 30 seconds.
    - After a timeout, check QDN for the resource before offering Retry. Otherwise Retry publishes, and charges the fee, twice.
    - Show Hub's `PUBLISH_STATUS` progress per file.
11. **Declines.** Hub words "declined" in 12 languages. Recognise all of them (Q-Share+ `utils/hubErrors.ts`), and treat a decline as a cancel, not a red error.
12. **Account request.** `GET_USER_ACCOUNT` can hang until Hub's 30-second timeout, for example while Hub is locked. Retry once, then show a Sign in button.
13. **Public nodes.** Hub refuses `GET/ADD/DELETE_LIST_ITEMS` on a public node, so follows, blocks and lists-based feeds fail for GO users on the default node. Handle that answer quietly; don't show it as an error.
14. **Resources not on the node.**
    - Not downloaded yet: show "Fetching from peers…" and retry at 2, 4, 8 and 16 seconds. Don't say "check your node".
    - Deleted (a `"D"` body): say so, and drop it from lists.
    - Fails three times: show the search row's title and date with "Not available on your node right now", never a skeleton that never ends.
15. **Trust and caching.** Another name can publish under the same identifier, and a JSON body can claim a different publisher.
    - Key cached bodies by name and identifier.
    - Trust the search row's name and identifier over the body's fields.

**Files and rich text**

16. **PDFs.** An inline `<iframe>` or `<embed>` stays blank: Hub's Electron window has no PDF plugin, and GO's WebView has no PDF viewer. Two fixes:
    - Hub's `SHOW_PDF_READER`, once the file is on the node (Q-Share+).
    - Bundled pdf.js, as Torq does (`src/utils/pdfJsHub.ts` in Torq). Its worker has to run on the main thread, because Hub fails to serve the lazily loaded worker file.
17. **Saves.**
    - Desktop Hub: use `SAVE_FILE` with a blob for files under 100 MB, which saves straight to Downloads in one step.
    - GO, and files over 100 MB: save by `location`. On desktop this adds a native Save As dialog.
    - Declining Hub's save prompt isn't an error.
18. **User-written HTML** (descriptions, comments, mail):
    - Sanitise with DOMPurify 3.4 or newer; older versions have mXSS advisories.
    - Build links on the DOM, never with a regex over sanitised HTML. Upstream Q-Share had a stored XSS hole from exactly that.
    - Drop inline text colours on display: white text pasted from dark pages is invisible in the light themes.
    - Hub's sandbox blocks web links, so copy the URL and say so.

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
