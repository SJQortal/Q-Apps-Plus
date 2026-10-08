/**
 * One message in a list (inbox, archived, sent, alias inbox, search results).
 *
 * - the row body is a real button (tap opens); the checkbox and the delete
 *   button are their own targets next to it, so nothing propagates (UX #5);
 * - unread = a dot plus weight, decided by the read store (Bugs #5);
 * - the date as in the reader (weekday, date, time), its detail on hover or,
 *   on touch screens, on a tap of the date (MailListDate);
 * - the avatar resolves lazily when the row is on screen (avatarCache);
 * - a subject that was never decrypted reads "Locked · open to read", never
 *   the ciphertext (Bugs #18, UX #27);
 * - fluid widths, nothing under 14 px, colours from the theme (UX #12, #14, #26);
 * - in a wide list (nothing open beside it) a row reads as one line of
 *   columns, name | subject | date, instead of two lines stretched across
 *   the whole main area (container query on the list pane, MailShell).
 */
import React, { useCallback, useMemo, useState } from "react";
import { useInView } from "../../hooks/useInView";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlineOutlined";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import AttachFileOutlinedIcon from "@mui/icons-material/AttachFileOutlined";
import {
  Box,
  ButtonBase,
  Checkbox,
  Chip,
  CircularProgress,
  IconButton,
  Tooltip,
  Typography,
} from "@mui/material";
import { useSelector } from "react-redux";
import { RootState } from "../../state/store";
import { AvatarWrapper } from "./MailTable";
import { MailListDate } from "./MailListDate";
import { spokenMailDate } from "./readerTime";
import { useSentRecipient } from "../../utils/sentRecipientCache";
import { selectReadState } from "../../state/features/mailSlice";
import { isMessageRead } from "../../utils/readState";
import { UnreadDot } from "../../layout/states";
import { useDecryptedSubject } from "../../utils/subjectCache";
import { primarySoft } from "../../hub-theme";
import { LIST_CONTAINER } from "../../layout/MailShell";
import { NameText, spokenName } from "../../components/common/NameText";
import { useRowMenu } from "./useRowMenu";
import { messageRowActions } from "./rowMenuActions";
import { isOpenableMessage } from "./messageOpener";

export const LOCKED_SUBJECT_LABEL = "Locked · open to read";
/** The list width from which a row lays out as columns (the list pane is the container). */
export const WIDE_ROW_MIN_WIDTH = 720;
/** The container query of a wide list, where rows read as one line of columns. */
export const WIDE_ROW_QUERY = `@container ${LIST_CONTAINER} (min-width: ${WIDE_ROW_MIN_WIDTH}px)`;
const WIDE = WIDE_ROW_QUERY;
/** Column order in a wide row; the DOM (and the row's label) keep the two-line order. */
const wideOrder = (order: number) => ({ [WIDE]: { order } });
export const NO_SUBJECT_LABEL = "(no subject)";

export interface MailMessageRowProps {
  messageData: any;
  /** Opens the message; may resolve with it once decrypted (the menu's Reply uses that). */
  openMessage: (
    user: string,
    id: string,
    content: any,
    alias?: string
  ) => unknown;
  isOpen?: boolean;
  isFromSent?: boolean;
  onDeleteMessage?: (message: any) => void | boolean | Promise<void | boolean>;
  isDeleting?: boolean;
  /** Inside an expanded sender group: one line, no avatar or name. */
  compact?: boolean;
  /** When given, a checkbox renders as its own tap target. */
  selected?: boolean;
  onToggleSelected?: () => void;
  /** A small label after the subject, e.g. the mailbox a search hit lives in. */
  context?: React.ReactNode;
  /** Terms to highlight in the name and subject. */
  highlightTerms?: string[];
  /** "li" when the row sits directly inside a list (ul); the default "div" expects a wrapping li. */
  component?: "div" | "li";
  /**
   * The row's menu (right click, long press). Reply, Reply all and Forward
   * open the message first when it isn't decrypted yet; the others act on
   * this message alone, as the list's bulk bar does on a selection.
   */
  onReply?: (message: any, options?: { replyAll?: boolean }) => void;
  onForward?: (message: any) => void;
  onMarkAsRead?: (messages: any[]) => unknown;
  onMarkAsUnread?: (messages: any[]) => unknown;
  onArchive?: (messages: any[]) => unknown;
  onUnarchive?: (messages: any[]) => unknown;
}

