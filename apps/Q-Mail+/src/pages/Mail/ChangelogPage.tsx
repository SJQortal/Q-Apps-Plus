import React from "react";
import { Box, Typography } from "@mui/material";

type ChangelogEntry = {
  version: string;
  date: string;
  highlights: string[];
};

const changelogEntries: ChangelogEntry[] = [
  {
    version: "v3.2.1",
    date: "May 28, 2026",
    highlights: [
      "`/to/:name` links now open the composer automatically instead of landing in the inbox with a prefilled recipient.",
    ],
  },
  {
    version: "v3.2.0",
    date: "May 28, 2026",
    highlights: [
      "Added a high-contrast top-of-mail loading banner with a prominent spinner and Fetching mail and state... text so users can clearly see when the inbox is still loading.",
      "Added a checkbox to the initial QDN state prompt so you can turn on Always fetch and apply QDN state without opening the side menu.",
      "Opening an inbox or alias message now marks it read automatically, so sender groups unbold once every message under them has been read.",
      "Fixed the QDN state prompt so it no longer flashes or remounts while mail data keeps loading in the background.",
      "Added an Inbox Select all control for the visible grouped message list.",
      "Changed published QDN state loading so Q-Mail prompts as soon as the state is discovered in search and keeps fetching in the background.",
      "Added an Always fetch and apply QDN state preference in the right-side menu for automatic loading on this account.",
    ],
  },
  {
    version: "v3.1.1",
    date: "April 14, 2026",
    highlights: [
      "Fixed grouped inbox selection so bulk Mark as Read appears reliably when messages are selected.",
      "Fixed read-state rendering so marked messages (including ACCESS TO DECRYPT rows) no longer stay bold as unread.",
      "Added publish/load Q-Mail state support using DOCUMENT_PRIVATE, with merged per-message read and subject state across sessions.",
      "Added a high-visibility warning style for pending Publish Q-Mail State changes and a new bulk Mark as Unread action.",
      "Updated grouped sender labels so group headers only appear bold when the group still has unread messages.",
    ],
  },
  {
    version: "v3.1.0",
    date: "March 24, 2026",
    highlights: [
      "Improved small-screen usability with a clearer mobile menu trigger, a visible and tappable mobile send button, a larger top-level Compose action, and a more responsive sidebar that avoids horizontal scrolling.",
      "Enabled authenticate-on-startup by default and fixed the onboarding tour so choosing Skip no longer causes it to reopen on later visits.",
      "Refined sidebar navigation with larger section labels, stronger active-state contrast, a collapsed-by-default Q-Mail Threads section, and a dedicated Alias Compose action when viewing an alias inbox.",
      "Fixed alias inbox behavior so alias selection no longer leaks into normal inbox mode, saved aliases always appear under +Aliases, linked reply aliases display directly beneath each alias, and replies from alias inboxes inherit the linked reply alias.",
      "Improved alias workflows with local reply-alias linking, a safer add-alias flow, alias compose requirements for new alias-authored mail, and proper return/discard behavior when leaving alias compose.",
      "Reworked the reply composer so the original message preview can be toggled between Preview, Full, and Hide, the editor fills the available space, replies focus cleanly at the top, and discard support works in inline compose mode.",
      "Added local per-recipient direct-message drafts, enabled BCC while replying, and fixed the React SVG warning in the send icon component.",
    ],
  },
  {
    version: "v3.0.0",
    date: "March 4, 2026",
    highlights: [
      "Full Q-Mail UI refresh with the new app shell, sidebar navigation, polished light/dark themes, and unified Lexend/Illinois typography with text size controls.",
      "Inbox, Aliases, Sent, and Threads now open as dedicated pages, with combined views plus quick subviews for each owned name, alias, and active thread group.",
      "Message lists are now conversation-focused, with grouped entries for repeat contacts, expandable history, wider list usage, and full timestamp display.",
      "Compose is now a full-page workflow, with improved Reply/Forward behavior that starts replies with quoted context and smoother editor interactions.",
      "Added local full-text mailbox search across decrypted messages (name, subject, and message content), with progressive results as scanning continues.",
      "Added alias management tools, including saved alias controls and resumable alias scan progress.",
      "Added Sent message delete support (replacement publish), plus fixes for send reliability and special-character name handling in mail lookups.",
      "Added in-menu app ratings support using the qmails ratings poll.",
    ],
  },
  {
    version: "v2.2.0",
    date: "September 11, 2025",
    highlights: [
      "Added multi-name account support so switching and using alternate names works more reliably.",
      "Improved name-related loading behavior in Inbox, Sent, and app startup flows.",
    ],
  },
  {
    version: "v2.1.0",
    date: "January 6, 2025",
    highlights: [
      "Introduced a mobile-friendly layout for core Q-Mail pages.",
      "Improved usability on smaller screens for reading and composing messages.",
    ],
  },
  {
    version: "v2.0.1",
    date: "February 21, 2024",
    highlights: [
      "Added avatar images in thread posts for clearer conversation context.",
      "Polished the thread experience after the v2.0.0 refresh.",
    ],
  },
  {
    version: "v2.0.0",
    date: "January 16, 2024",
    highlights: [
      "Major refresh of the mail reading and composing experience.",
      "Added threaded conversation workflows and expanded reply handling.",
      "Improved status handling and overall message-view stability.",
    ],
  },
  {
    version: "v1.2.1",
    date: "December 31, 2023",
    highlights: [
      "Reduced unnecessary loading overlays for regular mail views.",
      "Smoothed everyday navigation in standard inbox workflows.",
    ],
  },
  {
    version: "v1.2.0",
    date: "December 31, 2023",
    highlights: [
      "Added BCC support for sending messages to additional recipients.",
      "Improved editor behavior and reply-content handling in messages.",
    ],
  },
  {
    version: "v1.1.0",
    date: "December 30, 2023",
    highlights: [
      "Improved attachments and download handling.",
      "Switched message publishing to a multi-publish flow for better delivery handling.",
    ],
  },
  {
    version: "v1.0.0",
    date: "December 8, 2023",
    highlights: ["Initial standalone Q-Mail release."],
  },
];

