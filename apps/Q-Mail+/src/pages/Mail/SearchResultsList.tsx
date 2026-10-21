/**
 * The "All mail" result list: one flat list of hits across the inbox, the
 * archive, sent mail and alias inboxes, each row labelled with its mailbox.
 * Opening a hit hands the row (with its mailbox tag) back to Mail.tsx, which
 * switches to that mailbox and opens the message there.
 */
import SearchOffOutlinedIcon from "@mui/icons-material/SearchOffOutlined";
import { Box, Typography } from "@mui/material";
import { EmptyState, ListSkeleton } from "../../layout/states";
import { MailMessageRow } from "./MailMessageRow";
import { mailboxLabel, mailboxRefOf, toMessageId, type MailboxRef } from "./mailSearch";
import type { ListStatus } from "./GroupedMailboxList";
import { NameText } from "../../components/common/NameText";

/** mailboxLabel on screen, the owned name or alias drawn by NameText. */
function MailboxLabel({ mailbox }: { mailbox: MailboxRef | undefined }) {
  const label = mailboxLabel(mailbox);
  const name = mailbox?.kind === "alias" ? mailbox.alias : mailbox?.kind === "archived" ? "" : mailbox?.name;
  if (!name || !label.endsWith(name)) return <>{label}</>;
  return (
    <>
      {label.slice(0, label.length - name.length)}
      <NameText name={name} />
    </>
  );
}

interface SearchResultsListProps {
  hits: any[];
  terms: string[];
  status: ListStatus;
  openedMessageId?: string | number | null;
  onOpen: (hit: any) => void;
}

export const SearchResultsList = ({ hits, terms, status, openedMessageId, onOpen }: SearchResultsListProps) => {
  if (!hits.length) {
    if (status === "loading") return <ListSkeleton rows={5} />;
    return (
      <EmptyState
        icon={<SearchOffOutlinedIcon />}
        title="No matches across your mail"
        hint="Try fewer words, or search message bodies for the mail that has not been opened yet."
      />
    );
  }

  return (
    <Box sx={{ width: "100%", display: "flex", flexDirection: "column", minWidth: 0 }}>
      <Typography
        sx={{ px: 2, py: 1, fontSize: "0.875rem", color: "text.secondary" }}
        aria-live="polite"
      >
        {hits.length} {hits.length === 1 ? "result" : "results"} across your mail
      </Typography>
      <Box component="ul" aria-label="Search results" sx={{ listStyle: "none", m: 0, p: 0, width: "100%", minWidth: 0 }}>
      {hits.map(hit => {
        const ref = mailboxRefOf(hit);
        const id = toMessageId(hit);
        return (
          <MailMessageRow
            key={`${ref?.kind || "inbox"}:${ref?.alias || ref?.name || ""}:${id}`}
            component="li"
            messageData={hit}
            openMessage={() => onOpen(hit)}
            isFromSent={ref?.kind === "sent"}
            context={ref ? <MailboxLabel mailbox={ref} /> : undefined}
            highlightTerms={terms}
            isOpen={
              openedMessageId !== null &&
              openedMessageId !== undefined &&
              String(openedMessageId) === id
            }
          />
        );
      })}
      </Box>
    </Box>
  );
};
