# Changelog

## 1.0.1 (Q-Mail+) - October 7, 2026

**Replies stay small** (on advice from Qortal DEV)
- A reply no longer quotes the message you answer. That message shows above the editor for context (Preview, Full or Hide) and is not copied into your reply. The footer now ends a reply, as it ends a new message.
- A reply no longer carries copies of the earlier messages either, only links to the last 10. In 1.0.0, a conversation's 50th reply weighed about 570 KB; now every reply stays under 2 KB, the size of a new message.
- In an open message, "Show earlier" loads the earlier messages from QDN five at a time, with "Show older" for more, all the way back to the start of the conversation: each earlier message leads to the ones before it. Messages you have already opened appear at once. A message that was deleted, wasn't sent to you, or isn't on your node yet says so, and the last can be retried.
- Mail that carries copies of earlier messages (from Q-Mail, or from Q-Mail+ 1.0.0) shows them as before, marked as quoted.
- Q-Mail opens these replies without their earlier messages.

**Replies**
- A reply comes from the name the mail was sent to: mail to one of your other names is answered as that name, not as the active one.

**Faster with many names**
- The first load asks the node once for all your names, and once for all your groups' threads, instead of name by name and group by group: on an account with 88 names and 43 groups, 126 searches instead of 413.

**Group threads**
- Settings → Mail → "Show group threads" hides group threads: the Threads section and the bottom bar's Threads item go away, and nothing about threads is loaded, which makes the first load lighter for anyone in many groups. Your thread drafts are kept for when you turn it on again.

**Dates**
- An open message, and each earlier message under it, shows the weekday, date and time, like "Sun 2 Aug, 08:58", with the year when it isn't this year ("Sun 11 May 2025, 14:03"). A tap or hover still shows the full date with seconds.
- Every message list shows the same date: inbox, archive, sent, alias inboxes, search results, sender groups, threads and drafts. On a phone the day sits above the time, so names keep their room. Hover over a date, or tap it on a phone, to see the full date and how long ago it was.

## 1.0.0 (Q-Mail+) - October 4, 2026

The first release of **Q-Mail+**, Simon's "+" version of Q-Mail 3.2.1. It reads and writes the same QDN resources as Q-Mail (same services, identifiers and encryption), so your mail shows up in both apps, and mail sent from either one opens in the other.

**Look and layout**
- The Hub 3.0 layout: mailboxes, message list and message side by side on desktop; list and message in narrower windows; one pane at a time on phones, with a bottom bar and a floating Compose; a compact layout on a phone held sideways.
- Drag the borders between the mailboxes, the list and the message to set their widths; they are remembered. With no message open, the list uses the whole width.
- Four themes (Hub 3.0, Q-Mail Classic, Black and White) that follow Hub's light/dark switch, and a full Settings page (Account, Appearance, Mail, Sync, About).

**Reading mail**
- Read and unread state that survives a reload and can be published with your mail state; unread counts in the mailboxes, the bottom bar and the window title.
- Archive and Mark unread, from the list or from the open message.
- Search across the inbox, Archived, Sent and alias inboxes, with message bodies on request.
- Messages already on your node open in about half a second, and mail or files that are on your node but not yet assembled open instead of waiting on "Preparing…".
- `qortal://` links open through Hub, so a group join link asks Hub to join the group.
- Names with hidden characters, often used to imitate someone, are crossed out, as in Hub.

**Writing mail**
- Reply with a quote and `Re:`, Reply all, and Forward with `Fwd:` and the original attachments; a Drafts mailbox; Ctrl/Cmd+Enter sends.
- A Cc row: Reply all fills it, and Cc names are visible to every recipient.
- "Send to alias", "Cc" and "Bcc" explain what they do when you hover over them, reach them with the keyboard or long-press them.
- Recipient suggestions with avatars, and every name is checked before sending.
- From shows each of your names with its avatar, and is searchable when you have more than 15 names.
- A mail footer (Settings → Mail): one for all your names or one per name, added to new mail and, if you like, to replies and forwards.
- An alias message can't carry Cc or Bcc names; Q-Mail+ now says so instead of quietly dropping the Bcc copies.