export const ChangelogPage = () => {
  return (
    <Box
      sx={{
        width: "100%",
        maxWidth: "1100px",
        padding: "20px 24px 28px",
        display: "flex",
        flexDirection: "column",
        gap: "16px",
      }}
    >
      <Typography
        sx={{
          fontSize: "1.5rem",
          fontWeight: 700,
          color: "var(--qmail-thread-text)",
        }}
      >
        Changelog
      </Typography>
      {changelogEntries.map(entry => (
        <Box
          key={entry.version}
          sx={{
            border: "1px solid var(--qmail-shell-border)",
            borderRadius: "10px",
            backgroundColor: "var(--qmail-shell-active)",
            padding: "14px 16px",
            display: "flex",
            flexDirection: "column",
            gap: "6px",
          }}
        >
          <Typography
            sx={{
              fontSize: "1rem",
              fontWeight: 700,
            }}
          >
            {entry.version}
          </Typography>
          <Typography
            sx={{
              fontSize: "0.875rem",
              color: "var(--qmail-message-meta)",
            }}
          >
            {entry.date}
          </Typography>
          <Box
            component="ul"
            sx={{
              margin: 0,
              paddingLeft: "18px",
              display: "flex",
              flexDirection: "column",
              gap: "4px",
            }}
          >
            {entry.highlights.map(highlight => (
              <Typography
                key={highlight}
                component="li"
                sx={{
                  fontSize: "0.95rem",
                  fontWeight: 400,
                }}
              >
                {highlight}
              </Typography>
            ))}
          </Box>
        </Box>
      ))}
    </Box>
  );
};
