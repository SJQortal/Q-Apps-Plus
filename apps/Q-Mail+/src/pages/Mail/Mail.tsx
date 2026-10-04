import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../../state/store";


import {
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  Typography,
} from "@mui/material";
import { useFetchMail } from "../../hooks/useFetchMail";
import { clearMessages } from "../../state/features/mailSlice";
import { setUserAvatarHash } from "../../state/features/globalSlice";
import { setNotification } from "../../state/features/notificationsSlice";

import { useModal } from "../../components/common/useModal";
import useConfirmationModal from "../../hooks/useConfirmModal";
import { OpenMail } from "./OpenMail";
import { MAIL_SERVICE_TYPE, THREAD_SERVICE_TYPE } from "../../constants/mail";
import { executeEvent } from "../../utils/events";
import { GroupedMailboxList } from "./GroupedMailboxList";
import { MailboxSearchBar } from "./MailboxSearchBar";
import { useMailboxSearch } from "./useMailboxSearch";
import {
  base64ToUint8Array,
  objectToBase64,
  uint8ArrayToObject,
} from "../../utils/toBase64";
import {
  readAutoApplyQdnState,
  writeAutoApplyQdnState,
} from "../../utils/qdnStatePreference";
import { formatFullTimestamp } from "../../utils/time";
import type { LeftSidebarItem } from "@qortal/qapp-lib/left-sidebar/core";
import { MailShell, PaneScroll } from "../../layout/MailShell";
import { Rail } from "../../layout/Rail";
import { BottomNav } from "../../layout/BottomNav";
import { ComposeFab } from "../../layout/ComposeFab";
import { useLandscapeFrame } from "../../utils/hubFrame";
import { PaneHeader } from "../../layout/PaneHeader";
import { EmptyState, LoadingBanner } from "../../layout/states";
import { useLayoutMode } from "../../layout/useLayoutMode";
import { useAppViewport } from "../../layout/useAppViewport";
import { SETTINGS_PATH } from "../Settings/settingsPath";
import packageJson from "../../../package.json";
import InboxOutlinedIcon from "@mui/icons-material/InboxOutlined";
import SendOutlinedIcon from "@mui/icons-material/SendOutlined";
import ForumOutlinedIcon from "@mui/icons-material/ForumOutlined";
import AlternateEmailOutlinedIcon from "@mui/icons-material/AlternateEmailOutlined";
import MenuIcon from "@mui/icons-material/Menu";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import MailOutlineIcon from "@mui/icons-material/MailOutlined";
import { IconButton } from "@mui/material";
import {
  applyPublishedArchived,
  applyPublishedReadState,
  archiveIds,
  markRead,
  markUnread,
  unarchiveIds,
} from "../../state/features/mailSlice";
import {
  haveSameArchivedIds,
  isArchivedId,
  type ArchivedMap,
} from "../../utils/archiveState";
import {
  MAIL_STATE_DOCUMENT_IDENTIFIER,
  MAIL_STATE_DOCUMENT_SERVICE,
  mergeAliasReplyLinks,
  mergeWatchedAliases,
  buildPublishedMailStateDocument,
  isLocalEntryPublished,
  mergePublishedStateEntries,
  mergeRemoteStateIntoPublishBase,
  parsePublishedMailStateDocument,
  type ParsedPublishedState,
  type QMailPublishedStateEntry,
} from "../../utils/mailStateDocument";
import { readPublishedMailStateFromQdn } from "../../utils/publishedMailStateRemote";
import { usePolling } from "../../hooks/usePolling";
import { invalidateSearches, searchResources } from "../../utils/qdnSearch";
import {
  fetchGroupAvatarUrl,
  fetchInboxMessagesForOwnedName,
  fetchRecentInboxMessagesForOwnedName,
  fetchRecentInboxMessagesForSavedAlias,
  hasGroupThreadActivity,
  hasInboxMailActivityForOwnedName,
  hasSentMailActivityForOwnedName,
  mergeNewRows,
  withoutDeletedRows,
} from "../../utils/mailInbox";
import {
  useAppShell,
  type PublishedAppearance,
} from "../../app-shell/AppShellContext";
import { useHubTheme } from "../../hub-theme";
import { countUnreadMessages, hasThreadHistory } from "../../utils/readState";
import type { StoredComposeDraft } from "./composeDrafts";
import { invalidateThreadSearches } from "./threadData";
import { useThreadUnreadCounts } from "./threadUnread";
import { openerInfoFor } from "./openerInfo";
import { getAvatarUrl } from "../../utils/avatarCache";
import ArchiveOutlinedIcon from "@mui/icons-material/ArchiveOutlined";
import {
  sentIndexKey,
  aliasIndexKey,
  getMailIndex,
  useMailIndex,
  useMailIndexVersion,
} from "./mailIndexStore";
import { ensureAliasIndex, ensureSentIndex } from "./mailIndexes";
import { SearchResultsList } from "./SearchResultsList";
import {
  BODY_SEARCH_STEP,
  idleSearchStatus,
  type MailboxSearchStatus,
} from "./useMailboxSearch";
import {
  mailboxRefOf,
  tagForMailbox,
  type MailSearchScope,
  type MailboxRef,
} from "./mailSearch";
import { getSentRecipientDisplayLabel } from "./mailIdentifier";
import { lazyNamed, preloadOnIdle } from "../../components/common/lazyNamed";
import { ListSkeleton } from "../../layout/states";
import { TOUR_STATUS_DISMISSED, TOUR_STATUS_STORAGE_KEY } from "./MailTour";
import { useKeyboardShortcuts } from "../../hooks/useKeyboardShortcuts";
import { usePhoneBackClose } from "../../layout/usePhoneBackClose";
import { errorMessage, isHubDecline } from "../../utils/hubErrors";
import {
  ALIAS_SCAN_MAX_PAGES,
  ALIAS_SCAN_SEARCH_TTL_MS,
  aliasScanSearchParams,
  readAliasScanCheckpointFromStorage,
  readAliasScanSeenFromStorage,
  runAliasScanPass,
  writeAliasScanCheckpointToStorage,
  writeAliasScanSeenToStorage,
  type AliasScanCheckpoint,
} from "./aliasScan";

// Lazy boundaries (docs/apps/Q-Mail+.md → Bundle §5): the composer (Quill,
// react-dropzone), the reader (dompurify), threads, aliases, sent, drafts and
// the tour each load on first use. The composer and reader chunks are warmed
// on idle after first paint (see the effect in Mail), so Compose and opening
// a message still feel instant.
const loadNewMessage = () => import("./NewMessage");
const loadShowMessageV2 = () => import("./ShowMessageV2");
const NewMessage = lazyNamed(loadNewMessage, "NewMessage");
const ShowMessageV2 = lazyNamed(loadShowMessageV2, "ShowMessageV2");
const SentMail = lazyNamed(() => import("./SentMail"), "SentMail");
const AliasMail = lazyNamed(() => import("./AliasMail"), "AliasMail");
const AliasesPage = lazyNamed(() => import("./AliasesPage"), "AliasesPage");
const ThreadsMailbox = lazyNamed(() => import("./ThreadsMailbox"), "ThreadsMailbox");
const Thread = lazyNamed(() => import("./Thread"), "Thread");
const DraftsMailbox = lazyNamed(() => import("./DraftsMailbox"), "DraftsMailbox");
const MailTour = lazyNamed(() => import("./MailTour"), "MailTour");
const ShortcutsHelpDialog = lazyNamed(
  () => import("../../components/common/ShortcutsHelpDialog"),
  "ShortcutsHelpDialog"
);

type MailboxSidebarItemId =
  | "inbox"
  | "archived"
  | "aliases"
  | "sent"
  | "drafts"
  | "threads"
  | "compose"
  | "alias-compose";
type ComposeReturnView = "inbox" | "threads";
type SelectedAliasScope = "inbox" | "aliases" | "sent" | null;
type ComposeMode = "standard" | "alias";

const INBOX_INSTANCE_ITEM_PREFIX = "inbox-instance:";
const ALIASES_INSTANCE_ITEM_PREFIX = "aliases-instance:";
const SENT_INSTANCE_ITEM_PREFIX = "sent-instance:";
const THREAD_GROUP_ITEM_PREFIX = "threads-group:";
const ALIAS_COMPOSE_ITEM_ID = "alias-compose";
const PUBLISH_STATE_ITEM_ID = "publish-mail-state";
const ARCHIVED_ITEM_ID = "archived";

const encodeSidebarInstanceName = (name: string): string => {
  return encodeURIComponent(name);
};

const decodeSidebarInstanceName = (value: string): string => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const createInboxInstanceItemId = (name: string): string => {
  return `${INBOX_INSTANCE_ITEM_PREFIX}${encodeSidebarInstanceName(name)}`;
};

const createSentInstanceItemId = (name: string): string => {
  return `${SENT_INSTANCE_ITEM_PREFIX}${encodeSidebarInstanceName(name)}`;
};

const createAliasesInstanceItemId = (name: string): string => {
  return `${ALIASES_INSTANCE_ITEM_PREFIX}${encodeSidebarInstanceName(name)}`;
};

const createThreadGroupItemId = (groupId: string | number): string => {
  return `${THREAD_GROUP_ITEM_PREFIX}${encodeSidebarInstanceName(
    String(groupId)
  )}`;
};

const parseSidebarInstanceNameFromItemId = (
  itemId: string,
  prefix: string
): string | null => {
  if (!itemId.startsWith(prefix)) return null;
  const encodedName = itemId.slice(prefix.length);
  if (!encodedName) return null;
  const decoded = decodeSidebarInstanceName(encodedName).trim();
  return decoded || null;
};

const parseSidebarGroupIdFromItemId = (itemId: string): string | null => {
  return parseSidebarInstanceNameFromItemId(itemId, THREAD_GROUP_ITEM_PREFIX);
};

const getWatchedAliasStorageKey = (address: string): string => {
  return `qmail_watched_aliases_${address}`;
};

const readWatchedAliasesFromStorage = (address: string): string[] => {
  try {
    const raw = localStorage.getItem(getWatchedAliasStorageKey(address));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const deduped = new Map<string, string>();
    parsed.forEach(value => {
      const alias = typeof value === "string" ? value.trim() : "";
      if (!alias) return;
      const normalizedAlias = alias.toLowerCase();
      if (deduped.has(normalizedAlias)) return;
      deduped.set(normalizedAlias, alias);
    });
    return Array.from(deduped.values());
  } catch {
    return [];
  }
};

const writeWatchedAliasesToStorage = (
  address: string,
  aliases: string[]
): void => {
  try {
    localStorage.setItem(
      getWatchedAliasStorageKey(address),
      JSON.stringify(aliases)
    );
  } catch {
    // Ignore storage failures.
  }
};

const getAliasReplyLinksStorageKey = (address: string): string => {
  return `qmail_alias_reply_links_${address}`;
};

const readAliasReplyLinksFromStorage = (
  address: string
): Record<string, string> => {
  try {
    const raw = localStorage.getItem(getAliasReplyLinksStorageKey(address));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    const normalizedLinks: Record<string, string> = {};
    Object.entries(parsed).forEach(([aliasName, replyAlias]) => {
      const normalizedAliasName =
        typeof aliasName === "string" ? aliasName.trim().toLowerCase() : "";
      const normalizedReplyAlias =
        typeof replyAlias === "string" ? replyAlias.trim() : "";
      if (!normalizedAliasName || !normalizedReplyAlias) return;
      normalizedLinks[normalizedAliasName] = normalizedReplyAlias;
    });
    return normalizedLinks;
  } catch {
    return {};
  }
};

const writeAliasReplyLinksToStorage = (
  address: string,
  replyLinks: Record<string, string>
): void => {
  try {
    localStorage.setItem(
      getAliasReplyLinksStorageKey(address),
      JSON.stringify(replyLinks)
    );
  } catch {
    // Ignore storage failures.
  }
};

const sortOwnedNamesForDisplay = (
  names: string[],
  primaryName?: string | null
): string[] => {
  const normalizedPrimary = (primaryName || "").trim().toLowerCase();
  return [...names].sort((a, b) => {
    const aNormalized = a.toLowerCase();
    const bNormalized = b.toLowerCase();
    if (
      aNormalized === normalizedPrimary &&
      bNormalized !== normalizedPrimary
    ) {
      return -1;
    }
    if (
      bNormalized === normalizedPrimary &&
      aNormalized !== normalizedPrimary
    ) {
      return 1;
    }
    return a.localeCompare(b, undefined, { sensitivity: "base" });
  });
};

/** Unread numbers for badges and the page title (archived mail is excluded). */
export interface UnreadCounts {
  /** The combined inbox: every owned name. */
  inbox: number;
  /** Per owned name (keys as in `inboxNames`). */
  byName: Record<string, number>;
  /** Per watched alias, counted over the latest 20 messages the alias probe returns. */
  byAlias: Record<string, number>;
  /** Sum over watched aliases. */
  aliases: number;
  /** inbox + aliases. */
  total: number;
}

const EMPTY_UNREAD_COUNTS: UnreadCounts = {
  inbox: 0,
  byName: {},
  byAlias: {},
  aliases: 0,
  total: 0,
};

const formatUnreadBadge = (count: number | undefined): string | undefined => {
  return count && count > 0 ? String(count) : undefined;
};

interface BuildSidebarItemsInput {
  inboxNames: string[];
  aliasesNames: string[];
  aliasReplyLinks: Record<string, string>;
  sentNames: string[];
  threadGroups: Array<{ id: string | number; name: string }>;
  isThreadsSectionExpanded: boolean;
  selectedAliasInboxName?: string | null;
  primaryName?: string | null;
  canPublishState?: boolean;
  isPublishingState?: boolean;
  hasPendingStateChanges?: boolean;
  unreadCounts?: UnreadCounts;
  /** Unread threads per group id, for the threads-group items. */
  threadUnreadByGroup?: Record<string, number>;
}

const getMessageIdentifier = (message: any): string => {
  const value = message?.id ?? message?.identifier;
  if (value === undefined || value === null) return "";
  return String(value);
};