/** Splits `text` into plain and highlighted runs for the given terms. */
export function highlightRuns(
  text: string,
  terms: string[] | undefined
): Array<{ text: string; hit: boolean }> {
  const cleanTerms = (terms || []).map(t => t.toLowerCase()).filter(Boolean);
  if (!text || !cleanTerms.length) return [{ text, hit: false }];
  const lower = text.toLowerCase();
  const runs: Array<{ text: string; hit: boolean }> = [];
  let index = 0;
  while (index < text.length) {
    let best = -1;
    let bestLength = 0;
    cleanTerms.forEach(term => {
      const at = lower.indexOf(term, index);
      if (at === -1) return;
      if (best === -1 || at < best || (at === best && term.length > bestLength)) {
        best = at;
        bestLength = term.length;
      }
    });
    if (best === -1) {
      runs.push({ text: text.slice(index), hit: false });
      break;
    }
    if (best > index) runs.push({ text: text.slice(index, best), hit: false });
    runs.push({ text: text.slice(best, best + bestLength), hit: true });
    index = best + bestLength;
  }
  return runs;
}

export function Highlight({ text, terms }: { text: string; terms?: string[] }) {
  const runs = useMemo(() => highlightRuns(text, terms), [text, terms]);
  if (runs.length === 1 && !runs[0].hit) return <>{text}</>;
  return (
    <>
      {runs.map((run, i) =>
        run.hit ? (
          <Box
            key={i}
            component="mark"
            sx={theme => ({
              backgroundColor: primarySoft(theme),
              color: "inherit",
              borderRadius: "3px",
              padding: "0 1px",
            })}
          >
            {run.text}
          </Box>
        ) : (
          <React.Fragment key={i}>{run.text}</React.Fragment>
        )
      )}
    </>
  );
}