**Attachments**
- Every kind opens in the app: images, text, audio, video and PDF, with size, type, progress from peers and Download all.
- PDFs open in Hub's own PDF reader, as in Q-Share+, with the built-in viewer as a fallback.

**Names, aliases and threads**
- Settings → Account: the active mailbox is a dropdown, with search when you have more than 15 names.
- The alias scan reads at most 500 resources per run and remembers where it stopped.
- Group threads as list and pane, with unread marks, paging and reply-to-post quoting.

**Phones and GO**
- 44 px touch targets, sheets and full-screen dialogs, a header that hides on scroll, Send above the keyboard, and Back that closes the open pane.
- Keyboard shortcuts on screens 600 px and wider, with a `?` help dialog.

**Speed**
- First load for one name takes 6 searches instead of about 25; searches are merged and cached for the session; polling pauses while the tab is hidden and backs off.
- The first download is 395 kB instead of 1,576 kB, with the composer, reader, threads and the PDF viewer loading on demand; Classic's font is 83% smaller.

**Hub, GO and safety**
- Declining a Hub prompt, in any of Hub's 12 languages, quietly cancels; publishing waits as long as Hub does and checks QDN before a retry; deleted and not-yet-available mail shows as such; a screen that fails to load offers Reload instead of a blank app.
- Other people's messages are handled more safely: message HTML is sanitised with DOMPurify 3.4, thread posts are sanitised and show their real publisher as author, links in old mail follow the same rules, and Forward only re-sends real attachments.
- The local-only rating in Settings → About is hidden.

The entries below are Q-Mail's own changelog, kept for reference.

## 3.2.1 - May 28th 2026

- **Fixed:** `/to/:name` links now open the composer automatically instead of landing in the inbox with a prefilled recipient (impact: users following mail-style deep links to start a message).

## 3.2.0 - May 28, 2026

- **Added:** High-contrast top-of-mail loading banner with a prominent spinner and `Fetching mail and state...` text so users can clearly see when the inbox is still loading (how to use: just wait for the banner to clear before assuming QDN state failed).
- **Added:** Checkbox in the initial QDN state prompt to enable `Always fetch and apply QDN state` directly from the load dialog (how to use: check the box before proceeding if you want future loads to skip the prompt).
- **Fixed:** Opening an inbox or alias message now marks it read automatically, so sender groups unbold once every message under them has been read (impact: users reading messages one by one instead of using bulk actions).
- **Fixed:** QDN state prompt no longer flashes or remounts while mail data continues loading in the background (impact: users loading published mailbox state on slower connections).
- **Added:** Inbox `Select all` control for the visible grouped message list (how to use: open Inbox, then use the new top checkbox to select or clear the currently shown messages).
- **Changed:** Published QDN state loading now prompts as soon as the state is discovered in search and continues fetching in the background, so applying it no longer waits for the full download to finish (migration/notes: the prompt still lets you decline loading without changing your mailbox).
- **Added:** `Always fetch and apply QDN state` preference in the right-side menu so Q-Mail can automatically load published state without prompting on this account (how to use: open the user menu, then enable the new checkbox).

## 3.1.2 - May 28, 2026

- **Changed:** Merged PhilReact's upstream interface refresh and clear-notification action into Q-Mail's main branch (migration/notes: no action required).
- **Fixed:** Kept the local state-publish updates intact while incorporating the upstream merge so existing read-state and publish flows continue to work.

## 3.1.1 - April 14, 2026