export const buildSidebarItems = ({
  inboxNames,
  aliasesNames,
  aliasReplyLinks,
  sentNames,
  threadGroups,
  isThreadsSectionExpanded,
  selectedAliasInboxName,
  primaryName,
  canPublishState,
  isPublishingState,
  hasPendingStateChanges,
  unreadCounts = EMPTY_UNREAD_COUNTS,
  threadUnreadByGroup,
}: BuildSidebarItemsInput): LeftSidebarItem[] => {
  const items: LeftSidebarItem[] = [{ id: "compose", label: "Compose" }];
  const normalizedSelectedAliasInboxName = (
    selectedAliasInboxName || ""
  ).trim();
  if (normalizedSelectedAliasInboxName) {
    items.push({
      id: ALIAS_COMPOSE_ITEM_ID,
      label: "Alias Compose",
      secondaryLabel: normalizedSelectedAliasInboxName,
    });
  }

  items.push({
    id: "inbox",
    label: "Inbox",
    badgeText: formatUnreadBadge(unreadCounts.inbox),
  });

  sortOwnedNamesForDisplay(inboxNames, primaryName).forEach(name => {
    items.push({
      id: createInboxInstanceItemId(name),
      label: name,
      badgeText: formatUnreadBadge(unreadCounts.byName[name]),
    });
  });
  items.push({ id: ARCHIVED_ITEM_ID, label: "Archived" });

  items.push({
    id: "aliases",
    label: "Aliases",
    badgeText: formatUnreadBadge(unreadCounts.aliases),
  });
  sortOwnedNamesForDisplay(aliasesNames, primaryName).forEach(name => {
    const normalizedAliasName = name.trim().toLowerCase();
    const linkedReplyAlias = aliasReplyLinks[normalizedAliasName] || "";
    items.push({
      id: createAliasesInstanceItemId(name),
      label: name,
      secondaryLabel: linkedReplyAlias || undefined,
      badgeText: formatUnreadBadge(unreadCounts.byAlias[name]),
    });
  });

  items.push({ id: "sent", label: "Sent" });
  sortOwnedNamesForDisplay(sentNames, primaryName).forEach(name => {
    items.push({
      id: createSentInstanceItemId(name),
      label: name,
    });
  });
  items.push({ id: "drafts", label: "Drafts" });

  items.push({
    id: "threads",
    label: "Q-Mail Threads",
    badgeText: isThreadsSectionExpanded ? "-" : "+",
  });
  [...threadGroups]
    .sort((a, b) => {
      return String(a.name).localeCompare(String(b.name), undefined, {
        sensitivity: "base",
      });
    })
    .forEach(group => {
      const unreadThreads = threadUnreadByGroup?.[String(group.id)] || 0;
      items.push({
        id: createThreadGroupItemId(group.id),
        label: group.name,
        hidden: !isThreadsSectionExpanded,
        badgeText: unreadThreads > 0 ? formatUnreadBadge(unreadThreads) : undefined,
      });
    });
  if (canPublishState) {
    items.push({
      id: PUBLISH_STATE_ITEM_ID,
      label: isPublishingState ? "Publishing State..." : "Publish Q-Mail State",
      disabled: Boolean(isPublishingState),
      badgeText: hasPendingStateChanges ? "!" : undefined,
    });
  }
  return items;
};


interface MailProps {
  isFromTo: boolean;
  /** True while Settings covers the (still mounted) mail page. */
  isHidden?: boolean;
}

