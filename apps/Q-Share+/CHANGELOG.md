# Changelog

Newest first. The in-app copy lives in `src/constants/changelog.ts` (Settings → About → What's new).

## 1.0.1 (not published yet)

Changes since the published 1.0.0:

- **Notifications:** a bell in the header (on phones too) lists comments on your shares, replies to your comments, your shares added to someone's collection and your collections copied, with the commenter, the share, the comment's opening words and the time. A comment opens its share scrolled to the comments. Comments written in the original Q-Share count too. Q-Share+ checks while it is open: 4 s after start, every 2 minutes, backing off to 15 while nothing happens, paused while out of sight (another Hub tab, minimised), and at once when you come back or open the list. Each check is usually a comment search, a collection search and a look at the node's last block, so comments a syncing or offline node indexes late are still found. Settings → Notifications switches each kind on and off.
- **Alerts from Qortal Hub while Q-Share+ is closed** (Settings → Notifications, off by default): Hub's own notifications (`NOTIFICATION_*`) for new comments on your 30 newest shares and replies to your 20 newest comments, after Hub's permission banner. Collection adds can't raise Hub alerts (Hub only matches brand-new resources, and adding to a collection re-publishes it), so they wait for the bell.
- Collections name the owners of their newest shares in their QDN description (`~qsn-<last 12 characters of the address>~`, newly added first, at most four), so the owner's Q-Share+ finds them with one search. Additive metadata only; the app never shows it.
- Links opened from Hub while Q-Share+ is already open go to the right page from any screen (they used to resolve relative to the current page).
- Share pages: audio and video files say **Play audio** / **Play video** (with a play icon) and **Close player** once open, instead of "Preview"; the player's error message and fallback name say so too. Images and text keep "Preview".
- File types found in real shares: subtitles (.srt, .vtt) and checksum files (.md5, .sha*) preview as text, audiobooks (.m4b) and WebM audio (.weba) play, and comic books (.cbz, .cbr) are listed as documents.
- Editor: the description placeholder no longer sits on top of the first word while a phone keyboard (or a desktop IME) is still composing it.
- Theme: in a dark Hub, a refresh on any page but the first showed the light colours (in-app navigation drops `?theme=`, and Core then injects `_qdnTheme = "light"`). The theme kit now remembers Hub's mode, and `index.html`'s boot snippet reads it in the same order.
- **Up to 300 files in a share** (the original takes 10). Qortal Core accepts at most 25 unconfirmed transactions per account and each file is one, so a share of more than 20 files goes to Hub in batches of 20, the share details with the last batch, each batch sent once the network has confirmed enough of the one before (`/transactions/unconfirmed?creator=`). The dialog says first what it takes (publishes, batches, fees from `/transactions/unitfee`), can ask Hub to approve every batch at once for the session (`SESSION_PERMISSIONS`), shows the wait between batches with Pause, goes on past files Hub couldn't publish but publishes the share details only once every file is on QDN, stops when a batch publishes nothing, offers Continue only once Hub has answered for the batch it is on, and Continue sends the rest. The Share and Update forms say how many publishes and how much in fees a share takes. Publishes of up to 10 files work exactly as before.
- **Nothing is paid twice after a stop:** when a publish stops before the share details land, the files that did reach QDN stay in the draft as "already on QDN", and publishing again sends only the rest.
- **Share pages with many files** list them 50 at a time, and Fetch all files keeps six downloads going at once instead of starting them all (files waiting on peers count as going). Long file lists re-render only the rows that change.
- **Folders in collections:** folders, and folders inside folders (five deep), each with its own page, shares and cover; New folder, Edit, Delete, and Move a share between the collection and its folders. Add to collection lists every collection with its folders, so a share can go straight into one. Stored in the collection's own JSON (`folders`), so one fetch serves every folder and every change is one publish.
- **Covers for collections and folders:** choose an image, change or remove it. It is cut to a 600 px square on the device and published as a THUMBNAIL `qshare_cover_<uid>` in the same Hub request as the collection; if Hub publishes the collection but not the image, the save counts and a note asks to choose it again. Covers show on collection cards, collection and folder pages, and folder tiles.
- **Playlists:** a share with two or more audio files gets a Playlist card (Play all, Shuffle) and Play on each track, and plays in a player bar at the foot of the app that keeps going while you browse: previous, play/pause, next, shuffle, repeat, a seek bar, the track list, and lock-screen and media keys. Each track is fetched onto the node before it plays and the next one while the current one plays; a track that can't be had is skipped, and so is one whose fetch hasn't moved for a minute (Previous goes back to it). The player's code loads with the first playlist.
- **Sort by name** in the Share and Update forms, numbers in order, so a numbered album plays in order.
- Collection counts say shares and folders.
- **Collections as a grid:** collection and folder pages show their shares as cards by default, with a List/Grid switch of their own (Settings → Appearance → Collections layout); Home and profiles keep their layout. Card pictures are 16:10.
- **Share thumbnails:** the Share and Update forms make one on the device from the first image (or a frame of the first video), fitted within 640 px and at most 200 KB, with Choose image, Use another of the share's images, and Remove. It is published as a THUMBNAIL `qshare_thumb_<slug>_<uid>` in the same Hub request as the share details, which name it in an extra `thumbnail` field; a stopped publish keeps it if it landed. Cards and rows show it; a card for a share without one shows its first image of up to 2 MB, once the node already has it (one status check per image per session). Thumbnails, card images and covers are asked for with `async=true`, so one the node lacks never holds it (about 15 s per image before), and are asked for again after 4 and 15 s. Photos past 50 MP are refused rather than decoded on a phone, and smaller ones are decoded straight at thumbnail size. Publish can't be sent twice while the thumbnail is made, a stopped publish keeps the thumbnail it sent, the thumbnail rides with the share details (so it never adds a batch), and a share that lands without its thumbnail says so.
- **Copy a collection into yours:** Copy to my collections on anyone else's collection publishes a copy under your name (title and description to change; the shares, folders and cover references come along) with `copiedFrom` naming the original. The copy says "Copy of “…” by …", collection cards say "copied from …", and the original's owner gets a notification in Q-Share+ ("… copied your collection …"). Open your copy once you have one (Copy waits until your collections are known); a deleted copy doesn't count.
- **Explore collections:** a button under the filters on Home (in the Filters sheet on phones) opens a window of other people's collections, newest first, with a search bar of its own at the top (title, description or name; one paged search per query, as typing pauses or on Enter). Your own collections, hidden names and deleted ones are left out; opening a collection or its publisher closes the window. Full-screen on phones; its code loads with the first opening.
- Card images only ever read FILE resources, and status URLs refuse anything that isn't a Core service name (a crafted share could otherwise point a viewer's browser at another path on their node).
- 668 tests; lint clean.