export const MailMessageRow = ({
  messageData,
  openMessage,
  isOpen = false,
  isFromSent = false,
  onDeleteMessage,
  isDeleting = false,
  compact = false,
  selected = false,
  onToggleSelected,
  context,
  highlightTerms,
  component = "div",
  onReply,
  onForward,
  onMarkAsRead,
  onMarkAsUnread,
  onArchive,
  onUnarchive,
}: MailMessageRowProps) => {
  const username = useSelector((state: RootState) => state.auth?.user?.name);
  const identifier: string = String(messageData?.id || messageData?.identifier || "");
  const data: any = useSelector(
    (state: RootState) => state.mail.hashMapMailMessages[identifier]
  );
  const subjectInHash = useSelector(
    (state: RootState) => state.mail.hashMapSavedSubjects[identifier]
  );
  const readState = useSelector(selectReadState);

  // The read store decides (src/utils/readState.ts); threadV2 is only the
  // compatibility fallback inside isMessageRead, never emptied or injected.
  const isUnread = !isFromSent && !isMessageRead(messageData, readState);
  const isDecrypted = Boolean(data && data?.isValid && !data?.unableToDecrypt);

  // Hub requests for this row wait until it is on screen.
  const [rowNode, setRowNode] = useState<HTMLElement | null>(null);
  const inView = useInView(rowNode);
  const savedSubject = useDecryptedSubject(
    isDecrypted ? undefined : subjectInHash?.subject,
    inView
  );

  let subject: string | null = null;
  let hasAttachments: boolean | null = null;
  if (isDecrypted) {
    subject = typeof data?.subject === "string" ? data.subject : "";
    hasAttachments = (data?.attachments || []).length > 0;
  } else if (savedSubject !== null) {
    subject = savedSubject;
    hasAttachments = Boolean(subjectInHash?.attachments);
  }
  const isLocked = subject === null;

  // Sent rows: the recipient from the decrypted copy when we have it, else
  // one cached lookup per (name prefix, address suffix) group (I4).
  const decryptedRecipient =
    isFromSent && isDecrypted && typeof data?.recipient === "string"
      ? data.recipient.trim()
      : "";
  const sentRecipient = useSentRecipient(isFromSent ? identifier : "", decryptedRecipient, inView);
  const alias = sentRecipient.isAlias ? sentRecipient.name : null;
  const name: string = isFromSent
    ? sentRecipient.name
    : typeof messageData?.user === "string"
      ? messageData.user
      : "";
  const isAliasRecipient = isFromSent && sentRecipient.isAlias;

  const createdAt = messageData?.createdAt;
  const spokenDate = useMemo(() => spokenMailDate(createdAt), [createdAt]);

  const openRow = useCallback((): unknown => {
    if (!identifier) return null;
    return openMessage(
      messageData?.user,
      identifier,
      messageData,
      isFromSent ? alias || name : username
    );
  }, [alias, identifier, isFromSent, messageData, name, openMessage, username]);
  const open = useCallback(() => {
    void openRow();
  }, [openRow]);

  const rowMenu = useRowMenu();
  // Reply and Forward need the decrypted message: open it, then act on it.
  const withOpened = (act: (opened: any) => void) => () => {
    void Promise.resolve(openRow()).then(opened => {
      if (isOpenableMessage(opened)) act(opened);
    });
  };
  const onlyThis = (handler?: (messages: any[]) => unknown) =>
    handler ? () => void handler([messageData]) : undefined;

  const handleDeleteClick = useCallback(
    async (event: React.MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      event.preventDefault();
      if (!isFromSent || !onDeleteMessage || isDeleting) return;
      await onDeleteMessage(messageData);
    },
    [isDeleting, isFromSent, messageData, onDeleteMessage]
  );

  const subjectLabel = isLocked
    ? LOCKED_SUBJECT_LABEL
    : subject || NO_SUBJECT_LABEL;
  const nameLabel = isFromSent ? `To: ${name || "…"}` : name || "Unknown sender";
  const spokenLabel = isFromSent ? `To: ${name ? spokenName(name) : "…"}` : name ? spokenName(name) : "Unknown sender";
  const ariaLabel = `${isUnread ? "Unread. " : ""}${spokenLabel}, ${subjectLabel}${spokenDate ? `, ${spokenDate}` : ""}`;

  const statusIcon = isLocked ? (
    <LockOutlinedIcon
      fontSize="inherit"
      aria-label="Encrypted, not opened yet"
      role="img"
      sx={{ color: "text.secondary", fontSize: 16, flexShrink: 0, ...(compact ? {} : wideOrder(2)) }}
    />
  ) : hasAttachments ? (
    <AttachFileOutlinedIcon
      fontSize="inherit"
      aria-label="Has attachments"
      role="img"
      sx={{ color: "text.secondary", fontSize: 16, flexShrink: 0, ...(compact ? {} : wideOrder(2)) }}
    />
  ) : null;

  // Beside two lines the day sits over the time, so name and subject keep
  // their room on a phone; one line (compact, or a wide row) keeps it inline.
  const dateNode = compact ? (
    <MailListDate timestamp={createdAt} emphasis={isUnread} />
  ) : (
    <MailListDate timestamp={createdAt} emphasis={isUnread} stacked inlineFrom={WIDE} sx={wideOrder(5)} />
  );

  return (
    <>
    <Box
      ref={setRowNode}
      component={component}
      data-message-row={identifier}
      {...rowMenu.triggerFor(undefined)}
      sx={theme => ({
        display: "flex",
        alignItems: "center",
        width: "100%",
        minWidth: 0,
        gap: 0.5,
        listStyle: "none",
        borderBottom: `1px solid ${theme.palette.divider}`,
        backgroundColor: isOpen ? primarySoft(theme) : rowMenu.isOpen ? theme.palette.action.selected : "transparent",
        // A long press opens the row's menu, not iOS's own callout.
        WebkitTouchCallout: "none",
      })}
    >
      {onToggleSelected && (
        <Checkbox
          checked={selected}
          onChange={onToggleSelected}
          slotProps={{ input: { "aria-label": `Select: ${subjectLabel}` } }}
          sx={{ minWidth: 44, minHeight: 44, flexShrink: 0 }}
        />
      )}
      <ButtonBase
        onClick={open}
        aria-label={ariaLabel}
        aria-current={isOpen ? "true" : undefined}
        sx={theme => ({
          flex: 1,
          minWidth: 0,
          minHeight: compact ? 44 : 64,
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-start",
          textAlign: "left",
          gap: 1.5,
          px: onToggleSelected ? 1 : 2,
          py: compact ? 0.5 : 1,
          borderRadius: theme.shape.borderRadius,
          transition: "background-color 150ms ease",
          "&:hover": { backgroundColor: theme.palette.action.hover },
          "&:focus-visible": {
            outline: `2px solid ${theme.palette.primary.main}`,
            outlineOffset: -2,
          },
          "@media (prefers-reduced-motion: reduce)": { transition: "none" },
        })}
      >
        {!compact && (
          <Box sx={{ flexShrink: 0, display: "flex" }}>
            <AvatarWrapper
              isAlias={isAliasRecipient}
              height="40px"
              user={isAliasRecipient ? alias : name}
              fallback={name || "?"}
            />
          </Box>
        )}
        <Box
          sx={theme => ({
            flex: 1,
            minWidth: 0,
            display: "flex",
            alignItems: "center",
            gap: 1,
            ...(compact
              ? {}
              : {
                  [WIDE]: {
                    gap: theme.spacing(1.5),
                    // Both lines' items and the date become this row's columns.
                    "& > [data-row-text], & [data-row-line]": { display: "contents" },
                  },
                }),
          })}
        >
          <Box data-row-text sx={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 0.25 }}>
            <Box data-row-line sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0 }}>
              {isUnread && <UnreadDot />}
              {compact && statusIcon}
              <Typography
                noWrap
                sx={{
                  flex: 1,
                  minWidth: 0,
                  fontSize: "1rem",
                  lineHeight: 1.3,
                  fontWeight: isUnread ? 700 : 500,
                  color: isLocked && compact ? "text.secondary" : "text.primary",
                  fontStyle: compact && (isLocked || !subject) ? "italic" : "normal",
                  ...(compact
                    ? {}
                    : { [WIDE]: { order: 1, flex: "0 0 clamp(160px, 24%, 260px)" } }),
                }}
              >
                {compact ? (
                  <Highlight text={subjectLabel} terms={highlightTerms} />
                ) : name ? (
                  <>
                    {isFromSent && <Highlight text="To: " terms={highlightTerms} />}
                    <NameText name={name}>
                      <Highlight text={name} terms={highlightTerms} />
                    </NameText>
                  </>
                ) : (
                  <Highlight text={nameLabel} terms={highlightTerms} />
                )}
              </Typography>
              {compact && dateNode}
            </Box>
            {!compact && (
              <Box data-row-line sx={{ display: "flex", alignItems: "center", gap: 0.75, minWidth: 0 }}>
                {statusIcon}
                <Typography
                  noWrap
                  sx={{
                    flex: 1,
                    minWidth: 0,
                    fontSize: "0.875rem",
                    lineHeight: 1.35,
                    fontWeight: isUnread ? 600 : 400,
                    color: isUnread && !isLocked ? "text.primary" : "text.secondary",
                    fontStyle: isLocked || !subject ? "italic" : "normal",
                    ...wideOrder(3),
                  }}
                >
                  <Highlight text={subjectLabel} terms={highlightTerms} />
                </Typography>
                {context && (
                  <Chip
                    label={context}
                    size="small"
                    variant="outlined"
                    sx={{ height: 24, fontSize: "0.875rem", flexShrink: 0, ...wideOrder(4) }}
                  />
                )}
              </Box>
            )}
          </Box>
          {!compact && dateNode}
        </Box>
      </ButtonBase>
      {isFromSent && onDeleteMessage && (
        <Tooltip title="Delete sent message">
          <span>
            <IconButton
              onClick={handleDeleteClick}
              disabled={isDeleting}
              aria-label="Delete sent message"
              sx={{ minWidth: 44, minHeight: 44, color: "text.secondary" }}
            >
              {isDeleting ? (
                <CircularProgress size={18} color="inherit" />
              ) : (
                <DeleteOutlineIcon fontSize="small" />
              )}
            </IconButton>
          </span>
        </Tooltip>
      )}
    </Box>
    {rowMenu.renderMenu(() => ({
      title: name ? (
        <>
          {isFromSent && "To: "}
          <NameText name={name} />
        </>
      ) : (
        nameLabel
      ),
      ariaLabel: "Message actions",
      actions: messageRowActions({
        isFromSent,
        isUnread,
        selected,
        open,
        reply: onReply ? replyAll => withOpened(opened => onReply(opened, { replyAll }))() : undefined,
        forward: onForward ? withOpened(onForward) : undefined,
        markRead: onlyThis(onMarkAsRead),
        markUnread: onlyThis(onMarkAsUnread),
        archive: onlyThis(onArchive),
        unarchive: onlyThis(onUnarchive),
        toggleSelected: onToggleSelected,
        remove: isFromSent && onDeleteMessage && !isDeleting ? () => void onDeleteMessage(messageData) : undefined,
      }),
    }))}
    </>
  );
};