export const Mail = ({ isFromTo, isHidden = false }: MailProps) => {
  const { name: composeRouteName } = useParams();
  const { isShow, onOk, show } = useModal();
  const { user } = useSelector((state: RootState) => state.auth);
  const { registerMailSync, state: appShellState } = useAppShell();
  const { uiTheme } = useHubTheme();
  const textSize = appShellState.settings.textSize;
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [message, setMessage] = useState<any>(null);
  const [replyTo, setReplyTo] = useState<any>(null);
  const [forwardInfo, setForwardInfo] = useState<any>(null);
  const [currentThread, setCurrentThread] = useState<any>(null);
  const [watchedAliases, setWatchedAliases] = useState<string[]>([]);
  const [watchedAliasesWithMessages, setWatchedAliasesWithMessages] = useState<
    string[]
  >([]);
  const [watchedAliasRecentMessages, setWatchedAliasRecentMessages] = useState<
    Record<string, any[]>
  >({});
  const [isLoadingWatchedAliasActivity, setIsLoadingWatchedAliasActivity] =
    useState(false);
  const [isAliasScanRunning, setIsAliasScanRunning] = useState(false);
  const [aliasScanPhase, setAliasScanPhase] = useState<
    "idle" | "collecting" | "scanning"
  >("idle");
  const [aliasScanScannedCount, setAliasScanScannedCount] = useState(0);
  const [aliasScanTotalCount, setAliasScanTotalCount] = useState(0);
  const [aliasScanDiscoveredCount, setAliasScanDiscoveredCount] = useState(0);
  const [aliasScanStatusMessage, setAliasScanStatusMessage] = useState("");
  const [aliasScanCheckpointTimestamp, setAliasScanCheckpointTimestamp] =
    useState(0);
  const [isAliasScanCancelRequested, setIsAliasScanCancelRequested] =
    useState(false);
  const aliasScanCancelRequestedRef = useRef(false);
  // N9: the capped scan's counters for this run and whether the whole index has been walked.
  const [aliasScanPaging, setAliasScanPaging] = useState({
    resourcesWalked: 0,
    candidatesChecked: 0,
    maxPages: ALIAS_SCAN_MAX_PAGES,
    complete: false,
    stoppedAtCap: false,
  });
  const [ownedInboxNames, setOwnedInboxNames] = useState<string[]>([]);
  const [ownedSentNames, setOwnedSentNames] = useState<string[]>([]);
  const [run, setRun] = useState(false);
  const [shortcutsHelpOpen, setShortcutsHelpOpen] = useState(false);
  const [filterMode, setFilterMode] = useState<string>("Recently active");
  const [selectedAlias, setSelectedAlias] = useState<string | null>(null);
  const [selectedAliasScope, setSelectedAliasScope] =
    useState<SelectedAliasScope>(null);
  const [selectedGroup, setSelectedGroup] = useState<any>(null);
  const privateGroups = useSelector(
    (state: RootState) => state.global.privateGroups
  );
  const [groupOptionsWithThreads, setGroupOptionsWithThreads] = useState<any[]>(
    []
  );
  const [groupAvatarUrlById, setGroupAvatarUrlById] = useState<
    Record<string, string>
  >({});
  const [isLoadingGroupInstances, setIsLoadingGroupInstances] = useState(false);
  const [mailInfo, setMailInfo] = useState<any>(null);
  // Each open request gets a number; a superseded one may not open or clear
  // anything when its opener finally settles.
  const openRequestRef = useRef(0);
  const cancelPendingOpenRef = useRef<() => void>(() => undefined);
  cancelPendingOpenRef.current = () => {
    openRequestRef.current += 1;
    if (isShow) onOk(undefined);
    setMailInfo(null);
  };
  const layoutMode = useLayoutMode();
  const isMobile = layoutMode === "phone";
  // One pane at a time: phones, and the medium layout in a landscape Hub
  // frame (703x201), the same rule as MailShell. The reading pane then needs
  // its own Back bar and hardware Back must close it.
  const landscapeFrame = useLandscapeFrame();
  const isOnePane = isMobile || (layoutMode === "medium" && landscapeFrame);
  const [railOpen, setRailOpen] = useState(false);
  const location = useLocation();
  useAppViewport();
  const [activeMailboxItem, setActiveMailboxItem] =
    useState<MailboxSidebarItemId>("inbox");
  const [composeMode, setComposeMode] = useState<ComposeMode>("standard");
  const [isThreadsSectionExpanded, setIsThreadsSectionExpanded] =
    useState(false);
  const [composePrefill, setComposePrefill] = useState<any>(null);
  const [composeReturnView, setComposeReturnView] =
    useState<ComposeReturnView>("inbox");
  const [composeReturnGroupId, setComposeReturnGroupId] = useState<
    string | null
  >(null);
  const [composeRecipientAlias, setComposeRecipientAlias] = useState<
    string | null
  >(null);
  const [composeRequireReplyAlias, setComposeRequireReplyAlias] =
    useState(false);
  const [composeDefaultReplyAlias, setComposeDefaultReplyAlias] = useState("");
  const [isPublishingMailState, setIsPublishingMailState] = useState(false);
  const [publishedMailStateById, setPublishedMailStateById] = useState<
    Record<string, QMailPublishedStateEntry>
  >({});
  const [inboxSearchQuery, setInboxSearchQuery] = useState("");
  const [combinedAliasInboxMessages, setCombinedAliasInboxMessages] = useState<
    Record<string, any[]>
  >({});
  const [isLoadingCombinedAliasInbox, setIsLoadingCombinedAliasInbox] =
    useState(false);
  const [isLoadingQdnState, setIsLoadingQdnState] = useState(false);
  const [aliasReplyLinks, setAliasReplyLinks] = useState<
    Record<string, string>
  >({});
  const hasPromptedForPublishedMailStateRef = useRef<string | null>(null);
  const [rememberQdnStatePreferenceOnLoad, setRememberQdnStatePreferenceOnLoad] =
    useState(false);
  // Mirrors the checkbox so the load prompt (awaited inside a callback created
  // before the user ticked it) reads the current value (Bugs #2).
  const rememberQdnStatePreferenceRef = useRef(false);
  // True once this session has read the published state document (or
  // published one): a publish before that must fetch and merge it first.
  const hasReadPublishedStateRef = useRef(false);
  const markMessagesAsReadRef = useRef<
    ((messages: any[]) => void | Promise<void>) | null
  >(null);
  const userAvatarHash = useSelector(
    (state: RootState) => state.global.userAvatarHash
  );
  const memberGroupOptions = useMemo(() => {
    return Object.keys(privateGroups)
      .map(key => {
        return {
          ...privateGroups[key],
          name: privateGroups[key].groupName,
          id: key,
        };
      })
      .filter(group => {
        const groupName =
          typeof group?.name === "string" ? group.name.trim() : "";
        return Boolean(group?.id) && Boolean(groupName);
      })
      .sort((a, b) => {
        return String(a.name).localeCompare(String(b.name), undefined, {
          sensitivity: "base",
        });
      });
  }, [privateGroups]);
  const hashMapMailMessages = useSelector(
    (state: RootState) => state.mail.hashMapMailMessages
  );
  // Secondary-name rows whose body turned out to be the delete marker: the
  // primary inbox drops them through removeMessages when a message is opened;
  // these lists are filtered against the hash map instead.
  const visibleCombinedAliasInboxMessages = useMemo(() => {
    let next: typeof combinedAliasInboxMessages | null = null;
    Object.entries(combinedAliasInboxMessages).forEach(([name, rows]) => {
      const visible = withoutDeletedRows(rows, hashMapMailMessages);
      if (visible === rows) return;
      if (!next) next = { ...combinedAliasInboxMessages };
      next[name] = visible;
    });
    return next || combinedAliasInboxMessages;
  }, [combinedAliasInboxMessages, hashMapMailMessages]);

  const mailMessages = useSelector(
    (state: RootState) => state.mail.mailMessages
  );
  const readState = useSelector((state: RootState) => state.mail.readState);
  const archived = useSelector((state: RootState) => state.mail.archived);
  // Appearance from the last loaded or published document (never auto-applied).
  const [publishedAppearance, setPublishedAppearance] =
    useState<PublishedAppearance | null>(null);
  const [publishedArchivedById, setPublishedArchivedById] =
    useState<ArchivedMap>({});
  const { Modal: LoadPublishedStateModal, showModal: showLoadPublishedStateModal } =
    useConfirmationModal({
      title: "Load published QDN state?",
      message:
        "Q-Mail found a published mailbox state for this account. Keep fetching it in the background and apply it when the download finishes?",
      confirmLabel: "Load state",
      cancelLabel: "Not now",
      children: (
        <FormControlLabel
          sx={{
            alignItems: "flex-start",
            marginLeft: "-9px",
            marginTop: "4px",
          }}
          control={
            <Checkbox
              checked={rememberQdnStatePreferenceOnLoad}
              onChange={(_, checked) => {
                rememberQdnStatePreferenceRef.current = checked;
                setRememberQdnStatePreferenceOnLoad(checked);
              }}
            />
          }
          label="Always fetch and apply QDN state"
        />
      ),
    });

  const ownedNameCandidates = useMemo(() => {
    const accountNames = user?.names;
    const namesFromAccount = Array.isArray(accountNames)
      ? accountNames
          .map((item: any) =>
            typeof item?.name === "string" ? item.name.trim() : ""
          )
          .filter(Boolean)
      : [];

    const mergedNames = [user?.name || "", ...namesFromAccount].filter(Boolean);
    const dedupedMap = new Map<string, string>();
    mergedNames.forEach(name => {
      const normalized = name.toLowerCase();
      if (!dedupedMap.has(normalized)) {
        dedupedMap.set(normalized, name);
      }
    });

    return Array.from(dedupedMap.values());
  }, [user?.name, user?.names]);
  const hasAuthenticatedIdentity = Boolean(user?.name && user?.address);
  const watchedAliasOwnerAddress =
    typeof user?.address === "string" ? user.address.trim() : "";
  const normalizedUserName = (user?.name || "").toLowerCase();
  const normalizedSelectedAlias = (selectedAlias || "").toLowerCase();
  const watchedAliasSet = useMemo(() => {
    return new Set(watchedAliases.map(name => name.toLowerCase()));
  }, [watchedAliases]);
  const selectedAliasIsPrimaryName =
    Boolean(selectedAlias) && normalizedSelectedAlias === normalizedUserName;
  const isAliasesViewActive = activeMailboxItem === "aliases";
  const isSentViewActive = activeMailboxItem === "sent";
  const isInboxViewActive = activeMailboxItem === "inbox";
  const isArchivedViewActive = activeMailboxItem === "archived";
  const selectedInboxInstanceName =
    isInboxViewActive && selectedAliasScope === "inbox" ? selectedAlias : null;
  const selectedAliasInboxName =
    selectedAliasScope === "aliases" && !selectedAliasIsPrimaryName
      ? selectedAlias
      : null;
  const activeAliasInboxName = isAliasesViewActive
    ? selectedAliasInboxName
    : null;
  const selectedSentInstanceName =
    isSentViewActive && selectedAliasScope === "sent" ? selectedAlias : null;
  const inboxSidebarNames = useMemo(() => {
    return sortOwnedNamesForDisplay([...ownedInboxNames], user?.name);
  }, [ownedInboxNames, user?.name]);
  const aliasSidebarNames = useMemo(() => {
    return [...watchedAliases].sort((a, b) => {
      return a.localeCompare(b, undefined, { sensitivity: "base" });
    });
  }, [watchedAliases]);
  const combinedAliasInboxNames = useMemo(() => {
    return ownedInboxNames.filter(
      name => name.toLowerCase() !== normalizedUserName
    );
  }, [normalizedUserName, ownedInboxNames]);
  const ownedNamesWithMail = useMemo(() => {
    const deduped = new Map<string, string>();
    [...ownedInboxNames, ...ownedSentNames, ...watchedAliases].forEach(name => {
      const normalized = name.trim().toLowerCase();
      if (!normalized || deduped.has(normalized)) return;
      deduped.set(normalized, name);
    });
    return Array.from(deduped.values());
  }, [ownedInboxNames, ownedSentNames, watchedAliases]);
  const avatarUrlByNameLowercase = useMemo(() => {
    const map = new Map<string, string>();
    if (!userAvatarHash) return map;
    Object.entries(userAvatarHash).forEach(([name, url]) => {
      const normalizedName =
        typeof name === "string" ? name.trim().toLowerCase() : "";
      const normalizedUrl = typeof url === "string" ? url.trim() : "";
      if (!normalizedName || !normalizedUrl || map.has(normalizedName)) return;
      map.set(normalizedName, normalizedUrl);
    });
    return map;
  }, [userAvatarHash]);
  const groupOptionsById = useMemo(() => {
    const map = new Map<string, any>();
    groupOptionsWithThreads.forEach(group => {
      const key = String(group?.id || "").trim();
      if (!key || map.has(key)) return;
      map.set(key, group);
    });
    return map;
  }, [groupOptionsWithThreads]);
  const combinedInboxMessages = useMemo(() => {
    const mergedMessages = new Map<string, any>();
    const appendMessages = (messages: any[]) => {
      messages.forEach(message => {
        const identifier = message?.id || message?.identifier;
        if (!identifier) return;
        const existingMessage = mergedMessages.get(identifier);
        if (!existingMessage) {
          mergedMessages.set(identifier, message);
          return;
        }
        if (
          Number(message?.createdAt || 0) >
          Number(existingMessage?.createdAt || 0)
        ) {
          mergedMessages.set(identifier, message);
        }
      });
    };

    appendMessages(mailMessages);
    Object.values(visibleCombinedAliasInboxMessages).forEach(messages => {
      appendMessages(messages);
    });

    return Array.from(mergedMessages.values()).sort((a, b) => {
      return Number(b?.createdAt || 0) - Number(a?.createdAt || 0);
    });
  }, [visibleCombinedAliasInboxMessages, mailMessages]);
  const unreadCounts = useMemo<UnreadCounts>(() => {
    if (!hasAuthenticatedIdentity) return EMPTY_UNREAD_COUNTS;
    const byName: Record<string, number> = {};
    ownedInboxNames.forEach(name => {
      const messages =
        name.toLowerCase() === normalizedUserName
          ? mailMessages
          : visibleCombinedAliasInboxMessages[name] || [];
      byName[name] = countUnreadMessages(messages, readState, archived);
    });
    const byAlias: Record<string, number> = {};
    let aliases = 0;
    Object.entries(watchedAliasRecentMessages).forEach(([alias, messages]) => {
      const count = countUnreadMessages(messages, readState, archived);
      byAlias[alias] = count;
      aliases += count;
    });
    const inbox = countUnreadMessages(combinedInboxMessages, readState, archived);
    return { inbox, byName, byAlias, aliases, total: inbox + aliases };
  }, [
    archived,
    visibleCombinedAliasInboxMessages,
    combinedInboxMessages,
    hasAuthenticatedIdentity,
    mailMessages,
    normalizedUserName,
    ownedInboxNames,
    readState,
    watchedAliasRecentMessages,
  ]);

  useEffect(() => {
    const total = unreadCounts.total;
    document.title = total > 0 ? `(${total}) Q-Mail+` : "Q-Mail+";
  }, [unreadCounts.total]);
  const composePriorityRecipientNames = useMemo(() => {
    const deduped = new Map<string, string>();
    const addName = (value: any) => {
      const candidate = typeof value === "string" ? value.trim() : "";
      const normalized = candidate.toLowerCase();
      if (!candidate || deduped.has(normalized)) return;
      deduped.set(normalized, candidate);
    };

    const appendMessages = (messages: any[]) => {
      messages.forEach(message => {
        addName(message?.user);
        addName(message?.recipient);
        addName(message?.to);
      });
    };

    appendMessages(mailMessages);
    Object.values(combinedAliasInboxMessages).forEach(messages => {
      appendMessages(messages);
    });
    Object.values(hashMapMailMessages).forEach(message => {
      addName((message as any)?.user);
      addName((message as any)?.recipient);
      addName((message as any)?.to);
    });

    return Array.from(deduped.values()).sort((a, b) => {
      return a.localeCompare(b, undefined, { sensitivity: "base" });
    });
  }, [combinedAliasInboxMessages, hashMapMailMessages, mailMessages]);
  const archivedMessages = useMemo(() => {
    return combinedInboxMessages.filter(message => {
      return isArchivedId(archived, getMessageIdentifier(message));
    });
  }, [archived, combinedInboxMessages]);
  const inboxMessagesForList = useMemo(() => {
    const withoutArchived = (messages: any[]) => {
      return messages.filter(message => {
        return !isArchivedId(archived, getMessageIdentifier(message));
      });
    };
    if (!selectedInboxInstanceName) {
      return withoutArchived(combinedInboxMessages);
    }
    if (selectedInboxInstanceName.toLowerCase() === normalizedUserName) {
      return withoutArchived(mailMessages);
    }
    return withoutArchived(
      visibleCombinedAliasInboxMessages[selectedInboxInstanceName] ?? []
    );
  }, [
    archived,
    visibleCombinedAliasInboxMessages,
    combinedInboxMessages,
    mailMessages,
    normalizedUserName,
    selectedInboxInstanceName,
  ]);
  // Archived alias mail lives in AliasMail's rows (fed back through
  // watchedAliasRecentMessages), not in the combined inbox.
  const archivedForList = useMemo(() => {
    const seen = new Set(archivedMessages.map(getMessageIdentifier));
    const extra: any[] = [];
    Object.values(watchedAliasRecentMessages).forEach(rows => {
      rows.forEach(row => {
        const id = getMessageIdentifier(row);
        if (!id || seen.has(id) || !isArchivedId(archived, id)) return;
        seen.add(id);
        extra.push(row);
      });
    });
    if (!extra.length) return archivedMessages;
    return [...archivedMessages, ...extra].sort((a, b) => {
      return Number(b?.createdAt || 0) - Number(a?.createdAt || 0);
    });
  }, [archived, archivedMessages, watchedAliasRecentMessages]);
  const handleAliasMessagesLoaded = useCallback((alias: string, rows: any[]) => {
    setWatchedAliasRecentMessages(previous => {
      return previous[alias] === rows ? previous : { ...previous, [alias]: rows };
    });
  }, []);

  // ---- search (N8): one box, "This mailbox" or "All mail" -----------------
  const [searchScope, setSearchScope] = useState<MailSearchScope>("mailbox");
  const [bodySearchLimit, setBodySearchLimit] = useState(0);
  const [mailboxSearchStatus, setMailboxSearchStatus] =
    useState<MailboxSearchStatus | null>(null);
  const [isLoadingAllMail, setIsLoadingAllMail] = useState(false);
  const isMailboxSearchView =
    isInboxViewActive ||
    isArchivedViewActive ||
    isSentViewActive ||
    (isAliasesViewActive && Boolean(activeAliasInboxName));
  const hasSearchQuery = inboxSearchQuery.trim().length > 0;
  const isAllMailSearch =
    hasAuthenticatedIdentity &&
    isMailboxSearchView &&
    searchScope === "all" &&
    hasSearchQuery;
  // Body decrypts are opt-in per query and per view.
  useEffect(() => {
    setBodySearchLimit(0);
  }, [inboxSearchQuery, activeMailboxItem, searchScope, selectedAlias]);
  useEffect(() => {
    setMailboxSearchStatus(null);
  }, [activeMailboxItem, selectedAlias]);

  const { results: inboxSearchResults, status: inboxSearchStatus } =
    useMailboxSearch({
      messages: isArchivedViewActive
        ? archivedForList
        : inboxMessagesForList || [],
      query: inboxSearchQuery,
      mailboxType: "inbox",
      username: user?.name,
      hashMapMailMessages,
      enabled:
        hasAuthenticatedIdentity &&
        (isInboxViewActive || isArchivedViewActive) &&
        !isAllMailSearch,
      bodyLimit: bodySearchLimit,
    });

  // The names "All mail" searches the sent mail of (the Sent view's "all names").
  const allMailSentNames = useMemo(
    () => (ownedSentNames.length ? ownedSentNames : user?.name ? [user.name] : []),
    [ownedSentNames, user?.name]
  );
  const sentIndexForSearch = useMailIndex(sentIndexKey(allMailSentNames));
  const mailIndexVersion = useMailIndexVersion();
  const allMailRows = useMemo(() => {
    if (!isAllMailSearch) return [];
    void mailIndexVersion;
    const rows: any[] = [];
    const seen = new Set<string>();
    const push = (message: any, ref: MailboxRef) => {
      const id = getMessageIdentifier(message);
      const key = `${ref.kind}:${ref.alias || ""}:${id}`;
      if (!id || seen.has(key)) return;
      seen.add(key);
      rows.push(tagForMailbox(message, ref));
    };
    combinedInboxMessages.forEach(message => {
      push(message, {
        kind: isArchivedId(archived, getMessageIdentifier(message))
          ? "archived"
          : "inbox",
      });
    });
    (sentIndexForSearch || []).forEach(message => push(message, { kind: "sent" }));
    watchedAliases.forEach(alias => {
      const loaded =
        getMailIndex(aliasIndexKey(alias)) ||
        watchedAliasRecentMessages[alias] ||
        [];
      loaded.forEach(message => push(message, { kind: "alias", alias }));
    });
    return rows;
  }, [
    archived,
    combinedInboxMessages,
    isAllMailSearch,
    mailIndexVersion,
    sentIndexForSearch,
    watchedAliasRecentMessages,
    watchedAliases,
  ]);

  const { results: allMailResults, status: allMailStatus } = useMailboxSearch({
    messages: allMailRows,
    query: inboxSearchQuery,
    username: user?.name,
    hashMapMailMessages,
    enabled: isAllMailSearch,
    bodyLimit: bodySearchLimit,
  });

  // "All mail" needs the sent index and the alias inboxes; load each once.
  useEffect(() => {
    if (!isAllMailSearch || !user?.address) return;
    let cancelled = false;
    setIsLoadingAllMail(true);
    const address = user.address;
    Promise.all([
      ensureSentIndex(allMailSentNames),
      ...watchedAliases.map(alias => ensureAliasIndex(alias, address)),
    ])
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setIsLoadingAllMail(false);
      });
    return () => {
      cancelled = true;
    };
  }, [allMailSentNames, isAllMailSearch, user?.address, watchedAliases]);

  const activeSearchStatus: MailboxSearchStatus = isAllMailSearch
    ? allMailStatus
    : isInboxViewActive || isArchivedViewActive
      ? inboxSearchStatus
      : mailboxSearchStatus || idleSearchStatus(0);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const { getAllMailMessages, checkNewMessages } = useFetchMail();
  // The inbox index load error, surfaced by the list as an ErrorState with Retry.
  const [inboxLoadError, setInboxLoadError] = useState<string | null>(null);
  const getMessages = React.useCallback(
    async (isOnMount?: boolean) => {
      if (!user?.name || !user?.address) return;
      try {
        if (isOnMount) {
          setIsLoading(true);
        }
        setInboxLoadError(null);
        await getAllMailMessages(user.name, user.address);
      } catch (error: any) {
        setInboxLoadError(
          typeof error?.message === "string" && error.message
            ? error.message
            : "Couldn't reach the node."
        );
      } finally {
        setIsLoading(false);
      }
    },
    [getAllMailMessages, user]
  );

  const combinedAliasInboxMessagesRef = useRef(combinedAliasInboxMessages);
  useEffect(() => {
    combinedAliasInboxMessagesRef.current = combinedAliasInboxMessages;
  }, [combinedAliasInboxMessages]);

  // New-mail poll for the combined inbox: the primary name through
  // checkNewMessages, every other owned name with mail through the limit-20
  // owned-name queries. Pauses while hidden and backs off while nothing is new.
  usePolling(
    async () => {
      if (!user?.name || !user?.address) return;
      const address = user.address;
      const namesToPoll = combinedAliasInboxNames.filter(name => {
        return Boolean(combinedAliasInboxMessagesRef.current[name]);
      });
      const [primaryNewCount, ...secondaryResults] = await Promise.all([
        checkNewMessages(user.name, address),
        ...namesToPoll.map(async name => {
          const rows = await fetchRecentInboxMessagesForOwnedName(name, address);
          return { name, rows };
        }),
      ]);
      let foundNew = Boolean(primaryNewCount);
      if (secondaryResults.length) {
        const previous = combinedAliasInboxMessagesRef.current;
        secondaryResults.forEach(({ name, rows }) => {
          const known = previous[name];
          if (known && mergeNewRows(known, rows) !== known) {
            foundNew = true;
          }
        });
        setCombinedAliasInboxMessages(current => {
          let next = current;
          secondaryResults.forEach(({ name, rows }) => {
            const known = current[name];
            if (!known) return;
            const merged = mergeNewRows(known, rows);
            if (merged === known) return;
            if (next === current) next = { ...current };
            next[name] = merged;
          });
          return next;
        });
      }
      return foundNew;
    },
    {
      intervalMs: 30000,
      maxIntervalMs: 300000,
      enabled: hasAuthenticatedIdentity,
    }
  );

  const openMessage = async (
    user: string,
    messageIdentifier: string,
    content: any,
    to?: string,
    // Set by callers that switch mailbox in the same click (search hits):
    // the mailbox state is not applied yet, so it can't decide.
    options?: { autoMarkRead?: boolean }
  ) => {
    // A newer open supersedes any opener still waiting on peers.
    cancelPendingOpenRef.current();
    const request = openRequestRef.current;
    try {
      const shouldAutoMarkAsRead =
        options?.autoMarkRead ??
        (activeMailboxItem === "inbox" || activeMailboxItem === "aliases");
      const existingMessage: any = hashMapMailMessages[messageIdentifier];
      if (
        existingMessage &&
        existingMessage.isValid &&
        !existingMessage.unableToDecrypt
      ) {
        setMessage(existingMessage);
        setIsOpen(true);
        if (shouldAutoMarkAsRead) {
          void markMessagesAsReadRef.current?.([
            {
              id: messageIdentifier,
              identifier: messageIdentifier,
              user,
            },
          ]);
        }
        return;
      }
      setMailInfo(openerInfoFor(messageIdentifier, user, to, content));
      const res: any = await show();
      if (request !== openRequestRef.current) return;
      setMailInfo(null);
      if (res && res.isValid && !res.unableToDecrypt) {
        setMessage(res);
        setIsOpen(true);
        if (shouldAutoMarkAsRead) {
          void markMessagesAsReadRef.current?.([
            {
              id: messageIdentifier,
              identifier: messageIdentifier,
              user,
            },
          ]);
        }
        return;
      }
    } catch {
      // Nothing to show: the message stays closed and the reader prompt is cleared.
      if (request === openRequestRef.current) setMailInfo(null);
    }
  };

  // Reply all: the composer also addresses everyone in the original's
  // additive `to`/`cc` fields (as separate Bcc-style copies).
  const [composeReplyAll, setComposeReplyAll] = useState(false);

  const openReplyComposerFromMessage = useCallback(
    (messagePayload: any, options?: { replyAll?: boolean }) => {
      const linkedReplyAlias = activeAliasInboxName
        ? aliasReplyLinks[activeAliasInboxName.toLowerCase()] || ""
        : "";
      setForwardInfo(null);
      setComposeReplyAll(Boolean(options?.replyAll));
      setReplyTo(messagePayload);
      setComposePrefill(null);
      setComposeReturnView("inbox");
      setComposeReturnGroupId(null);
      setComposeRecipientAlias(activeAliasInboxName);
      setComposeRequireReplyAlias(Boolean(activeAliasInboxName));
      setComposeDefaultReplyAlias(linkedReplyAlias);
      setComposeMode(activeAliasInboxName ? "alias" : "standard");
      setIsOpen(false);
      setMessage(null);
      setActiveMailboxItem("compose");
    },
    [activeAliasInboxName, aliasReplyLinks]
  );

  const openForwardComposerFromMessage = useCallback(
    (forwardPayload: any) => {
      setReplyTo(null);
      setComposeReplyAll(false);
      // The reader may send ready-made HTML (string) or the message itself;
      // the composer builds the Fwd: subject, the header and the re-attached
      // files from the open message.
      const forwardedMessage =
        forwardPayload && typeof forwardPayload === "object" && forwardPayload.id
          ? forwardPayload
          : message;
      setForwardInfo({
        html: typeof forwardPayload === "string" ? forwardPayload : "",
        message: forwardedMessage,
        to: activeAliasInboxName
          ? `${activeAliasInboxName} (alias inbox)`
          : user?.name || "",
      });
      setComposePrefill(null);
      setComposeReturnView("inbox");
      setComposeReturnGroupId(null);
      setComposeRecipientAlias(activeAliasInboxName);
      setComposeRequireReplyAlias(false);
      setComposeDefaultReplyAlias("");
      setComposeMode("standard");
      setIsOpen(false);
      setMessage(null);
      setActiveMailboxItem("compose");
    },
    [activeAliasInboxName, message, user?.name]
  );

  const handleRequestComposeThread = useCallback(
    (groupInfo: any) => {
      const groupId = String(groupInfo?.id || "").trim();
      const groupName =
        typeof groupInfo?.name === "string" ? groupInfo.name.trim() : "";
      if (!groupId || !groupName) return;

      const ownedNameLookup = new Set(
        ownedNameCandidates.map(name => name.trim().toLowerCase())
      );
      const normalizedSelectedAlias = (selectedAlias || "")
        .trim()
        .toLowerCase();
      const preferredFromName =
        normalizedSelectedAlias && ownedNameLookup.has(normalizedSelectedAlias)
          ? selectedAlias
          : user?.name || ownedNameCandidates[0] || "";

      setReplyTo(null);
      setComposeReplyAll(false);
      setForwardInfo(null);
      setCurrentThread(null);
      setSelectedGroup(groupInfo);
      setIsOpen(false);
      setMessage(null);

      setComposePrefill({
        draftId: Date.now(),
        fromName: preferredFromName,
        toValue: groupName,
        toType: "group",
        groupId,
      });
      setComposeReturnView("threads");
      setComposeReturnGroupId(groupId);
      setComposeRecipientAlias(null);
      setComposeRequireReplyAlias(false);
      setComposeDefaultReplyAlias("");
      setComposeMode("standard");
      setActiveMailboxItem("compose");
    },
    [ownedNameCandidates, selectedAlias, user?.name]
  );

  // Open a stored draft from the Drafts mailbox: a mail draft goes to the
  // composer (as a reply when the replied-to message is still in memory); a
  // thread-post draft opens its thread, where NewThread restores it.
  const handleOpenDraft = useCallback(
    (draftKey: string, draft: StoredComposeDraft) => {
      setIsOpen(false);
      setMessage(null);

      if (draft.kind === "thread") {
        const groupInfo = draft.groupId
          ? groupOptionsById.get(String(draft.groupId))
          : undefined;
        if (!groupInfo) {
          dispatch(
            setNotification({
              msg: "This draft belongs to a group you are no longer in",
              alertType: "info",
            })
          );
          return;
        }
        setReplyTo(null);
        setForwardInfo(null);
        setComposeReplyAll(false);
        setComposePrefill(null);
        setSelectedAlias(null);
        setSelectedAliasScope(null);
        setSelectedGroup(groupInfo);
        setCurrentThread(
          draft.threadId
            ? {
                threadId: draft.threadId,
                identifier: draft.threadId,
                name: draft.fromName,
                threadOwner: draft.fromName,
                service: THREAD_SERVICE_TYPE,
                threadData: {
                  title: draft.threadTitle || "",
                  groupId: String(draft.groupId),
                  name: draft.fromName,
                },
              }
            : null
        );
        setIsThreadsSectionExpanded(true);
        setActiveMailboxItem("threads");
        return;
      }

      const repliedTo: any = draft.replyTo?.id
        ? hashMapMailMessages[draft.replyTo.id]
        : null;
      const replyMessage =
        repliedTo && repliedTo.isValid && !repliedTo.unableToDecrypt
          ? repliedTo
          : null;
      setForwardInfo(null);
      setReplyTo(replyMessage);
      setComposeReplyAll(Boolean(replyMessage && draft.replyAll));
      setComposePrefill({
        draftId: Date.now(),
        fromName: draft.fromName,
        toValue: draft.toName,
        toType: "name",
        draftKey,
      });
      setComposeReturnView("inbox");
      setComposeReturnGroupId(null);
      setComposeRecipientAlias(null);
      setComposeRequireReplyAlias(false);
      setComposeDefaultReplyAlias("");
      setComposeMode("standard");
      setActiveMailboxItem("compose");
    },
    [dispatch, groupOptionsById, hashMapMailMessages]
  );

  const firstMount = useRef(false);
  const prevName = useRef<string>(undefined);
  useEffect(() => {
    if (!user?.name) {
      setInboxSearchQuery("");
    }
  }, [user?.name]);

  useEffect(() => {
    if (!user?.name) return;
    if (!firstMount.current || prevName.current !== user.name) {
      dispatch(clearMessages());
      setInboxSearchQuery("");
      getMessages(true);
      firstMount.current = true;
    }
    prevName.current = user.name;
    // Keyed on the signed-in name on purpose (the guard above compares names);
    // dispatch and getMessages are deliberately left out of the dependencies.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.name]);

  useEffect(() => {
    if (!isFromTo || !composeRouteName || !hasAuthenticatedIdentity) {
      return;
    }

    setReplyTo(null);
    setForwardInfo(null);
    setSelectedAlias(null);
    setSelectedAliasScope(null);
    setSelectedGroup(null);
    setCurrentThread(null);
    setMessage(null);
    setIsOpen(false);
    setComposePrefill(null);
    setComposeReturnView("inbox");
    setComposeReturnGroupId(null);
    setComposeRecipientAlias(null);
    setComposeRequireReplyAlias(false);
    setComposeDefaultReplyAlias("");
    setComposeMode("standard");
    setActiveMailboxItem("compose");
  }, [composeRouteName, hasAuthenticatedIdentity, isFromTo]);

  useEffect(() => {
    const savedTourStatus = localStorage.getItem(TOUR_STATUS_STORAGE_KEY);
    if (!savedTourStatus) {
      setRun(true);
    }
  }, []);

  useEffect(() => {
    if (!watchedAliasOwnerAddress) {
      setWatchedAliases([]);
      setAliasReplyLinks({});
      return;
    }
    const storedAliases = readWatchedAliasesFromStorage(
      watchedAliasOwnerAddress
    );
    setWatchedAliases(storedAliases);
    setAliasReplyLinks(
      readAliasReplyLinksFromStorage(watchedAliasOwnerAddress)
    );
  }, [watchedAliasOwnerAddress]);

  useEffect(() => {
    if (!watchedAliasOwnerAddress) return;
    writeWatchedAliasesToStorage(watchedAliasOwnerAddress, watchedAliases);
  }, [watchedAliasOwnerAddress, watchedAliases]);

  useEffect(() => {
    if (!watchedAliasOwnerAddress) return;
    writeAliasReplyLinksToStorage(watchedAliasOwnerAddress, aliasReplyLinks);
  }, [aliasReplyLinks, watchedAliasOwnerAddress]);

  useEffect(() => {
    if (!watchedAliasOwnerAddress) {
      setAliasScanCheckpointTimestamp(0);
      setIsAliasScanCancelRequested(false);
      aliasScanCancelRequestedRef.current = false;
      return;
    }
    const checkpoint = readAliasScanCheckpointFromStorage(
      watchedAliasOwnerAddress
    );
    setAliasScanCheckpointTimestamp(checkpoint?.lastProcessedTimestamp || 0);
    setAliasScanPaging(previous => ({
      ...previous,
      complete: Boolean(checkpoint?.complete),
      stoppedAtCap: false,
    }));
    setIsAliasScanCancelRequested(false);
    aliasScanCancelRequestedRef.current = false;
  }, [watchedAliasOwnerAddress]);

  useEffect(() => {
    if (!hasAuthenticatedIdentity || watchedAliases.length === 0) {
      setWatchedAliasesWithMessages([]);
      setWatchedAliasRecentMessages({});
      setIsLoadingWatchedAliasActivity(false);
      return;
    }

    let cancelled = false;
    const populateWatchedAliasesWithMessages = async () => {
      setIsLoadingWatchedAliasActivity(true);
      try {
        const results = await Promise.all(
          watchedAliases.map(async aliasName => {
            const messages = await fetchRecentInboxMessagesForSavedAlias(
              aliasName
            );
            return {
              aliasName,
              messages,
            };
          })
        );

        if (cancelled) return;
        const aliasesWithMessages = results
          .filter(result => result.messages.length > 0)
          .map(result => result.aliasName);
        setWatchedAliasesWithMessages(aliasesWithMessages);
        setWatchedAliasRecentMessages(previous =>
          results.reduce<Record<string, any[]>>((accumulator, result) => {
            // AliasMail hands back everything it loaded; keep that over the probe's 20.
            const known = previous[result.aliasName];
            accumulator[result.aliasName] =
              known && known.length > result.messages.length ? known : result.messages;
            return accumulator;
          }, {})
        );
      } finally {
        if (!cancelled) {
          setIsLoadingWatchedAliasActivity(false);
        }
      }
    };

    void populateWatchedAliasesWithMessages();
    return () => {
      cancelled = true;
    };
  }, [hasAuthenticatedIdentity, watchedAliases]);

  useEffect(() => {
    let canceled = false;
    const populateOwnedNamesWithMail = async () => {
      if (!user?.address || !ownedNameCandidates.length) {
        setOwnedInboxNames([]);
        setOwnedSentNames([]);
        return;
      }

      const inboxNamesWithMail: string[] = [];
      const sentNamesWithMail: string[] = [];

      for (const accountName of ownedNameCandidates) {
        const [hasInboxMail, hasSentMail] = await Promise.all([
          hasInboxMailActivityForOwnedName(accountName, user.address, {
            isPrimary: accountName === user.name,
          }),
          hasSentMailActivityForOwnedName(accountName),
        ]);

        if (canceled) return;
        if (hasInboxMail) {
          inboxNamesWithMail.push(accountName);
        }
        if (hasSentMail) {
          sentNamesWithMail.push(accountName);
        }
      }

      if (canceled) return;
      const sortedInboxNames = sortOwnedNamesForDisplay(
        inboxNamesWithMail,
        user?.name
      );
      const sortedSentNames = sortOwnedNamesForDisplay(
        sentNamesWithMail,
        user?.name
      );
      setOwnedInboxNames(sortedInboxNames);
      setOwnedSentNames(sortedSentNames);
    };

    void populateOwnedNamesWithMail();
    return () => {
      canceled = true;
    };
  }, [ownedNameCandidates, user?.address, user?.name]);

  useEffect(() => {
    if (!hasAuthenticatedIdentity || !ownedNamesWithMail.length) {
      return;
    }

    let cancelled = false;
    const fetchOwnedNameAvatars = async () => {
      for (const name of ownedNamesWithMail) {
        if (cancelled) return;
        if (avatarUrlByNameLowercase.has(name.toLowerCase())) {
          continue;
        }
        try {
          // One GET_QDN_RESOURCE_URL per name per session; misses are remembered.
          const avatarUrl = await getAvatarUrl(name);

          if (cancelled) return;
          if (typeof avatarUrl !== "string" || !avatarUrl.trim()) {
            continue;
          }

          dispatch(
            setUserAvatarHash({
              name,
              url: avatarUrl,
            })
          );
        } catch {
          // Keep sidebar responsive even if an avatar is missing/unavailable.
        }
      }
    };

    void fetchOwnedNameAvatars();
    return () => {
      cancelled = true;
    };
  }, [
    avatarUrlByNameLowercase,
    dispatch,
    hasAuthenticatedIdentity,
    ownedNamesWithMail,
  ]);

  useEffect(() => {
    if (!selectedAlias) return;
    const selectedAliasExists = [
      ...ownedInboxNames,
      ...ownedSentNames,
      ...watchedAliases,
    ].some(
      aliasName => aliasName.toLowerCase() === selectedAlias.toLowerCase()
    );

    if (!selectedAliasExists) {
      setSelectedAlias(null);
      setSelectedAliasScope(null);
    }
  }, [ownedInboxNames, ownedSentNames, selectedAlias, watchedAliases]);

  useEffect(() => {
    if (!watchedAliases.length) {
      setAliasReplyLinks({});
      return;
    }
    const validAliasNames = new Set(
      watchedAliases.map(aliasName => aliasName.trim().toLowerCase())
    );
    setAliasReplyLinks(previous => {
      let didChange = false;
      const nextLinks = Object.entries(previous).reduce<Record<string, string>>(
        (accumulator, [aliasName, replyAlias]) => {
          if (!validAliasNames.has(aliasName)) {
            didChange = true;
            return accumulator;
          }
          accumulator[aliasName] = replyAlias;
          return accumulator;
        },
        {}
      );
      return didChange ? nextLinks : previous;
    });
  }, [watchedAliases]);

  useEffect(() => {
    if (!hasAuthenticatedIdentity || !memberGroupOptions.length) {
      setGroupOptionsWithThreads([]);
      setIsLoadingGroupInstances(false);
      return;
    }

    let cancelled = false;
    const filterGroupsWithThreads = async () => {
      setIsLoadingGroupInstances(true);
      try {
        const results = await Promise.all(
          memberGroupOptions.map(async group => {
            const hasThreads = await hasGroupThreadActivity(group.id);
            return {
              group,
              hasThreads,
            };
          })
        );

        if (cancelled) return;
        const filteredGroups = results
          .filter(result => result.hasThreads)
          .map(result => result.group);
        setGroupOptionsWithThreads(filteredGroups);
      } finally {
        if (!cancelled) {
          setIsLoadingGroupInstances(false);
        }
      }
    };

    void filterGroupsWithThreads();
    return () => {
      cancelled = true;
    };
  }, [hasAuthenticatedIdentity, memberGroupOptions]);

  useEffect(() => {
    if (!selectedGroup || isLoadingGroupInstances) return;
    const selectedGroupId = String(selectedGroup?.id || "");
    if (!selectedGroupId) {
      setSelectedGroup(null);
      return;
    }

    const selectedGroupStillVisible = groupOptionsWithThreads.some(group => {
      return String(group?.id || "") === selectedGroupId;
    });

    if (!selectedGroupStillVisible) {
      setSelectedGroup(null);
    }
  }, [groupOptionsWithThreads, isLoadingGroupInstances, selectedGroup]);

  const missingGroupAvatarIds = useMemo(() => {
    return groupOptionsWithThreads
      .map(group => String(group?.id || "").trim())
      .filter(Boolean)
      .filter(groupId => {
        return !Object.prototype.hasOwnProperty.call(
          groupAvatarUrlById,
          groupId
        );
      });
  }, [groupAvatarUrlById, groupOptionsWithThreads]);

  useEffect(() => {
    if (!hasAuthenticatedIdentity || !missingGroupAvatarIds.length) {
      return;
    }

    let cancelled = false;
    const populateGroupAvatars = async () => {
      for (const groupId of missingGroupAvatarIds) {
        if (cancelled) return;
        const avatarUrl = await fetchGroupAvatarUrl(groupId);
        if (cancelled) return;
        setGroupAvatarUrlById(previous => {
          if (Object.prototype.hasOwnProperty.call(previous, groupId)) {
            return previous;
          }
          return {
            ...previous,
            [groupId]: avatarUrl || "",
          };
        });
      }
    };

    void populateGroupAvatars();
    return () => {
      cancelled = true;
    };
  }, [hasAuthenticatedIdentity, missingGroupAvatarIds]);

  // Per-name inbox indexes are fetched once per session and address (Bugs #9);
  // the poll keeps them fresh. Names whose fetch failed are retried next visit.
  const fetchedInboxNamesRef = useRef<{ address: string; names: Set<string> }>({
    address: "",
    names: new Set(),
  });
  const combinedInboxFetchesInFlightRef = useRef(0);

  useEffect(() => {
    const address = typeof user?.address === "string" ? user.address : "";
    if (fetchedInboxNamesRef.current.address === address) return;
    fetchedInboxNamesRef.current = { address, names: new Set() };
    setCombinedAliasInboxMessages({});
  }, [user?.address]);

  useEffect(() => {
    if (
      !hasAuthenticatedIdentity ||
      !user?.address ||
      !(isInboxViewActive || isArchivedViewActive)
    ) {
      return;
    }
    const address = user.address;
    const selectedSecondaryName =
      selectedInboxInstanceName &&
      selectedInboxInstanceName.toLowerCase() !== normalizedUserName
        ? selectedInboxInstanceName
        : null;
    const wantedNames = selectedSecondaryName
      ? [selectedSecondaryName]
      : combinedAliasInboxNames;
    const cache = fetchedInboxNamesRef.current;
    const namesToFetch = wantedNames.filter(name => {
      return cache.address === address && !cache.names.has(name);
    });
    if (!namesToFetch.length) return;

    // Results are merged even if this effect is cleaned up meanwhile: the names
    // are already marked as fetched, so dropping them would lose them.
    const fetchCombinedAliasInboxMessages = async () => {
      combinedInboxFetchesInFlightRef.current += 1;
      setIsLoadingCombinedAliasInbox(true);
      try {
        namesToFetch.forEach(name => cache.names.add(name));
        const results = await Promise.all(
          namesToFetch.map(async name => {
            try {
              const messages = await fetchInboxMessagesForOwnedName(
                name,
                address
              );
              return { name, messages };
            } catch {
              cache.names.delete(name);
              return null;
            }
          })
        );

        setCombinedAliasInboxMessages(previous => {
          const next = { ...previous };
          results.forEach(result => {
            if (!result) return;
            next[result.name] = result.messages;
          });
          return next;
        });
      } finally {
        combinedInboxFetchesInFlightRef.current -= 1;
        setIsLoadingCombinedAliasInbox(
          combinedInboxFetchesInFlightRef.current > 0
        );
      }
    };

    void fetchCombinedAliasInboxMessages();
  }, [
    combinedAliasInboxNames,
    hasAuthenticatedIdentity,
    isArchivedViewActive,
    isInboxViewActive,
    normalizedUserName,
    selectedInboxInstanceName,
    user?.address,
  ]);

  const handleTourDone = useCallback(() => {
    setRun(false);
    localStorage.setItem(TOUR_STATUS_STORAGE_KEY, TOUR_STATUS_DISMISSED);
  }, []);

  // Warm the composer and reader chunks once the browser is idle after first
  // paint, so Compose and opening a message do not wait on the network.
  useEffect(() => {
    const handle = preloadOnIdle([loadNewMessage, loadShowMessageV2]);
    return () => handle.cancel();
  }, []);

  const addWatchedAliasByName = useCallback(
    (aliasName: string) => {
      const nextAlias = aliasName.trim();
      if (!nextAlias) return false;
      const normalizedAlias = nextAlias.toLowerCase();
      if (normalizedAlias === normalizedUserName) {
        return false;
      }
      if (watchedAliasSet.has(normalizedAlias)) {
        return false;
      }
      setWatchedAliases(previous => [...previous, nextAlias]);
      return true;
    },
    [normalizedUserName, watchedAliasSet]
  );

  const removeWatchedAlias = useCallback((aliasName: string) => {
    const normalizedAlias = aliasName.trim().toLowerCase();
    if (!normalizedAlias) return;
    setWatchedAliases(previous => {
      return previous.filter(
        name => name.trim().toLowerCase() !== normalizedAlias
      );
    });
    setAliasReplyLinks(previous => {
      if (!Object.prototype.hasOwnProperty.call(previous, normalizedAlias)) {
        return previous;
      }
      const nextLinks = { ...previous };
      delete nextLinks[normalizedAlias];
      return nextLinks;
    });
  }, []);

  const setLinkedReplyAlias = useCallback(
    (aliasName: string, replyAlias: string) => {
      const normalizedAliasName = aliasName.trim().toLowerCase();
      const normalizedReplyAlias = replyAlias.trim();
      if (!normalizedAliasName || !normalizedReplyAlias) return false;
      if (normalizedAliasName === normalizedReplyAlias.toLowerCase()) {
        return false;
      }
      setAliasReplyLinks(previous => ({
        ...previous,
        [normalizedAliasName]: normalizedReplyAlias,
      }));
      return true;
    },
    []
  );

  const clearLinkedReplyAlias = useCallback((aliasName: string) => {
    const normalizedAliasName = aliasName.trim().toLowerCase();
    if (!normalizedAliasName) return;
    setAliasReplyLinks(previous => {
      if (
        !Object.prototype.hasOwnProperty.call(previous, normalizedAliasName)
      ) {
        return previous;
      }
      const nextLinks = { ...previous };
      delete nextLinks[normalizedAliasName];
      return nextLinks;
    });
  }, []);

  const persistAliasScanCheckpoint = useCallback(
    (ownerAddress: string, checkpoint: AliasScanCheckpoint, seen: string[]) => {
      if (!ownerAddress) return;
      writeAliasScanCheckpointToStorage(ownerAddress, checkpoint);
      writeAliasScanSeenToStorage(ownerAddress, seen);
      if (ownerAddress === watchedAliasOwnerAddress) {
        setAliasScanCheckpointTimestamp(checkpoint.lastProcessedTimestamp);
      }
    },
    [watchedAliasOwnerAddress]
  );

  const cancelAliasScan = useCallback(() => {
    if (!isAliasScanRunning) return;
    aliasScanCancelRequestedRef.current = true;
    setIsAliasScanCancelRequested(true);
    setAliasScanStatusMessage("Cancel requested... finishing current item.");
  }, [isAliasScanRunning]);

  /**
   * N9: one capped run (50 per page, ALIAS_SCAN_MAX_PAGES pages), newest
   * first, from the stored checkpoint; "Scan more" simply runs it again.
   * Pages are cached for the session; only candidates never fetched before
   * are fetched and decrypted (aliasScan.ts).
   */
  const runAliasScan = useCallback(async () => {
    if (!hasAuthenticatedIdentity) {
      dispatch(
        setNotification({
          msg: "Sign in before running the alias scan",
          alertType: "error",
        })
      );
      return;
    }
    if (!watchedAliasOwnerAddress) {
      dispatch(
        setNotification({
          msg: "Cannot run alias scan without a wallet address",
          alertType: "error",
        })
      );
      return;
    }
    if (isAliasScanRunning) {
      return;
    }

    const ownerAddress = watchedAliasOwnerAddress;
    const checkpoint = readAliasScanCheckpointFromStorage(ownerAddress);
    const ownedNameSet = new Set(
      ownedNameCandidates.map(name => name.trim().toLowerCase()).filter(Boolean)
    );
    const knownAliases = new Set(
      watchedAliases.map(aliasName => aliasName.trim().toLowerCase()).filter(Boolean)
    );

    aliasScanCancelRequestedRef.current = false;
    setIsAliasScanCancelRequested(false);
    setIsAliasScanRunning(true);
    setAliasScanPhase("scanning");
    setAliasScanScannedCount(0);
    setAliasScanTotalCount(ALIAS_SCAN_MAX_PAGES);
    setAliasScanDiscoveredCount(0);
    setAliasScanPaging(previous => ({
      ...previous,
      resourcesWalked: 0,
      candidatesChecked: 0,
      maxPages: ALIAS_SCAN_MAX_PAGES,
      stoppedAtCap: false,
    }));
    setAliasScanStatusMessage(
      checkpoint && checkpoint.lastProcessedTimestamp > 0
        ? `Checking mail since ${formatFullTimestamp(checkpoint.lastProcessedTimestamp)}, then older mail...`
        : "Reading the newest Q-Mail resources..."
    );

    try {
      const result = await runAliasScanPass({
        checkpoint,
        seen: readAliasScanSeenFromStorage(ownerAddress),
        ownedNames: ownedNameSet,
        knownAliases,
        maxPages: ALIAS_SCAN_MAX_PAGES,
        search: (offset, limit) =>
          searchResources(aliasScanSearchParams(offset, limit), {
            ttlMs: ALIAS_SCAN_SEARCH_TTL_MS,
          }),
        inspect: async candidate => {
          const encryptedData = await qortalRequest({
            action: "FETCH_QDN_RESOURCE",
            name: candidate.name,
            service: MAIL_SERVICE_TYPE,
            identifier: candidate.identifier,
            encoding: "base64",
          });
          const decryptRequestBody: any = {
            action: "DECRYPT_DATA",
            encryptedData,
          };
          const decryptedData = await qortalRequest(decryptRequestBody);
          return uint8ArrayToObject(base64ToUint8Array(decryptedData));
        },
        isCancelled: () => aliasScanCancelRequestedRef.current,
        onProgress: progress => {
          setAliasScanScannedCount(progress.pagesFetched);
          setAliasScanDiscoveredCount(progress.discovered);
          setAliasScanPaging(previous => ({
            ...previous,
            resourcesWalked: progress.resourcesWalked,
            candidatesChecked: progress.candidatesChecked,
          }));
          setAliasScanStatusMessage(
            `Page ${progress.pagesFetched} of ${progress.maxPages}: ${progress.resourcesWalked} resources read, ${progress.candidatesChecked} alias messages checked`
          );
        },
        onCheckpoint: (nextCheckpoint, seen) =>
          persistAliasScanCheckpoint(ownerAddress, nextCheckpoint, seen),
      });

      setAliasScanPaging(previous => ({
        ...previous,
        complete: result.checkpoint.complete,
        stoppedAtCap: result.stoppedBy === "cap",
      }));

      const newlyDiscoveredAliases = Array.from(result.discoveredAliases.values());
      if (newlyDiscoveredAliases.length > 0) {
        setWatchedAliases(previous => {
          const deduped = new Map<string, string>();
          [...previous, ...newlyDiscoveredAliases].forEach(aliasName => {
            const normalizedAlias = aliasName.trim().toLowerCase();
            if (!normalizedAlias || deduped.has(normalizedAlias)) return;
            deduped.set(normalizedAlias, aliasName.trim());
          });
          return Array.from(deduped.values()).sort((a, b) => {
            return a.localeCompare(b, undefined, { sensitivity: "base" });
          });
        });
      }

      const found =
        newlyDiscoveredAliases.length > 0
          ? `found ${newlyDiscoveredAliases.length} new ${newlyDiscoveredAliases.length === 1 ? "alias" : "aliases"}`
          : "no new aliases";
      const completionMessage =
        result.stoppedBy === "cancel"
          ? `Alias scan canceled: ${found}. Scan more to continue.`
          : result.stoppedBy === "cap"
          ? `Read ${result.resourcesWalked} resources (the limit for one run): ${found}. Scan more to continue with older mail.`
          : `Alias scan complete: ${found}.`;
      setAliasScanStatusMessage(completionMessage);
      dispatch(
        setNotification({
          msg: completionMessage,
          alertType: result.stoppedBy === "cancel" ? "info" : "success",
        })
      );
    } catch (error: any) {
      const message =
        typeof error?.message === "string"
          ? error.message
          : "Alias scan failed";
      setAliasScanStatusMessage(message);
      dispatch(
        setNotification({
          msg: message,
          alertType: "error",
        })
      );
    } finally {
      setIsAliasScanRunning(false);
      setAliasScanPhase("idle");
      setIsAliasScanCancelRequested(false);
      aliasScanCancelRequestedRef.current = false;
    }
  }, [
    dispatch,
    hasAuthenticatedIdentity,
    isAliasScanRunning,
    ownedNameCandidates,
    persistAliasScanCheckpoint,
    watchedAliases,
    watchedAliasOwnerAddress,
  ]);

  const localMailStateById = useMemo(() => {
    const collectedState: Record<string, QMailPublishedStateEntry> = {};

    const collectFromMessage = (message: any) => {
      const identifier = getMessageIdentifier(message);
      if (!identifier) return;

      const relatedHashMessage: any = hashMapMailMessages[identifier] || {};
      const readEntry = readState[identifier];
      const isRead =
        typeof readEntry === "number"
          ? readEntry > 0
          : hasThreadHistory(message) || hasThreadHistory(relatedHashMessage);

      const subjectCandidates = [
        relatedHashMessage?.subject,
        message?.subject,
      ].filter(value => typeof value === "string") as string[];
      const subject =
        subjectCandidates.find(value => value.trim().length > 0)?.trim() || "";

      if (!isRead && !subject) return;
      collectedState[identifier] = mergePublishedStateEntries(
        collectedState[identifier],
        {
          read: isRead || undefined,
          subject: subject || undefined,
        }
      );
    };

    mailMessages.forEach(collectFromMessage);
    Object.values(combinedAliasInboxMessages).forEach(messages => {
      messages.forEach(collectFromMessage);
    });
    Object.values(hashMapMailMessages).forEach(collectFromMessage);

    return collectedState;
  }, [combinedAliasInboxMessages, hashMapMailMessages, mailMessages, readState]);

  const hasPendingStateChanges = useMemo(() => {
    return Object.keys(localMailStateById).some(identifier => {
      return !isLocalEntryPublished(
        localMailStateById[identifier],
        publishedMailStateById[identifier]
      );
    });
  }, [localMailStateById, publishedMailStateById]);

  const markMessagesAsRead = useCallback(
    async (messages: any[]) => {
      if (!messages.length) return;
      try {
        const readIdentifiers = messages
          .map(message => getMessageIdentifier(message))
          .filter(Boolean);
        if (!readIdentifiers.length) return;

        // The read store (src/utils/readState.ts) is the only source of truth;
        // list copies keep their real generalData.threadV2 (Bugs #5).
        dispatch(markRead({ ids: readIdentifiers }));
      } catch (error) {
        console.error("Failed to mark messages as read:", error);
      }
    },
    [dispatch]
  );

  useEffect(() => {
    markMessagesAsReadRef.current = markMessagesAsRead;
  }, [markMessagesAsRead]);

  const markMessagesAsUnread = useCallback(
    async (messages: any[]) => {
      if (!messages.length) return;
      try {
        const unreadIdentifiers = messages
          .map(message => getMessageIdentifier(message))
          .filter(Boolean);
        if (!unreadIdentifiers.length) return;

        dispatch(markUnread({ ids: unreadIdentifiers }));
      } catch (error) {
        console.error("Failed to mark messages as unread:", error);
      }
    },
    [dispatch]
  );

  const archiveMessages = useCallback(
    (messages: any[]) => {
      const ids = messages
        .map(message => getMessageIdentifier(message))
        .filter(Boolean);
      if (!ids.length) return;
      dispatch(archiveIds({ ids }));
    },
    [dispatch]
  );

  const unarchiveMessages = useCallback(
    (messages: any[]) => {
      const ids = messages
        .map(message => getMessageIdentifier(message))
        .filter(Boolean);
      if (!ids.length) return;
      dispatch(unarchiveIds({ ids }));
    },
    [dispatch]
  );

  const hasPendingArchivedChanges = useMemo(() => {
    return !haveSameArchivedIds(archived, publishedArchivedById);
  }, [archived, publishedArchivedById]);

  const publishMailStateToQdn = useCallback(async () => {
    if (!user?.name || !user?.address) return;
    try {
      setIsPublishingMailState(true);
      let base = {
        publishedEntries: publishedMailStateById,
        archived,
        watchedAliases,
        aliasReplyLinks,
      };
      if (!hasReadPublishedStateRef.current) {
        // Never loaded this session (declined, or still waiting on peers):
        // merge what other devices published instead of replacing it.
        let remote: ParsedPublishedState | null = null;
        try {
          remote = await readPublishedMailStateFromQdn(user.name);
        } catch {
          dispatch(
            setNotification({
              msg: "Couldn't read your published Q-Mail state, so publishing now would overwrite it. Try again when it has loaded.",
              alertType: "error",
            })
          );
          return;
        }
        base = mergeRemoteStateIntoPublishBase(base, remote);
        if (remote) {
          if (Object.keys(remote.archived).length) {
            dispatch(applyPublishedArchived(remote.archived));
          }
          if (base.watchedAliases !== watchedAliases) {
            setWatchedAliases(current =>
              mergeWatchedAliases(current, base.watchedAliases)
            );
          }
          if (base.aliasReplyLinks !== aliasReplyLinks) {
            setAliasReplyLinks(current =>
              mergeAliasReplyLinks(current, base.aliasReplyLinks)
            );
          }
        }
      }
      const { document: payload, mergedEntries: mergedStateEntries } =
        buildPublishedMailStateDocument({
          ownerAddress: user.address,
          names: ownedNameCandidates,
          publishedEntries: base.publishedEntries,
          localEntries: localMailStateById,
          archived: base.archived,
          // Additive: this device's appearance and alias lists (§16).
          settings: {
            uiTheme,
            textSize,
            watchedAliases: base.watchedAliases,
            aliasReplyLinks: base.aliasReplyLinks,
          },
        });
      const archivedToPublish: ArchivedMap = payload.archived || {};
      const encoded = await objectToBase64(payload);

      // Get user's public key for encryption
      const accountData = await qortalRequest({
        action: "GET_ACCOUNT_DATA",
        address: user.address,
      });
      const userPublicKey =
        typeof accountData?.publicKey === "string" ? accountData.publicKey : "";

      // Encrypt the data before publishing
      // const encryptedData = await qortalRequest({
      //   action: "ENCRYPT_DATA",
      //   data64: encoded,
      //   publicKeys: userPublicKey ? [userPublicKey] : [],
      // });

      await qortalRequest({
        action: "PUBLISH_QDN_RESOURCE",
        name: user.name,
        service: MAIL_STATE_DOCUMENT_SERVICE,
        identifier: MAIL_STATE_DOCUMENT_IDENTIFIER,
        data64: encoded,
        encrypt: true,
        publicKeys: userPublicKey ? [userPublicKey] : [],
      });

      invalidateSearches(`service=${MAIL_STATE_DOCUMENT_SERVICE}`);
      invalidateSearches("service=MAIL_PRIVATE");
      dispatch(
        setNotification({
          msg: "Published Q-Mail read state",
          alertType: "success",
        })
      );
      hasReadPublishedStateRef.current = true;
      setPublishedMailStateById(mergedStateEntries);
      setPublishedArchivedById(archivedToPublish);
      setPublishedAppearance({ uiTheme, textSize });
    } catch (error: unknown) {
      // Declining Hub's publish dialog is the user's choice, not an error (pitfall 11).
      if (!isHubDecline(error)) {
        dispatch(
          setNotification({
            msg: errorMessage(error, "Failed to publish Q-Mail state"),
            alertType: "error",
          })
        );
      }
    } finally {
      setIsPublishingMailState(false);
    }
  }, [
    aliasReplyLinks,
    archived,
    dispatch,
    localMailStateById,
    ownedNameCandidates,
    publishedMailStateById,
    textSize,
    uiTheme,
    user?.address,
    user?.name,
    watchedAliases,
  ]);

  // Settings → Sync uses the same publish path as the rail item.
  useEffect(() => {
    if (!hasAuthenticatedIdentity) {
      registerMailSync(null);
      return;
    }
    registerMailSync({
      publishMailState: publishMailStateToQdn,
      isPublishing: isPublishingMailState,
      hasPendingChanges: hasPendingStateChanges || hasPendingArchivedChanges,
      publishedAppearance,
    });
  }, [
    hasAuthenticatedIdentity,
    hasPendingArchivedChanges,
    hasPendingStateChanges,
    isPublishingMailState,
    publishMailStateToQdn,
    publishedAppearance,
    registerMailSync,
  ]);
  useEffect(() => {
    return () => {
      registerMailSync(null);
    };
  }, [registerMailSync]);

  const loadPublishedMailStateFromQdn = useCallback(async () => {
    if (!user?.name) return;
    const qdnIdentity = user?.address || user?.name || "";
    const shouldAutoApplyQdnState = readAutoApplyQdnState(qdnIdentity);
    setIsLoadingQdnState(true);
    try {
      const fetchPromise = qortalRequest({
        action: "FETCH_QDN_RESOURCE",
        name: user.name,
        service: MAIL_STATE_DOCUMENT_SERVICE,
        identifier: MAIL_STATE_DOCUMENT_IDENTIFIER,
        encoding: "base64",
      });

      void fetchPromise.catch(() => undefined);

      if (!shouldAutoApplyQdnState) {
        const searchParams = new URLSearchParams({
          mode: "ALL",
          service: MAIL_STATE_DOCUMENT_SERVICE,
          identifier: MAIL_STATE_DOCUMENT_IDENTIFIER,
          name: user.name,
          exactmatchnames: "true",
          limit: "1",
          includemetadata: "false",
          reverse: "true",
          excludeblocked: "true",
        });
        const searchData = await searchResources(searchParams);
        if (!searchData.length) {
          // Nothing published yet: a publish has nothing to merge.
          hasReadPublishedStateRef.current = true;
          return;
        }

        const shouldLoad = await showLoadPublishedStateModal();
        if (!shouldLoad) {
          return;
        }

        if (rememberQdnStatePreferenceRef.current) {
          writeAutoApplyQdnState(qdnIdentity, true);
        }
      }

      const encodedResource = await fetchPromise;
      if (!encodedResource) return;

      let decodedObject: any = null;
      try {
        const decryptRequestBody: any = {
          action: "DECRYPT_DATA",
          encryptedData: encodedResource,
        };
        const decrypted = await qortalRequest(decryptRequestBody);
        decodedObject = uint8ArrayToObject(base64ToUint8Array(decrypted));
      } catch {
        decodedObject = uint8ArrayToObject(base64ToUint8Array(encodedResource));
      }

      const parsed = parsePublishedMailStateDocument(decodedObject);
      hasReadPublishedStateRef.current = true;
      if (!parsed) return;
      const loadedArchived = parsed.archived;
      if (Object.keys(loadedArchived).length) {
        setPublishedArchivedById(loadedArchived);
        dispatch(applyPublishedArchived(loadedArchived));
      }
      // Additive settings: alias lists are unioned (local wins); the
      // appearance is only remembered for Settings → Sync → Restore.
      const loadedSettings = parsed.settings;
      if (loadedSettings) {
        if (loadedSettings.watchedAliases.length) {
          setWatchedAliases(current =>
            mergeWatchedAliases(current, loadedSettings.watchedAliases)
          );
        }
        if (Object.keys(loadedSettings.aliasReplyLinks).length) {
          setAliasReplyLinks(current =>
            mergeAliasReplyLinks(current, loadedSettings.aliasReplyLinks)
          );
        }
        if (loadedSettings.uiTheme || loadedSettings.textSize) {
          setPublishedAppearance({
            uiTheme: loadedSettings.uiTheme,
            textSize: loadedSettings.textSize,
          });
        }
      }
      const normalizedPublishedStateById = parsed.messages;

      if (!Object.keys(normalizedPublishedStateById).length) return;
      setPublishedMailStateById(normalizedPublishedStateById);
      dispatch(
        setNotification({
          msg: `Loaded published state for ${Object.keys(
            normalizedPublishedStateById
          ).length} messages`,
          alertType: "success",
        })
      );
    } catch {
      // Ignore missing resources and permission errors.
    } finally {
      setIsLoadingQdnState(false);
    }
  }, [
    dispatch,
    showLoadPublishedStateModal,
    user?.name,
    user?.address,
  ]);

  const renderAuthenticationPrompt = useCallback(
    (mailboxLabel: "Inbox" | "Sent" | "Threads" | "Aliases") => {
      return (
        <Box
          sx={{
            width: "100%",
            maxWidth: "640px",
            minHeight: "220px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "14px",
            padding: "24px 20px",
            textAlign: "center",
          }}
        >
          <Typography
            sx={{
              fontSize: "1.1rem",
              fontWeight: 600,
              color: "var(--qmail-thread-text)",
            }}
          >
            Sign in to view {mailboxLabel}
          </Typography>
          <Typography
            sx={{
              fontSize: "0.95rem",
              color: "var(--qmail-thread-subtle-text)",
            }}
          >
            Hub asks you to confirm, then your mail loads here.
          </Typography>
          <Button
            variant="contained"
            onClick={() => {
              executeEvent("qmail:authenticate", {});
            }}
            sx={{
              textTransform: "none",
              fontWeight: 600,
              borderRadius: "10px",
              padding: "8px 18px",
              backgroundColor: "var(--qmail-compose-button-bg)",
              border: "1px solid var(--qmail-compose-button-border)",
              color: "var(--qmail-thread-text)",
              "&:hover": {
                backgroundColor: "var(--qmail-compose-button-hover-bg)",
                borderColor: "var(--qmail-shell-border)",
              },
            }}
          >
            Sign in
          </Button>
        </Box>
      );
    },
    []
  );

  const { byGroup: threadUnreadByGroup } = useThreadUnreadCounts(
    groupOptionsWithThreads,
    user?.name,
    { enabled: hasAuthenticatedIdentity }
  );
  const sidebarItems = useMemo(() => {
    return buildSidebarItems({
      inboxNames: hasAuthenticatedIdentity ? inboxSidebarNames : [],
      aliasesNames: hasAuthenticatedIdentity ? aliasSidebarNames : [],
      aliasReplyLinks: hasAuthenticatedIdentity ? aliasReplyLinks : {},
      sentNames: hasAuthenticatedIdentity ? ownedSentNames : [],
      threadGroups: hasAuthenticatedIdentity ? groupOptionsWithThreads : [],
      isThreadsSectionExpanded,
      selectedAliasInboxName: hasAuthenticatedIdentity
        ? selectedAliasInboxName
        : null,
      primaryName: user?.name,
      canPublishState: hasAuthenticatedIdentity,
      isPublishingState: isPublishingMailState,
      hasPendingStateChanges: hasPendingStateChanges || hasPendingArchivedChanges,
      unreadCounts,
      threadUnreadByGroup,
    });
  }, [
    threadUnreadByGroup,
    aliasSidebarNames,
    aliasReplyLinks,
    groupOptionsWithThreads,
    hasAuthenticatedIdentity,
    hasPendingArchivedChanges,
    hasPendingStateChanges,
    inboxSidebarNames,
    isThreadsSectionExpanded,
    isPublishingMailState,
    ownedSentNames,
    selectedAliasInboxName,
    unreadCounts,
    user?.name,
  ]);
  const onSelectSidebarItem = useCallback(
    (itemId: string) => {
      const closeSidebarIfTransient = () => {
        setRailOpen(false);
      };
      // Switching view drops an opener that is still waiting on peers.
      cancelPendingOpenRef.current();

      if (itemId !== "compose") {
        setComposePrefill(null);
        setComposeReturnView("inbox");
        setComposeReturnGroupId(null);
        setComposeRecipientAlias(null);
        setComposeRequireReplyAlias(false);
        setComposeDefaultReplyAlias("");
        setComposeMode("standard");
      }

      if (itemId === "compose") {
        setActiveMailboxItem("compose");
        setComposePrefill(null);
        setComposeReturnView("inbox");
        setComposeReturnGroupId(null);
        setComposeMode("standard");
        setReplyTo(null);
        setForwardInfo(null);
        setSelectedAlias(null);
        setSelectedAliasScope(null);
        setSelectedGroup(null);
        setCurrentThread(null);
        setIsOpen(false);
        setMessage(null);
        closeSidebarIfTransient();
        return;
      }

      if (itemId === ALIAS_COMPOSE_ITEM_ID) {
        const normalizedAliasInboxName = (selectedAliasInboxName || "").trim();
        const linkedReplyAlias = normalizedAliasInboxName
          ? aliasReplyLinks[normalizedAliasInboxName.toLowerCase()] || ""
          : "";
        if (!normalizedAliasInboxName) return;

        setActiveMailboxItem("compose");
        setComposePrefill(null);
        setComposeReturnView("inbox");
        setComposeReturnGroupId(null);
        setComposeRecipientAlias(null);
        setComposeRequireReplyAlias(true);
        setComposeDefaultReplyAlias(linkedReplyAlias);
        setComposeMode("alias");
        setReplyTo(null);
        setForwardInfo(null);
        setSelectedGroup(null);
        setCurrentThread(null);
        setIsOpen(false);
        setMessage(null);
        closeSidebarIfTransient();
        return;
      }

      if (itemId === PUBLISH_STATE_ITEM_ID) {
        void publishMailStateToQdn();
        closeSidebarIfTransient();
        return;
      }

      const inboxInstanceName = parseSidebarInstanceNameFromItemId(
        itemId,
        INBOX_INSTANCE_ITEM_PREFIX
      );
      if (inboxInstanceName) {
        setActiveMailboxItem("inbox");
        setSelectedAlias(inboxInstanceName);
        setSelectedAliasScope("inbox");
        setSelectedGroup(null);
        setCurrentThread(null);
        setIsOpen(false);
        setMessage(null);
        closeSidebarIfTransient();
        return;
      }

      const aliasesInstanceName = parseSidebarInstanceNameFromItemId(
        itemId,
        ALIASES_INSTANCE_ITEM_PREFIX
      );
      if (aliasesInstanceName) {
        setActiveMailboxItem("aliases");
        setSelectedAlias(aliasesInstanceName);
        setSelectedAliasScope("aliases");
        setSelectedGroup(null);
        setCurrentThread(null);
        setIsOpen(false);
        setMessage(null);
        closeSidebarIfTransient();
        return;
      }

      const sentInstanceName = parseSidebarInstanceNameFromItemId(
        itemId,
        SENT_INSTANCE_ITEM_PREFIX
      );
      if (sentInstanceName) {
        setActiveMailboxItem("sent");
        setSelectedAlias(sentInstanceName);
        setSelectedAliasScope("sent");
        setSelectedGroup(null);
        setCurrentThread(null);
        setIsOpen(false);
        setMessage(null);
        closeSidebarIfTransient();
        return;
      }

      const threadGroupId = parseSidebarGroupIdFromItemId(itemId);
      if (threadGroupId) {
        const groupInfo = groupOptionsById.get(threadGroupId);
        if (!groupInfo) return;
        setIsThreadsSectionExpanded(true);
        setActiveMailboxItem("threads");
        setSelectedAlias(null);
        setSelectedAliasScope(null);
        setSelectedGroup(groupInfo);
        setCurrentThread(null);
        setIsOpen(false);
        setMessage(null);
        closeSidebarIfTransient();
        return;
      }

      if (itemId === "threads") {
        setIsThreadsSectionExpanded(prev => !prev);
        setActiveMailboxItem("threads");
        setSelectedAlias(null);
        setSelectedAliasScope(null);
        setSelectedGroup(null);
        setCurrentThread(null);
        setIsOpen(false);
        setMessage(null);
        closeSidebarIfTransient();
        return;
      }

      if (itemId === "aliases") {
        setActiveMailboxItem("aliases");
        setSelectedAlias(null);
        setSelectedAliasScope(null);
        setSelectedGroup(null);
        setCurrentThread(null);
        setIsOpen(false);
        setMessage(null);
        closeSidebarIfTransient();
        return;
      }

      if (itemId === ARCHIVED_ITEM_ID) {
        setActiveMailboxItem("archived");
        setSelectedAlias(null);
        setSelectedAliasScope(null);
        setSelectedGroup(null);
        setCurrentThread(null);
        setIsOpen(false);
        setMessage(null);
        closeSidebarIfTransient();
        return;
      }

      if (itemId === "inbox" || itemId === "sent" || itemId === "drafts") {
        setActiveMailboxItem(itemId);
        setSelectedAlias(null);
        setSelectedAliasScope(null);
        setSelectedGroup(null);
        setCurrentThread(null);
        setIsOpen(false);
        setMessage(null);
        closeSidebarIfTransient();
      }
    },
    [
      aliasReplyLinks,
      groupOptionsById,
      publishMailStateToQdn,
      selectedAliasInboxName,
    ]
  );

  useEffect(() => {
    hasReadPublishedStateRef.current = false;
    setPublishedMailStateById({});
    setPublishedArchivedById({});
    setPublishedAppearance(null);
  }, [user?.address, user?.name]);

  useEffect(() => {
    rememberQdnStatePreferenceRef.current = false;
    setRememberQdnStatePreferenceOnLoad(false);
  }, [user?.address, user?.name]);

  // Loaded document → read store (only ids with no local decision, see readState.ts).
  useEffect(() => {
    const readIds = Object.entries(publishedMailStateById)
      .filter(([identifier, entry]) => Boolean(identifier) && Boolean(entry?.read))
      .map(([identifier]) => identifier);
    if (!readIds.length) return;
    dispatch(applyPublishedReadState({ ids: readIds }));
  }, [dispatch, publishedMailStateById]);

  useEffect(() => {
    const identityKey = `${user?.name || ""}:${user?.address || ""}`;
    if (!hasAuthenticatedIdentity || !identityKey) {
      hasPromptedForPublishedMailStateRef.current = null;
      return;
    }
    if (hasPromptedForPublishedMailStateRef.current === identityKey) return;
    hasPromptedForPublishedMailStateRef.current = identityKey;
    void loadPublishedMailStateFromQdn();
  }, [
    hasAuthenticatedIdentity,
    loadPublishedMailStateFromQdn,
    user?.address,
    user?.name,
  ]);


  const sidebarItemIdSet = useMemo(() => {
    return new Set(sidebarItems.map(item => item.id));
  }, [sidebarItems]);

  const activeSidebarItem = useMemo(() => {
    if (activeMailboxItem === "compose") {
      return composeMode === "alias" ? ALIAS_COMPOSE_ITEM_ID : "compose";
    }
    if (activeMailboxItem === "aliases") {
      if (selectedAlias && selectedAliasScope === "aliases") {
        const aliasItemId = createAliasesInstanceItemId(selectedAlias);
        return sidebarItemIdSet.has(aliasItemId) ? aliasItemId : "aliases";
      }
      return "aliases";
    }
    if (activeMailboxItem === "threads") {
      if (!selectedGroup?.id || !isThreadsSectionExpanded) {
        return "threads";
      }
      const groupItemId = createThreadGroupItemId(selectedGroup.id);
      return sidebarItemIdSet.has(groupItemId) ? groupItemId : "threads";
    }
    if (
      activeMailboxItem === "inbox" &&
      selectedAlias &&
      selectedAliasScope === "inbox"
    ) {
      const instanceItemId = createInboxInstanceItemId(selectedAlias);
      return sidebarItemIdSet.has(instanceItemId) ? instanceItemId : "inbox";
    }
    if (
      activeMailboxItem === "sent" &&
      selectedAlias &&
      selectedAliasScope === "sent"
    ) {
      const instanceItemId = createSentInstanceItemId(selectedAlias);
      return sidebarItemIdSet.has(instanceItemId) ? instanceItemId : "sent";
    }
    return activeMailboxItem;
  }, [
    activeMailboxItem,
    composeMode,
    isThreadsSectionExpanded,
    selectedAlias,
    selectedAliasScope,
    selectedGroup,
    sidebarItemIdSet,
  ]);


  const sentInstanceNamesForCurrentView = useMemo(() => {
    if (selectedSentInstanceName) {
      const selectedAliasNormalized = selectedSentInstanceName.toLowerCase();
      const hasSentMailboxForAlias = ownedSentNames.some(name => {
        return name.toLowerCase() === selectedAliasNormalized;
      });
      if (!hasSentMailboxForAlias) {
        return ownedSentNames;
      }
      return [selectedSentInstanceName];
    }
    return ownedSentNames;
  }, [ownedSentNames, selectedSentInstanceName]);

  const isMailBootstrapLoading =
    isLoading || isLoadingCombinedAliasInbox || isLoadingQdnState;

  const openSettings = useCallback(() => {
    navigate(SETTINGS_PATH, { state: { backgroundLocation: location } });
  }, [location, navigate]);

  const closeOpenMessage = useCallback(() => {
    cancelPendingOpenRef.current();
    setIsOpen(false);
    setMessage(null);
  }, []);

  const handleComposerClose = useCallback(() => {
    const shouldReturnToAliasInbox =
      composeMode === "alias" && Boolean(selectedAliasInboxName);
    setComposeRecipientAlias(null);
    setComposeRequireReplyAlias(false);
    setComposeDefaultReplyAlias("");
    setComposeMode("standard");
    setComposeReplyAll(false);
    if (composeReturnView === "threads") {
      setActiveMailboxItem("threads");
      invalidateThreadSearches(composeReturnGroupId || undefined);
      if (composeReturnGroupId) {
        const returnGroup = groupOptionsById.get(composeReturnGroupId);
        if (returnGroup) {
          setSelectedGroup(returnGroup);
        }
      }
    } else if (shouldReturnToAliasInbox) {
      setActiveMailboxItem("aliases");
      setSelectedAlias(selectedAliasInboxName);
      setSelectedAliasScope("aliases");
    } else {
      setActiveMailboxItem("inbox");
      setSelectedAlias(null);
      setSelectedAliasScope(null);
    }
    setComposePrefill(null);
    setComposeReturnView("inbox");
    setComposeReturnGroupId(null);
  }, [
    composeMode,
    composeReturnGroupId,
    composeReturnView,
    groupOptionsById,
    selectedAliasInboxName,
  ]);

  const isDesktopLayout = layoutMode === "desktop";
  const isReadingOpen = Boolean(isOpen && message);
  const isComposeView = activeMailboxItem === "compose";
  const isThreadsView = activeMailboxItem === "threads";

  // ---- keyboard shortcuts (desktop only; src/hooks/useKeyboardShortcuts.ts)
  // j/k move through the list the pane shows (the inbox search results or
  // the archived list) by opening the next/previous message in the reading
  // pane; the other lists live in their own components.
  const shortcutList: any[] = isInboxViewActive
    ? inboxSearchResults
    : isArchivedViewActive
    ? archivedMessages
    : [];
  const openMessageFromList = (item: any) => {
    const id = item?.id || item?.identifier;
    if (!id) return;
    void openMessage(item?.user, id, item, undefined);
  };
  const openAdjacentMessage = (step: 1 | -1) => {
    if (!shortcutList.length) return;
    const openedId = message?.id || message?.identifier;
    const index = openedId
      ? shortcutList.findIndex(item => (item?.id || item?.identifier) === openedId)
      : -1;
    const nextIndex = index === -1 ? (step === 1 ? 0 : shortcutList.length - 1) : index + step;
    const next = shortcutList[nextIndex];
    if (next) openMessageFromList(next);
  };
  useKeyboardShortcuts(
    {
      compose: () => {
        // Already composing: "c" must not drop the reply or forward context.
        if (isComposeView) return false;
        onSelectSidebarItem("compose");
      },
      reply: () => {
        if (!isReadingOpen) return false;
        openReplyComposerFromMessage(message);
      },
      replyAll: () => {
        if (!isReadingOpen) return false;
        openReplyComposerFromMessage(message, { replyAll: true });
      },
      forward: () => {
        if (!isReadingOpen) return false;
        openForwardComposerFromMessage(message);
      },
      archive: () => {
        if (!isReadingOpen || !(isInboxViewActive || isArchivedViewActive)) return false;
        if (isArchivedViewActive) unarchiveMessages([message]);
        else archiveMessages([message]);
        closeOpenMessage();
      },
      markUnread: () => {
        if (!isReadingOpen) return false;
        void markMessagesAsUnread([message]);
        closeOpenMessage();
      },
      next: () => {
        if (!shortcutList.length) return false;
        openAdjacentMessage(1);
      },
      previous: () => {
        if (!shortcutList.length) return false;
        openAdjacentMessage(-1);
      },
      open: () => {
        if (isReadingOpen || !shortcutList.length) return false;
        openMessageFromList(shortcutList[0]);
      },
      close: () => {
        if (shortcutsHelpOpen) setShortcutsHelpOpen(false);
        else if (isComposeView) handleComposerClose();
        else if (isReadingOpen) closeOpenMessage();
        else return false;
      },
      focusSearch: () => {
        const input = document.querySelector<HTMLInputElement>(
          '[aria-label="Messages"] input[aria-label^="Search"]'
        );
        input?.focus();
        input?.select();
      },
      goInbox: () => onSelectSidebarItem("inbox"),
      goSent: () => onSelectSidebarItem("sent"),
      goThreads: () => onSelectSidebarItem("threads"),
      goAliases: () => onSelectSidebarItem("aliases"),
      showHelp: () => setShortcutsHelpOpen(open => !open),
    },
    // Off while Settings covers the page: keys must not act on the hidden mailbox.
    { enabled: isDesktopLayout && hasAuthenticatedIdentity && !isHidden }
  );

  const menuButton = !isDesktopLayout ? (
    <IconButton
      onClick={() => setRailOpen(true)}
      aria-label="Open mailboxes menu"
      size="large"
      sx={{ minWidth: 44, minHeight: 44 }}
    >
      <MenuIcon />
    </IconButton>
  ) : undefined;
  const settingsButton = !isDesktopLayout ? (
    <IconButton onClick={openSettings} aria-label="Settings" size="large" sx={{ minWidth: 44, minHeight: 44 }}>
      <SettingsOutlinedIcon />
    </IconButton>
  ) : undefined;

  const centeredColumnSx = {
    display: "flex",
    width: "100%",
    flexDirection: "column",
    alignItems: "center",
  } as const;

  // ---- list pane -----------------------------------------------------------
  let listTitle = "Inbox";
  let listSubtitle: string | undefined = user?.name || undefined;
  let listBack: (() => void) | undefined;
  let listBody: React.ReactNode;
  if (isSentViewActive) {
    listTitle = selectedSentInstanceName || "Sent";
    listSubtitle = selectedSentInstanceName ? "Sent" : user?.name || undefined;
    listBody = hasAuthenticatedIdentity ? (
      <SentMail
        instanceNames={sentInstanceNamesForCurrentView}
        onOpen={openMessage}
        openedMessageId={message?.id || message?.identifier}
        onCompose={() => onSelectSidebarItem("compose")}
        searchQuery={inboxSearchQuery}
        bodySearchLimit={bodySearchLimit}
        onSearchStatus={setMailboxSearchStatus}
      />
    ) : (
      renderAuthenticationPrompt("Sent")
    );
  } else if (isAliasesViewActive && activeAliasInboxName) {
    listTitle = activeAliasInboxName;
    listSubtitle = "Alias inbox";
    listBack = () => {
      setSelectedAlias(null);
      setSelectedAliasScope(null);
      closeOpenMessage();
    };
    listBody = hasAuthenticatedIdentity ? (
      <AliasMail
        value={activeAliasInboxName}
        onOpen={openMessage}
        messageOpenedId={message?.id || message?.identifier}
        onMessagesLoaded={handleAliasMessagesLoaded}
        onMarkAsRead={markMessagesAsRead}
        onMarkAsUnread={markMessagesAsUnread}
        onArchive={archiveMessages}
        searchQuery={inboxSearchQuery}
        bodySearchLimit={bodySearchLimit}
        onSearchStatus={setMailboxSearchStatus}
      />
    ) : (
      renderAuthenticationPrompt("Aliases")
    );
  } else if (isArchivedViewActive) {
    listTitle = "Archived";
    listSubtitle = user?.name || undefined;
    listBack = () => {
      onSelectSidebarItem("inbox");
    };
    listBody = hasAuthenticatedIdentity ? (
      <GroupedMailboxList
        messages={inboxSearchResults}
        mailboxType="inbox"
        showSelectAll
        openMessage={openMessage}
        openedMessageId={message?.id || message?.identifier}
        onMarkAsRead={markMessagesAsRead}
        onMarkAsUnread={markMessagesAsUnread}
        onUnarchive={unarchiveMessages}
        status={isLoading && !archivedForList.length ? "loading" : "ready"}
        highlightTerms={inboxSearchStatus.terms}
        emptyIcon={<ArchiveOutlinedIcon />}
        emptyTitle={hasSearchQuery ? "No matches" : "Nothing archived"}
        emptyHint={
          hasSearchQuery
            ? "Try fewer words, or search message bodies."
            : "Select messages in the inbox and choose Archive to tidy them away. They stay on QDN."
        }
        emptyAction={
          hasSearchQuery ? undefined : (
            <Button variant="outlined" onClick={() => onSelectSidebarItem("inbox")} sx={{ minHeight: 44 }}>
              Back to inbox
            </Button>
          )
        }
      />
    ) : (
      renderAuthenticationPrompt("Inbox")
    );
  } else if (isThreadsView) {
    const selectedGroupName =
      typeof selectedGroup?.name === "string" && selectedGroup.name.trim()
        ? selectedGroup.name.trim()
        : "";
    listTitle = selectedGroupName || "Threads";
    listSubtitle = selectedGroupName ? "Group threads" : "Group mail";
    listBack = selectedGroup
      ? () => {
          setSelectedGroup(null);
          setCurrentThread(null);
        }
      : undefined;
    listBody = hasAuthenticatedIdentity ? (
      <ThreadsMailbox
        groups={groupOptionsWithThreads}
        joinedGroups={memberGroupOptions}
        groupAvatarUrlById={groupAvatarUrlById}
        isLoadingGroups={isLoadingGroupInstances}
        selectedGroup={selectedGroup}
        onSelectGroup={group => {
          setSelectedGroup(group);
          setCurrentThread(null);
        }}
        currentThreadId={currentThread?.threadId || currentThread?.identifier || null}
        onOpenThread={(thread, group) => {
          setSelectedGroup(group);
          setCurrentThread(thread);
          closeOpenMessage();
        }}
        onRequestComposeThread={handleRequestComposeThread}
        filterMode={filterMode}
        setFilterMode={setFilterMode}
      />
    ) : (
      renderAuthenticationPrompt("Threads")
    );
  } else if (activeMailboxItem === "drafts") {
    listTitle = "Drafts";
    listSubtitle = "Saved on this device";
    listBody = hasAuthenticatedIdentity ? (
      <DraftsMailbox
        address={user?.address || ""}
        onOpenDraft={handleOpenDraft}
      />
    ) : (
      renderAuthenticationPrompt("Inbox")
    );
  } else {
    listTitle = selectedInboxInstanceName || "Inbox";
    listSubtitle = selectedInboxInstanceName ? "Inbox" : user?.name || undefined;
    listBody = hasAuthenticatedIdentity ? (
      <>
        <GroupedMailboxList
          messages={inboxSearchResults}
          mailboxType="inbox"
          showSelectAll
          openMessage={openMessage}
          openedMessageId={message?.id || message?.identifier}
          onMarkAsRead={markMessagesAsRead}
          onMarkAsUnread={markMessagesAsUnread}
          onArchive={archiveMessages}
          highlightTerms={inboxSearchStatus.terms}
          status={
            isLoading ||
            (isLoadingCombinedAliasInbox &&
              (!selectedInboxInstanceName ||
                !combinedAliasInboxMessages[selectedInboxInstanceName]))
              ? "loading"
              : inboxLoadError
                ? "error"
                : "ready"
          }
          errorMessage={inboxLoadError || undefined}
          onRetry={() => void getMessages(true)}
          emptyTitle={hasSearchQuery ? "No matches" : "No mail yet"}
          emptyHint={
            hasSearchQuery
              ? "Try fewer words, or search message bodies."
              : `Mail sent to ${selectedInboxInstanceName || user?.name || "you"} shows up here.`
          }
          emptyAction={
            hasSearchQuery ? undefined : (
              <Button
                variant="contained"
                onClick={() => onSelectSidebarItem("compose")}
                sx={{ minHeight: 44 }}
              >
                Compose
              </Button>
            )
          }
        />
      </>
    ) : (
      renderAuthenticationPrompt("Inbox")
    );
  }

  // A hit of the cross-mailbox search opens in its own mailbox.
  const openSearchResult = (hit: any) => {
    const ref = mailboxRefOf(hit);
    const id = getMessageIdentifier(hit);
    if (!id) return;
    if (ref?.kind === "sent") {
      onSelectSidebarItem("sent");
      const decrypted: any = hashMapMailMessages[id];
      const recipient =
        typeof decrypted?.recipient === "string" && decrypted.recipient.trim()
          ? decrypted.recipient.trim()
          : getSentRecipientDisplayLabel(id);
      void openMessage(hit?.user, id, hit, recipient, { autoMarkRead: false });
      return;
    }
    if (ref?.kind === "alias" && ref.alias) {
      onSelectSidebarItem(createAliasesInstanceItemId(ref.alias));
    } else if (ref?.kind === "archived") {
      onSelectSidebarItem(ARCHIVED_ITEM_ID);
    } else {
      onSelectSidebarItem("inbox");
    }
    // Inbox and alias hits are marked read, as a normal open there is.
    void openMessage(hit?.user, id, hit, undefined, {
      autoMarkRead: ref?.kind !== "archived",
    });
  };

  const searchPlaceholder = isSentViewActive
    ? "Search sent mail"
    : isArchivedViewActive
      ? "Search archived mail"
      : isAliasesViewActive && activeAliasInboxName
        ? `Search ${activeAliasInboxName}`
        : "Search mail";

  const listPane = (
    <>
      <PaneHeader
        title={listTitle}
        subtitle={listSubtitle}
        onBack={listBack}
        leading={menuButton}
        actions={settingsButton}
      />
      {isMailboxSearchView && hasAuthenticatedIdentity && (
        <MailboxSearchBar
          value={inboxSearchQuery}
          onChange={setInboxSearchQuery}
          placeholder={searchPlaceholder}
          status={activeSearchStatus}
          scope={searchScope}
          onScopeChange={setSearchScope}
          onSearchBodies={() =>
            setBodySearchLimit(limit => limit + BODY_SEARCH_STEP)
          }
          bodyStep={BODY_SEARCH_STEP}
          isLoadingScope={isAllMailSearch && isLoadingAllMail}
        />
      )}
      <PaneScroll>
        <Box className="step-1" sx={centeredColumnSx}>
          {isAllMailSearch ? (
            <SearchResultsList
              hits={allMailResults}
              terms={allMailStatus.terms}
              status={isLoadingAllMail && !allMailRows.length ? "loading" : "ready"}
              openedMessageId={message?.id || message?.identifier}
              onOpen={openSearchResult}
            />
          ) : (
            <React.Suspense fallback={<ListSkeleton />}>{listBody}</React.Suspense>
          )}
        </Box>
      </PaneScroll>
    </>
  );

  // ---- reading pane --------------------------------------------------------
  // A message still being fetched/decrypted shows in the reading pane too
  // (shared FetchingFromPeers state, full-screen on phones), not in a modal.
  const isOpeningMessage = Boolean(mailInfo) && isShow;
  const readingPane = isReadingOpen ? (
    <>
      {isOnePane && (
        <PaneHeader
          title={message?.subject || "Message"}
          subtitle={message?.user}
          onBack={closeOpenMessage}
          backLabel="Back to messages"
        />
      )}
      <PaneScroll>
        <Box sx={centeredColumnSx}>
          <React.Suspense fallback={<ListSkeleton rows={4} />}>
          <ShowMessageV2
            isOpen={isOpen}
            setIsOpen={setIsOpen}
            message={message}
            setReplyTo={openReplyComposerFromMessage}
            setForwardInfo={openForwardComposerFromMessage}
            onReplyAll={replyAllMessage =>
              openReplyComposerFromMessage(replyAllMessage, { replyAll: true })
            }
            onForward={info => openForwardComposerFromMessage(info.message)}
            alias={activeAliasInboxName}
            onClose={closeOpenMessage}
          />
          </React.Suspense>
        </Box>
      </PaneScroll>
    </>
  ) : isOpeningMessage ? (
    <>
      {isOnePane && (
        <PaneHeader
          title="Opening message"
          subtitle={mailInfo?.name}
          onBack={() => onOk(undefined)}
          backLabel="Back to messages"
        />
      )}
      <PaneScroll>
        <Box sx={centeredColumnSx}>
          <OpenMail open={isShow} handleClose={onOk} fileInfo={mailInfo} />
        </Box>
      </PaneScroll>
    </>
  ) : null;

  const readingPlaceholder = (
    <Box sx={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <EmptyState
        icon={<MailOutlineIcon />}
        title={isThreadsView ? "Select a thread" : "Select a message"}
        hint={isThreadsView ? "Threads you open show up here." : "Messages you open show up here."}
      />
    </Box>
  );

  // ---- thread reading pane (group threads open like a message) --------------
  const threadReadingPane =
    isThreadsView && currentThread && hasAuthenticatedIdentity ? (
      <React.Suspense fallback={<ListSkeleton rows={4} />}>
      <Thread
        key={currentThread?.threadId || currentThread?.identifier}
        currentThread={currentThread}
        groupInfo={selectedGroup || { id: currentThread?.threadData?.groupId, name: currentThread?.groupName }}
        closeThread={() => setCurrentThread(null)}
      />
      </React.Suspense>
    ) : null;
  const isThreadReadingOpen = Boolean(threadReadingPane);

  // Hardware / browser Back on phones closes the open sub-pane (GO's back
  // button then works) instead of leaving the app.
  const phoneSubPaneKey = !isOnePane
    ? null
    : isComposeView
    ? "compose"
    : isThreadReadingOpen
    ? "thread"
    : isReadingOpen
    ? "message"
    : isOpeningMessage
    ? "opening"
    : isThreadsView && selectedGroup
    ? "thread-group"
    : activeAliasInboxName
    ? "alias-inbox"
    : null;
  usePhoneBackClose({
    enabled: isOnePane,
    activeKey: phoneSubPaneKey,
    onBack: () => {
      if (phoneSubPaneKey === "compose") handleComposerClose();
      else if (phoneSubPaneKey === "thread") setCurrentThread(null);
      else if (phoneSubPaneKey === "message") closeOpenMessage();
      else if (phoneSubPaneKey === "opening") onOk(undefined);
      else if (phoneSubPaneKey === "thread-group") {
        setSelectedGroup(null);
        setCurrentThread(null);
      } else if (phoneSubPaneKey === "alias-inbox") {
        setSelectedAlias(null);
        setSelectedAliasScope(null);
        closeOpenMessage();
      }
    },
  });

  // ---- wide views (take the place of list + reading) -----------------------
  let wide: React.ReactNode | null = null;
  let wideKeepsChrome = false;
  if (isComposeView) {
    const composeTitle = replyTo
      ? composeReplyAll
        ? "Reply all"
        : "Reply"
      : forwardInfo
      ? "Forward"
      : composeMode === "alias"
      ? "New message as alias"
      : "New message";
    wide = (
      <>
        <PaneHeader
          title={composeTitle}
          subtitle={composeRecipientAlias || undefined}
          onBack={handleComposerClose}
          backLabel="Close composer"
        />
        <Box sx={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
          <React.Suspense fallback={<ListSkeleton rows={3} />}>
          <NewMessage
            isFromTo={isFromTo}
            replyTo={replyTo}
            replyAll={composeReplyAll}
            setReplyTo={setReplyTo}
            setForwardInfo={setForwardInfo}
            forwardInfo={forwardInfo}
            recipientAlias={composeRecipientAlias || ""}
            requireSenderAlias={composeRequireReplyAlias}
            defaultReplyAlias={composeDefaultReplyAlias}
            hideButton
            inlineMode
            ownedNames={ownedNameCandidates}
            joinedGroups={memberGroupOptions}
            priorityRecipientNames={composePriorityRecipientNames}
            recentInboxMessages={combinedInboxMessages}
            openedMessagesById={hashMapMailMessages}
            composePrefill={composePrefill}
            onRequestClose={handleComposerClose}
          />
          </React.Suspense>
        </Box>
      </>
    );
  } else if (isAliasesViewActive && !activeAliasInboxName) {
    wideKeepsChrome = true;
    wide = (
      <>
        <PaneHeader
          title="Aliases"
          subtitle="Inboxes for names you watch"
          leading={menuButton}
          actions={settingsButton}
        />
        <PaneScroll>
          <Box sx={centeredColumnSx}>
            {hasAuthenticatedIdentity ? (
              <React.Suspense fallback={<ListSkeleton rows={4} />}>
              <AliasesPage
                aliases={watchedAliases}
                aliasesWithMessages={watchedAliasesWithMessages}
                replyAliasLinks={aliasReplyLinks}
                isLoadingAliasesWithMessages={isLoadingWatchedAliasActivity}
                onOpenAlias={aliasName => {
                  setSelectedAlias(aliasName);
                  setSelectedAliasScope("aliases");
                }}
                onAddAlias={aliasName => {
                  setSelectedAlias(null);
                  setSelectedAliasScope(null);
                  const didAdd = addWatchedAliasByName(aliasName);
                  dispatch(
                    setNotification({
                      msg: didAdd
                        ? `Alias saved: ${aliasName}`
                        : "Alias is already saved or invalid",
                      alertType: didAdd ? "success" : "info",
                    })
                  );
                }}
                onRemoveAlias={aliasName => {
                  removeWatchedAlias(aliasName);
                }}
                onSetReplyAlias={(aliasName, replyAlias) => {
                  const didSet = setLinkedReplyAlias(aliasName, replyAlias);
                  dispatch(
                    setNotification({
                      msg: didSet
                        ? `Reply alias linked for ${aliasName}`
                        : "Reply alias is invalid or matches the inbox alias",
                      alertType: didSet ? "success" : "info",
                    })
                  );
                }}
                onClearReplyAlias={aliasName => {
                  clearLinkedReplyAlias(aliasName);
                }}
                onRunAliasScan={runAliasScan}
                onCancelAliasScan={cancelAliasScan}
                hasScanCheckpoint={aliasScanCheckpointTimestamp > 0}
                scanCheckpointTimestamp={aliasScanCheckpointTimestamp}
                scanState={{
                  isRunning: isAliasScanRunning,
                  isCancelRequested: isAliasScanCancelRequested,
                  phase: aliasScanPhase,
                  scannedCount: aliasScanScannedCount,
                  totalCount: aliasScanTotalCount,
                  discoveredCount: aliasScanDiscoveredCount,
                  statusMessage: aliasScanStatusMessage,
                  paging: aliasScanPaging,
                }}
              />
              </React.Suspense>
            ) : (
              renderAuthenticationPrompt("Aliases")
            )}
          </Box>
        </PaneScroll>
      </>
    );
  }

  // ---- navigation ----------------------------------------------------------
  const rail = (
    <Rail
      items={sidebarItems}
      activeItemId={activeSidebarItem}
      onSelect={onSelectSidebarItem}
      avatarUrlByName={avatarUrlByNameLowercase}
      groupAvatarUrlById={groupAvatarUrlById}
      onOpenSettings={openSettings}
      version={packageJson.version}
      onClose={isDesktopLayout ? undefined : () => setRailOpen(false)}
    />
  );

  const bottomNav = (
    <BottomNav
      items={[
        { id: "inbox", label: "Inbox", icon: <InboxOutlinedIcon />, badge: unreadCounts.inbox || undefined },
        { id: "sent", label: "Sent", icon: <SendOutlinedIcon /> },
        { id: "threads", label: "Threads", icon: <ForumOutlinedIcon />, badge: Object.values(threadUnreadByGroup || {}).reduce((sum, n) => sum + (n || 0), 0) || undefined },
        { id: "aliases", label: "Aliases", icon: <AlternateEmailOutlinedIcon />, badge: unreadCounts.aliases || undefined },
        { id: "menu", label: "Menu", icon: <MenuIcon /> },
      ]}
      activeId={isComposeView ? null : activeMailboxItem}
      onSelect={id => {
        if (id === "menu") {
          setRailOpen(true);
          return;
        }
        onSelectSidebarItem(id);
      }}
    />
  );

  return (
    <MailShell
      mode={layoutMode}
      rail={rail}
      railOpen={railOpen}
      onRailOpenChange={setRailOpen}
      bottomNav={bottomNav}
      fab={<ComposeFab onClick={() => onSelectSidebarItem("compose")} />}
      banner={
        isMailBootstrapLoading ? (
          <LoadingBanner text="Fetching mail and state…" />
        ) : null
      }
      list={listPane}
      reading={threadReadingPane ?? readingPane}
      readingPlaceholder={readingPlaceholder}
      readingOpen={isReadingOpen || isOpeningMessage || isThreadReadingOpen}
      wide={wide}
      wideKeepsChrome={wideKeepsChrome}
      overlays={
        <>
          <LoadPublishedStateModal />
          {shortcutsHelpOpen && (
            <React.Suspense fallback={null}>
              <ShortcutsHelpDialog
                open={shortcutsHelpOpen}
                onClose={() => setShortcutsHelpOpen(false)}
              />
            </React.Suspense>
          )}
          {hasAuthenticatedIdentity && isInboxViewActive && run && (
            <React.Suspense fallback={null}>
              <MailTour run={run} onDone={handleTourDone} />
            </React.Suspense>
          )}
        </>
      }
    />
  );
};
