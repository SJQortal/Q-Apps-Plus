# Changelog

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