- **Fixed:** Grouped inbox selection now keeps checked messages selected so the bulk `Mark as Read` action appears and works as expected (impact: users selecting messages inside expanded sender/recipient groups).
- **Fixed:** `Mark as Read` now updates mailbox message state via Redux so marked messages stop rendering as unread/bold in the inbox UI (impact: users marking messages without opening each one).
- **Added:** Sidebar action to publish Q-Mail read-state to QDN, plus a startup prompt to load published state for the authenticated account (how to use: click `Publish Q-Mail State` in the left sidebar, then accept the load prompt on another node).
- **Changed:** Published Q-Mail state now tracks per-message `read` and `subject` independently and merges newly discovered subject/read updates across sessions (migration/notes: sidebar `Publish Q-Mail State` now shows a `!` badge when there are unpublished state changes).
- **Changed:** Pending `Publish Q-Mail State` now uses a high-visibility warning treatment (orange background, orange border/outline, and orange icon) to make unpublished state changes obvious.
- **Fixed:** Grouped sender labels now match read state and no longer stay bold after all messages in a group are marked read (impact: unread emphasis in inbox groups is now consistent with message rows).
- **Added:** Bulk `Mark as Unread` action for selected inbox messages/groups (how to use: select messages with checkboxes, then click `Mark as Unread` in the sticky action bar).

## 3.1.0 - March 24, 2026

- Improved small-screen usability with a clearer mobile menu trigger, a visible/tappable mobile send button, a larger top-level Compose action, and a more responsive sidebar that avoids horizontal scrolling.
- Enabled authenticate-on-startup by default and fixed the onboarding tour so choosing Skip no longer causes it to reopen on later visits.
- Refined sidebar navigation with larger section labels, stronger active-state contrast, a collapsed-by-default `Q-Mail Threads` section, and a dedicated `Alias Compose` action when viewing an alias inbox.
- Fixed alias inbox behavior so alias selection no longer leaks into normal inbox mode, saved aliases always appear under `+Aliases`, linked reply aliases display directly beneath each alias, and replies from alias inboxes inherit the linked reply alias.
- Improved alias workflows with local reply-alias linking, a safer add-alias flow, alias compose requirements for new alias-authored mail, and proper return/discard behavior when leaving alias compose.
- Reworked the reply composer so the original message preview can be toggled between Preview / Full / Hide, the editor fills the available space, replies focus cleanly at the top, and discard support works in inline compose mode.
- Added local per-recipient direct-message drafts, enabled BCC while replying, and fixed the React SVG warning in the send icon component.

## v3.0.0 - March 4, 2026

- Full Q-Mail UI refresh with the new app shell, sidebar navigation, polished light/dark themes, and unified Lexend/Illinois typography with text size controls.
- Inbox, Aliases, Sent, and Threads now open as dedicated pages, with combined views plus quick subviews for each owned name, alias, and active thread group.
- Message lists are now conversation-focused, with grouped entries for repeat contacts, expandable history, wider list usage, and full timestamp display.
- Compose is now a full-page workflow, with improved Reply/Forward behavior that starts replies with quoted context and smoother editor interactions.
- Added local full-text mailbox search across decrypted messages (name, subject, and message content), with progressive results as scanning continues.
- Added alias management tools, including saved alias controls and resumable alias scan progress.
- Added Sent message delete support (replacement publish), plus fixes for send reliability and special-character name handling in mail lookups.
- Added in-menu app ratings support using the `qmails` ratings poll.

## v2.2.0 - September 11, 2025

- Added multi-name account support so switching and using alternate names works more reliably.
- Improved name-related loading behavior in Inbox, Sent, and app startup flows.

## v2.1.0 - January 6, 2025

- Introduced a mobile-friendly layout for core Q-Mail pages.
- Improved usability on smaller screens for reading and composing messages.

## v2.0.1 - February 21, 2024

- Added avatar images in thread posts for clearer conversation context.
- Polished the thread experience after the v2.0.0 refresh.

## v2.0.0 - January 16, 2024

- Major refresh of the mail reading and composing experience.
- Added threaded conversation workflows and expanded reply handling.
- Improved status handling and overall message-view stability.

## v1.2.1 - December 31, 2023

- Reduced unnecessary loading overlays for regular mail views.
- Smoothed everyday navigation in standard inbox workflows.

## v1.2.0 - December 31, 2023

- Added BCC support for sending messages to additional recipients.
- Improved editor behavior and reply-content handling in messages.

## v1.1.0 - December 30, 2023

- Improved attachments and download handling.
- Switched message publishing to a multi-publish flow for better delivery handling.

## v1.0.0 - December 8, 2023

- Initial standalone Q-Mail release.