## 1.0.0 (2026-09-30)

Published on QDN as `Q-Share+` on 2026-09-30, built from commit `2bc12cc`.


The first release of Q-Share+. It reads and writes the same QDN data as Q-Share: your shares, files and comments show up in both, and anything published here still works in the original. Collections and synced settings are new, additive data that Q-Share ignores.

**Platform and quality**
- React 19.3, MUI 9.4, Redux Toolkit 2, react-router 6.30 (v7 flags), Vite 8, TypeScript 5.9.
- The editor runs on Quill 2 (react-quill-new); published descriptions are normalised to the Quill 1 markup the original stores, and old descriptions render with the app's own styles. Text and highlight colours are gone from the toolbar (they vanished in other themes) and pasted colours are dropped.
- ESLint 9 with the React hooks rules (clean), 487 vitest tests, an error boundary, and a screenshot harness (`e2e/screens.mjs`) that checks every screen at five sizes in four themes with an axe-core accessibility audit.
- Removed: moment, react-quill, the unreachable Q-Tube player and playlist code, react-rnd, compressorjs and ts-key-enum.

**Looks and phones**
- Four themes from the shared kit: Hub 3.0 (default), Q-Share Classic, Black and White, with a no-flash boot snippet; Hub's light/dark switch applies without a reload. Text contrast is at least 4.5:1 in every theme.
- Phones and GO: a bottom bar (Home, Collections, Downloads, Settings) and a Share button, a header that hides on scroll, Back bars on sub-pages, filters and sort in a bottom sheet, pull-to-refresh, full-screen Share and Edit forms with Publish above the keyboard, 44 px targets, safe-area insets, and a compact bar with Share in it on a phone held sideways.
- List or grid view on Home, profiles and collections (Settings → Appearance or the switch above each list).

**Finding shares**
- Home: a filters rail (a Filters sheet on phones), newest/oldest sort, My shares (for one or all of your names), a Following feed, hidden names, and clear loading, empty and error states. Titles show at once; shares that aren't reachable say so, deleted ones are left out, and paging continues past hidden names.
- The publisher filter suggests names as you type, with avatars.
- Every search field has a ✕ that clears it while it has text (title search, publisher filter, name switcher).
- Profile pages with Shares and Collections tabs.

**Share pages and downloads**
- Previews: images with a lightbox, text, audio and video once the file is on the node, PDFs in Hub's own reader. Fetch all files, big Download buttons, Save all as .zip (up to 150 MB), Edit share for the owner, Copy link, Add to collection.
- Descriptions are sanitised on the DOM: no script, styles, forms or relative links; `qortal://` links work (DOMPurify 3.4).
- Downloads: a list with progress, Save on every ready file, and Clear finished; polling stops when a file is ready or the tab is hidden; GO and files over 100 MB stream from the node; declines in Hub are not errors.
- Copied links use `qortal://APP/Q-Share+/…`, which Hub opens (the router also accepts the `%2B` spelling).

**Publishing**
- Drag and drop or tap to choose, type icons, sizes and a running total, remove before publishing, a draft that survives closing the dialog.
- Per-file progress from Hub, a wait as long as Hub's, a QDN check before any retry so nothing is paid twice, retry of failed files only, and declines recognised in every Hub language.

**Collections** (new data: `qshare_collection_` DOCUMENTs)
- Save any share to a named collection; a Collections page (Mine / All), a page per collection with edit, remove and delete.

**Settings**
- Account with a name switcher that searches when you have more than 15 names (accents and capitals optional, keyboard support, avatars); appearance; content (image previews, Following feed, default sort, hidden names); blocked names; network statistics on demand; Sync (save and restore your settings and theme on QDN); About with this changelog.

**Qortal efficiency**
- Every search goes through one helper: pages of 20, in-flight merge, a 2-minute cache, never `limit=0`. Home's first load is one paged search plus the bodies of what shows; a share opens with one search and one fetch, or none when cached; comment threads take two searches; avatars load lazily by URL.
- Biggest JS chunk 1,123 kB → 265 kB; routes, the editor and secondary screens load on demand.
