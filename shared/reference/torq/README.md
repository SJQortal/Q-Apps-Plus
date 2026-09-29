# Torq

Torq is a Quitter-compatible social Q-App for [Qortal](https://qortal.org). It runs in Qortal Hub and Qortal GO, and it stores posts, follows, likes, and media on QDN. There is no central server and no extra account beyond a Qortal name.

Quitter was missing daily essentials: a reliable mobile composer, real paragraph breaks, playable embeds, polls, GIFs, bookmarks, and a feed that felt at home in Hub 3.0. Torq keeps the same QDN identity as Quitter so existing posts and follows still appear, then adds those pieces on top.

Open it as `qortal://APP/Torq` after you publish the zip from this repo. Source lives on Gitea: [gitea.qortal.link/simon/Torq](https://gitea.qortal.link/simon/Torq). The version in Settings is **1.2.0**.

---

## Quitter compatibility

Torq does **not** start a new social network. It reads and writes the same Quitter resources on QDN.

- App identity stays `quitter` so Hub, GO, and older Quitter clients keep finding the same data.
- Post, reply, repost, follow, and like identifiers stay on the original Quitter scheme.
- A post published in Torq is a Quitter post. A follow in Torq is a Quitter follow.
- Features Quitter cannot render still publish as extra JSON and, where needed, a `qortal://APP/Torq/...` link so the post remains readable there.

If someone is still on original Quitter, they see the text, images, videos, and links. Quitter hides GIFs and attached files, ignores polls, and shows only the first four photos, so posts with any of those also carry a `qortal://APP/Torq/post/...` link that opens the full post in Torq. On Torq that link stays hidden.

Quitter also leaves out any post of 5 MB or more. Torq shrinks photos until the post fits. Where WebP is not available, as on iPhone, it saves them as JPEG.

---

## What Torq adds

### Composer that works on mobile

Quitter’s composer was unreliable on phones: focus glitches, IME issues, and Enter not making a real paragraph. Torq uses a content-editable composer that:

- keeps the software keyboard stable
- inserts a visible paragraph gap when you press Enter
- supports mentions with `@` autocomplete
- lets you paste a Torq/Quitter post link to quote it, or publish a clean repost when the reply is only that link

### Media

- Up to **10 images** per post, rearrangable before publish (drag or arrows). Photos are sized so the post stays under Quitter's 5 MB limit
- Photos saved the way Quitter saves them, including JPEG, load in the feed
- **1 video** per post, including Q-Tube uploads. Video can fill the screen on a phone
- Files and audio play in the post. The raw file address stays hidden. On Quitter the post shows a Torq link
- Fullscreen image viewer: pinch / two-finger touchpad zoom, save, and swipe through a set
- Profile avatars open fullscreen from the user’s page

### Embeds

Paste a supported link into a post and Torq turns it into a card or player. The same post still carries a plain `qortal://` URL for Quitter.

| Link | On Torq | On Quitter |
|------|---------|------------|
| Q-Tube video | Playable player | Video link |
| Subscreen | Playable / playlist preview | Link |
| Subwire article | Opens in Torq, including its video or audio. You can like it or open it in Subwire | Link |
| Q-Chat group | Group invite card | Link |
| Q-App or website, including deep links | Avatar, description, Hub-compatible rating | Link |
| Torq / Quitter post | Quoted post card, or a repost | Link |
| GIFs Q-App embed | Animated GIF | Hidden by Quitter; the post shows a Torq link |

Deep links such as `qortal://APP/Subscreen/title/PLAYLIST/...` still preview the parent app, not a raw URL.

### GIFs

The composer has a GIF button that opens a picker against the community **GIFs** Q-App (`qortal://APP/GIFs/`), the same library used in GO 3.0 chat.

- Search and tag chips are client-side after one catalog fetch
- Masonry grid, most-used row, moderation list
- Selecting a GIF stores a QDN pointer (`IMAGE` + `gif-…`), not a re-upload
- The animation plays in the feed for other Torq users. On Quitter the post shows a Torq link
- Up to 4 GIFs per post; pasting a GIFs embed link also attaches it

### Polls

Create a multi-option poll on a post. Votes are optimistic in the UI and stored on QDN.

- Live percentages and voter avatars
- Hover on desktop, long-press on mobile, for who voted
- On Torq the poll is interactive
- On Quitter the post shows a Torq link instead of a broken poll

### Bookmarks

Save posts to QDN-backed bookmarks, organize them into folders, and open them from the Bookmarks page. Folder marks show on the post menu.

### Profiles, bios, and names

- Profile button uses the **current account avatar**, not a generic person icon
- Name switcher at the top of Settings. On desktop, turn on **Name switcher on Home** to show it in the corner of the left panel instead, with transparent avatars for the chosen name
- Longer names ellipsis in the picker; the menu arrow points up
- Click a profile avatar to view it fullscreen
- Bios keep paragraph breaks
- `qortal://` bio links open in a new tab; `https://` bio links copy so they can be opened in a web2 browser
- Cancelled names render as cancelled instead of looking like a normal account

### Conversations, Discover, and edits

- Reply threads show replies and replies to replies. The reply count includes those nested replies. A reply notification opens on that reply
- Discover lists creators, people, and hashtags, and suggests tags as you type. Hashtag search includes replies
- A link can stay as a card or go back to text, and you can write under the card
- An edited post can show a quiet **Edited** mark next to the date. It stays off until you turn it on in Settings. QDN keeps the latest file, so the old wording is not still there to open. The mark shows that the post was edited, and when. Open it for the published and edited dates and the current message, which you can select and copy
- On a phone, a back button sits over the feed. It hides while you write a reply and the keyboard is open, so it does not cover Post

### Feed, hide, and settings

Settings is a first-class page. Hub 3.0 is the default theme. Quitter, X, and White are there too. The version button at the bottom opens the changelog.

- Hide words and hide users **inside Torq only** — this is not a Qortal-wide block
- Hide a user from that user’s post menu
- View a hidden profile for this visit when you choose to
- Hidden posts do not leave holes in the feed
- Turn trending on or off
- Notification popup and sound toggles
- Blocked users remain available from Settings

When trending is off, Notifications opens a scrollable preview under the right-rail button. **See all** opens the full Notifications page in the main column.

Copying text on a post selects the text. It does not open the post. Opening who liked, who replied, or poll voters also does not navigate away from the card. On mobile those panels drag down to close.

### Layout and Hub 3.0 look

- Hub 3.0 theme by default (Hub chat surfaces and soft blue); Quitter charcoal/Twitter-blue remains in Settings
- Main feed centered between the left and right rails
- Home header hides after you scroll down
- Subtle rotating slogans next to the Torq mark; click a slogan for the Torq manifesto
- Transparent home logo
- Mobile bottom navigation and composer chrome sized for GO / small Hub windows

### Speed on Qortal

Likes, replies, poll votes, and deep-link opens are tuned for Hub and GO: coalesced QDN searches, short session caches, and fewer unlimited searches. The goal is that a phone on GO 3.0 feels as fast as original Quitter, not slower.

---

## What stays from Quitter

These already lived on QDN and still do:

- Public posts, replies, and reposts
- Likes and follows
- User profiles, followers, and following
- Hashtag search and trending
- Private encrypted group posts
- Block list
- Light / dark mode from the host UI
- `qortal://APP/Quitter/post/{name}/{id}` links, which Torq also understands

---

## Requirements

- [Qortal Hub](https://github.com/Qortal/Qortal-Hub) or [GO 3.0](https://gitea.qortal.link/simon/GO-3.0) — Torq is a Q-App, not a standalone website
- A **Qortal name** to publish, follow, like, vote, or bookmark
- Node.js ≥ 18 and npm for local development

---

## Develop and publish

Clone Torq from Gitea. Do not clone Quitter and expect this app.

```bash
git clone https://gitea.qortal.link/simon/Torq.git
cd Torq
npm install
npm run dev
npm test
npm run qortal
```

`npm run qortal` writes `Torq.zip` at the project root, with `index.html` at the zip root. Publish that zip in Hub as the **Torq** app. Do not run `npm run initialize` unless `src/qapp-config.ts` is present — that file holds the shared Quitter salt.

Push updates to the Gitea remote named `gitea`. A remote named `origin` in an older checkout may still be the Quitter repository.

Deep links:

```
qortal://APP/Torq
qortal://APP/Torq/post/{name}/{identifier}
qortal://APP/Torq/user/{name}
```

Quitter post URLs keep working in Torq.

---

## License and lineage

Torq is built from [Quitter](https://github.com/Qortal/Quitter). The social graph on QDN remains the Quitter graph. New Torq-only fields (polls, GIFs, bookmarks, pins, hide lists, theme) are additive so older clients can ignore them.
