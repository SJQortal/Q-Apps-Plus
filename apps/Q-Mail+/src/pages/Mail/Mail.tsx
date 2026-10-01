import React, {
  FC,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../../state/store";
import { Joyride, ACTIONS, STATUS, Step } from "react-joyride";


import { styled } from "@mui/system";
import {
  Avatar,
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  Typography,
  CircularProgress,
  LinearProgress,
  useMediaQuery,
  ButtonBase,
} from "@mui/material";
import { NewMessage } from "./NewMessage";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import { useFetchMail } from "../../hooks/useFetchMail";
import { ShowMessage } from "./ShowMessage";
import { clearMessages, upsertMessages } from "../../state/features/mailSlice";
import { setUserAvatarHash } from "../../state/features/globalSlice";
import { setNotification } from "../../state/features/notificationsSlice";

import SimpleTable from "./MailTable";
import { AliasMail } from "./AliasMail";
import { SentMail } from "./SentMail";
import { GroupMail } from "./GroupMail";
import { useModal } from "../../components/common/useModal";
import useConfirmationModal from "../../hooks/useConfirmModal";
import { OpenMail } from "./OpenMail";
import { MAIL_SERVICE_TYPE, THREAD_SERVICE_TYPE } from "../../constants/mail";
import { ShowMessageV2 } from "./ShowMessageV2";
import {
  executeEvent,
  subscribeToEvent,
  unsubscribeFromEvent,
} from "../../utils/events";
import { GroupedMailboxList } from "./GroupedMailboxList";
import { MailboxSearchBar } from "./MailboxSearchBar";
import { useMailboxSearch } from "./useMailboxSearch";
import { ThreadsMailbox } from "./ThreadsMailbox";
import { AliasesPage } from "./AliasesPage";
import { parseSentRecipientFromIdentifier } from "./mailIdentifier";
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
import { PaneHeader } from "../../layout/PaneHeader";
import { EmptyState, LoadingBanner } from "../../layout/states";
import { useLayoutMode } from "../../layout/useLayoutMode";
import { useAppViewport } from "../../layout/useAppViewport";
import { SETTINGS_PATH } from "../Settings/SettingsPage";
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
  arePublishedStateEntriesEqual,
  buildPublishedMailStateDocument,
  mergePublishedStateEntries,
  parsePublishedMailStateDocument,
  type QMailPublishedStateEntry,
} from "../../utils/mailStateDocument";
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
} from "../../utils/mailInbox";
import { useAppShell } from "../../app-shell/AppShellContext";
import {
  countUnreadMessages,
  hasThreadHistory,
  readIdsFromState,
} from "../../utils/readState";

type MailboxSidebarItemId =
  | "inbox"
  | "archived"
  | "aliases"
  | "sent"
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

const SIDEBAR_HOVER_CLOSE_DELAY_MS = 180;

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

interface AliasScanCheckpoint {
  lastProcessedTimestamp: number;
  lastProcessedIdentifier: string;
  updatedAt: number;
}

const getAliasScanCheckpointStorageKey = (address: string): string => {
  return `qmail_alias_scan_checkpoint_${address}`;
};

const readAliasScanCheckpointFromStorage = (
  address: string
): AliasScanCheckpoint | null => {
  try {
    const raw = localStorage.getItem(getAliasScanCheckpointStorageKey(address));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const lastProcessedTimestamp = Number(parsed?.lastProcessedTimestamp || 0);
    const lastProcessedIdentifier =
      typeof parsed?.lastProcessedIdentifier === "string"
        ? parsed.lastProcessedIdentifier
        : "";
    const updatedAt = Number(parsed?.updatedAt || 0);
    if (
      !Number.isFinite(lastProcessedTimestamp) ||
      lastProcessedTimestamp < 0
    ) {
      return null;
    }
    return {
      lastProcessedTimestamp,
      lastProcessedIdentifier,
      updatedAt: Number.isFinite(updatedAt) ? updatedAt : 0,
    };
  } catch {
    return null;
  }
};

const writeAliasScanCheckpointToStorage = (
  address: string,
  checkpoint: AliasScanCheckpoint
): void => {
  try {
    localStorage.setItem(
      getAliasScanCheckpointStorageKey(address),
      JSON.stringify(checkpoint)
    );
  } catch {
    // Ignore storage failures.
  }
};

const getMailResourceEffectiveTimestamp = (resource: any): number => {
  const updated = Number(resource?.updated || 0);
  if (Number.isFinite(updated) && updated > 0) return updated;
  const created = Number(resource?.created || 0);
  if (Number.isFinite(created) && created > 0) return created;
  return 0;
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
      items.push({
        id: createThreadGroupItemId(group.id),
        label: group.name,
        hidden: !isThreadsSectionExpanded,
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

const steps: Step[] = [
  {
    content: (
      <div>
        <h2>Welcome To Q-Mail</h2>
        <p
          style={{
            fontSize: "1.125rem",
          }}
        >
          Let's take a tour
        </p>
        <p
          style={{
            fontSize: "0.75rem",
          }}
        >
          The Qortal community, along with its development team and the creators
          of this application, cannot be held accountable for any content
          published or displayed. Furthermore, they bear no responsibility for
          any data loss that may occur as a result of using this application.
        </p>
      </div>
    ),
    placement: "center",
    target: ".step-1",
  },
  {
    target: "[data-qapp-lib-sidebar-item='inbox']",
    content: (
      <div>
        <h2>Changing instances</h2>

        <p
          style={{
            fontSize: "1.125rem",
          }}
        >
          Toggle between your main inbox, aliases, and groups you've joined.
        </p>
      </div>
    ),
    placement: "bottom",
  },
  {
    target: "[data-qapp-lib-sidebar-item='compose']",
    content: (
      <div>
        <h2>Composing a mail message</h2>
        <p
          style={{
            fontSize: "1.125rem",
            fontWeight: "bold",
          }}
        >
          Compose a secure message featuring encrypted attachments (up to 40MB
          per attachment).
        </p>
        <p
          style={{
            fontSize: "1.125rem",
          }}
        >
          To protect the identity of the recipient, assign them an alias for
          added anonymity.
        </p>
      </div>
    ),
    placement: "bottom",
  },

  {
    target: "[data-qapp-lib-sidebar-item='aliases']",
    content: (
      <div>
        <h2>What is an alias?</h2>
        <p
          style={{
            fontSize: "1.125rem",
            fontWeight: "bold",
          }}
        >
          To conceal the identity of the message recipient, utilize the alias
          option when sending.
        </p>
        <p
          style={{
            fontSize: "0.875rem",
          }}
        >
          For instance, instruct your friend to address the message to you using
          the alias 'FrederickGreat'.
        </p>
        <p
          style={{
            fontSize: "0.875rem",
          }}
        >
          To access messages sent to that alias, simply add the alias as an
          instance.
        </p>
      </div>
    ),
    placement: "bottom",
  },
];

const TOUR_STATUS_STORAGE_KEY = "tourStatus-qmail";
const TOUR_STATUS_DISMISSED = "dismissed";

const GroupTabs = styled(Tabs)({
  maxWidth: "50vw",
});

interface MailProps {
  isFromTo: boolean;
}

export const Mail = ({ isFromTo }: MailProps) => {
  const { name: composeRouteName } = useParams();
  const { isShow, onCancel, onOk, show } = useModal();
  const { user } = useSelector((state: RootState) => state.auth);
  const { registerMailSync } = useAppShell();
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
  const [aliasScanCheckpointIdentifier, setAliasScanCheckpointIdentifier] =
    useState("");
  const [isAliasScanCancelRequested, setIsAliasScanCancelRequested] =
    useState(false);
  const aliasScanCancelRequestedRef = useRef(false);
  const [ownedInboxNames, setOwnedInboxNames] = useState<string[]>([]);
  const [ownedSentNames, setOwnedSentNames] = useState<string[]>([]);
  const [run, setRun] = useState(false);
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
  const layoutMode = useLayoutMode();
  const isMobile = layoutMode === "phone";
  const [railOpen, setRailOpen] = useState(false);
  const location = useLocation();
  useAppViewport();
  // Kept in step with activeMailboxItem; the shell reads activeMailboxItem only.
  const [mobileMode, setMobileMode] = useState("inbox");
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
  const [isChangelogOpen, setIsChangelogOpen] = useState(false);
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

  const mailMessages = useSelector(
    (state: RootState) => state.mail.mailMessages
  );
  const readState = useSelector((state: RootState) => state.mail.readState);
  const archived = useSelector((state: RootState) => state.mail.archived);
  const [publishedArchivedById, setPublishedArchivedById] =
    useState<ArchivedMap>({});
  const { Modal: LoadPublishedStateModal, showModal: showLoadPublishedStateModal } =
    useConfirmationModal({
      title: "Load published QDN state?",
      message:
        "Q-Mail found a published mailbox state for this account. Keep fetching it in the background and apply it when the download finishes?",
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

  const userName = useMemo(() => {
    if (!user?.name) return "";
    return user.name;
  }, [user]);
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
    Object.values(combinedAliasInboxMessages).forEach(messages => {
      appendMessages(messages);
    });

    return Array.from(mergedMessages.values()).sort((a, b) => {
      return Number(b?.createdAt || 0) - Number(a?.createdAt || 0);
    });
  }, [combinedAliasInboxMessages, mailMessages]);
  const unreadCounts = useMemo<UnreadCounts>(() => {
    if (!hasAuthenticatedIdentity) return EMPTY_UNREAD_COUNTS;
    const byName: Record<string, number> = {};
    ownedInboxNames.forEach(name => {
      const messages =
        name.toLowerCase() === normalizedUserName
          ? mailMessages
          : combinedAliasInboxMessages[name] || [];
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
    combinedAliasInboxMessages,
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
      combinedAliasInboxMessages[selectedInboxInstanceName] ?? []
    );
  }, [
    archived,
    combinedAliasInboxMessages,
    combinedInboxMessages,
    mailMessages,
    normalizedUserName,
    selectedInboxInstanceName,
  ]);
  const shouldRunInboxSearch =
    hasAuthenticatedIdentity &&
    isInboxViewActive &&
    inboxMessagesForList !== null;

  const { results: inboxSearchResults, status: inboxSearchStatus } =
    useMailboxSearch({
      messages: inboxMessagesForList || [],
      query: inboxSearchQuery,
      mailboxType: "inbox",
      username: user?.name,
      hashMapMailMessages,
      enabled: shouldRunInboxSearch,
    });
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const { getAllMailMessages, checkNewMessages } = useFetchMail();
  const getMessages = React.useCallback(
    async (isOnMount?: boolean) => {
      if (!user?.name || !user?.address) return;
      try {
        if (isOnMount) {
          setIsLoading(true);
        }
        await getAllMailMessages(user.name, user.address);
      } catch (error) {
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
    to?: string
  ) => {
    try {
      setIsChangelogOpen(false);
      const shouldAutoMarkAsRead =
        activeMailboxItem === "inbox" || activeMailboxItem === "aliases";
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
      setMailInfo({
        identifier: messageIdentifier,
        name: user,
        service: MAIL_SERVICE_TYPE,
        to,
      });
      const res: any = await show();
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
    } catch (error) {
    } finally {
    }
  };

  const openReplyComposerFromMessage = useCallback(
    (messagePayload: any) => {
      const linkedReplyAlias = activeAliasInboxName
        ? aliasReplyLinks[activeAliasInboxName.toLowerCase()] || ""
        : "";
      setIsChangelogOpen(false);
      setForwardInfo(null);
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
      setMobileMode("compose");
    },
    [activeAliasInboxName, aliasReplyLinks]
  );

  const openForwardComposerFromMessage = useCallback(
    (forwardPayload: any) => {
      setIsChangelogOpen(false);
      setReplyTo(null);
      setForwardInfo(forwardPayload);
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
      setMobileMode("compose");
    },
    [activeAliasInboxName]
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

      setIsChangelogOpen(false);
      setReplyTo(null);
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
      setMobileMode("compose");
    },
    [ownedNameCandidates, selectedAlias, user?.name]
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
  }, [user?.name]);

  useEffect(() => {
    if (!isFromTo || !composeRouteName || !hasAuthenticatedIdentity) {
      return;
    }

    setIsChangelogOpen(false);
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
    setMobileMode("compose");
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
      setAliasScanCheckpointIdentifier("");
      setIsAliasScanCancelRequested(false);
      aliasScanCancelRequestedRef.current = false;
      return;
    }
    const checkpoint = readAliasScanCheckpointFromStorage(
      watchedAliasOwnerAddress
    );
    setAliasScanCheckpointTimestamp(checkpoint?.lastProcessedTimestamp || 0);
    setAliasScanCheckpointIdentifier(checkpoint?.lastProcessedIdentifier || "");
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
        setWatchedAliasRecentMessages(
          results.reduce<Record<string, any[]>>((accumulator, result) => {
            accumulator[result.aliasName] = result.messages;
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
          hasInboxMailActivityForOwnedName(accountName, user.address),
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
          const avatarUrl = await qortalRequest({
            action: "GET_QDN_RESOURCE_URL",
            name,
            service: "THUMBNAIL",
            identifier: "qortal_avatar",
          });

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

  const handleJoyrideCallback = (data: any) => {
    const { action, status } = data;

    if (
      status === STATUS.FINISHED ||
      status === STATUS.SKIPPED ||
      action === ACTIONS.SKIP
    ) {
      setRun(false);
      localStorage.setItem(TOUR_STATUS_STORAGE_KEY, TOUR_STATUS_DISMISSED);
    }
  };

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
    (lastProcessedTimestamp: number, lastProcessedIdentifier: string) => {
      if (!watchedAliasOwnerAddress) return;
      const safeTimestamp = Number(lastProcessedTimestamp || 0);
      if (!Number.isFinite(safeTimestamp) || safeTimestamp < 0) return;
      const checkpoint: AliasScanCheckpoint = {
        lastProcessedTimestamp: safeTimestamp,
        lastProcessedIdentifier:
          typeof lastProcessedIdentifier === "string"
            ? lastProcessedIdentifier
            : "",
        updatedAt: Date.now(),
      };
      writeAliasScanCheckpointToStorage(watchedAliasOwnerAddress, checkpoint);
      setAliasScanCheckpointTimestamp(checkpoint.lastProcessedTimestamp);
      setAliasScanCheckpointIdentifier(checkpoint.lastProcessedIdentifier);
    },
    [watchedAliasOwnerAddress]
  );

  const cancelAliasScan = useCallback(() => {
    if (!isAliasScanRunning) return;
    aliasScanCancelRequestedRef.current = true;
    setIsAliasScanCancelRequested(true);
    setAliasScanStatusMessage("Cancel requested... finishing current item.");
  }, [isAliasScanRunning]);

  const runAliasScan = useCallback(async () => {
    if (!hasAuthenticatedIdentity) {
      dispatch(
        setNotification({
          msg: "Authenticate before running alias scan",
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

    type AliasScanCandidateResource = {
      name: string;
      identifier: string;
      recipientHint: string;
      effectiveTimestamp: number;
    };

    const checkpointTimestamp = Number(aliasScanCheckpointTimestamp || 0);
    const checkpointIdentifier = aliasScanCheckpointIdentifier || "";
    const ownedNameSet = new Set(
      ownedNameCandidates.map(name => name.trim().toLowerCase()).filter(Boolean)
    );

    aliasScanCancelRequestedRef.current = false;
    setIsAliasScanCancelRequested(false);
    setIsAliasScanRunning(true);
    setAliasScanPhase("collecting");
    setAliasScanScannedCount(0);
    setAliasScanTotalCount(0);
    setAliasScanDiscoveredCount(0);
    setAliasScanStatusMessage(
      checkpointTimestamp > 0
        ? `Resuming from ${formatFullTimestamp(checkpointTimestamp)}...`
        : "Collecting Q-Mail resources..."
    );

    try {
      const pageSize = 200;
      let offset = 0;
      let hasMore = true;
      const candidateResources: AliasScanCandidateResource[] = [];
      const candidateMap = new Set<string>();

      while (hasMore) {
        if (aliasScanCancelRequestedRef.current) {
          const canceledMessage = "Alias scan canceled.";
          setAliasScanStatusMessage(canceledMessage);
          dispatch(
            setNotification({
              msg: canceledMessage,
              alertType: "info",
            })
          );
          return;
        }

        const params = new URLSearchParams({
          mode: "ALL",
          service: MAIL_SERVICE_TYPE,
          query: "qortal_qmail_",
          limit: String(pageSize),
          includemetadata: "false",
          offset: String(offset),
          reverse: "true",
          excludeblocked: "true",
        });

        const responseData = await searchResources(params, { ttlMs: 0 });
        if (responseData.length === 0) {
          break;
        }

        responseData.forEach((resource: any) => {
          const identifier =
            typeof resource?.identifier === "string"
              ? resource.identifier.trim()
              : "";
          const resourceName =
            typeof resource?.name === "string" ? resource.name.trim() : "";
          if (!identifier || !resourceName) return;

          const { recipientName, recipientAddress } =
            parseSentRecipientFromIdentifier(identifier);
          if (recipientAddress) return;
          const normalizedRecipientName =
            typeof recipientName === "string"
              ? recipientName.trim().toLowerCase()
              : "";
          if (!normalizedRecipientName) return;
          if (ownedNameSet.has(normalizedRecipientName)) return;
          const effectiveTimestamp =
            getMailResourceEffectiveTimestamp(resource);
          if (!effectiveTimestamp) return;
          const isAfterCheckpoint =
            effectiveTimestamp > checkpointTimestamp ||
            (effectiveTimestamp === checkpointTimestamp &&
              identifier > checkpointIdentifier);
          if (!isAfterCheckpoint) return;

          const dedupeKey = `${resourceName}|${identifier}`;
          if (candidateMap.has(dedupeKey)) return;
          candidateMap.add(dedupeKey);

          candidateResources.push({
            name: resourceName,
            identifier,
            recipientHint: recipientName || "",
            effectiveTimestamp,
          });
        });

        setAliasScanStatusMessage(
          `Collected ${candidateResources.length} candidate messages...`
        );

        if (responseData.length < pageSize) {
          hasMore = false;
        } else {
          offset += responseData.length;
        }
      }

      if (aliasScanCancelRequestedRef.current) {
        const canceledMessage = "Alias scan canceled.";
        setAliasScanStatusMessage(canceledMessage);
        dispatch(
          setNotification({
            msg: canceledMessage,
            alertType: "info",
          })
        );
        return;
      }

      const sortedCandidates = [...candidateResources].sort((a, b) => {
        if (a.effectiveTimestamp !== b.effectiveTimestamp) {
          return a.effectiveTimestamp - b.effectiveTimestamp;
        }
        return a.identifier.localeCompare(b.identifier);
      });

      setAliasScanPhase("scanning");
      setAliasScanTotalCount(sortedCandidates.length);
      if (sortedCandidates.length === 0) {
        const emptyMessage =
          checkpointTimestamp > 0
            ? "Alias scan finished: no new messages since last checkpoint"
            : "Alias scan finished: no candidate messages found";
        setAliasScanStatusMessage(emptyMessage);
        dispatch(
          setNotification({
            msg: emptyMessage,
            alertType: "info",
          })
        );
        return;
      }

      const existingAliasMap = new Map<string, string>();
      watchedAliases.forEach(aliasName => {
        const normalizedAlias = aliasName.trim().toLowerCase();
        if (!normalizedAlias || existingAliasMap.has(normalizedAlias)) return;
        existingAliasMap.set(normalizedAlias, aliasName);
      });

      const discoveredAliasMap = new Map<string, string>();
      for (let index = 0; index < sortedCandidates.length; index += 1) {
        if (aliasScanCancelRequestedRef.current) {
          const cancelMessage = `Alias scan canceled at ${index}/${sortedCandidates.length}. Resume later to continue.`;
          setAliasScanStatusMessage(cancelMessage);
          dispatch(
            setNotification({
              msg: cancelMessage,
              alertType: "info",
            })
          );
          return;
        }

        const resource = sortedCandidates[index];
        const candidateNames = new Map<string, string>();
        let didDecrypt = false;

        try {
          const encryptedData = await qortalRequest({
            action: "FETCH_QDN_RESOURCE",
            name: resource.name,
            service: MAIL_SERVICE_TYPE,
            identifier: resource.identifier,
            encoding: "base64",
          });
          const decryptRequestBody: any = {
            action: "DECRYPT_DATA",
            encryptedData,
          };
          const decryptedData = await qortalRequest(decryptRequestBody);
          didDecrypt = true;
          const uint8ArrayMessage = base64ToUint8Array(decryptedData);
          const decodedMessage = uint8ArrayToObject(uint8ArrayMessage);

          if (typeof decodedMessage?.recipient === "string") {
            const recipientFromBody = decodedMessage.recipient.trim();
            const normalizedRecipientFromBody = recipientFromBody.toLowerCase();
            if (
              recipientFromBody &&
              !ownedNameSet.has(normalizedRecipientFromBody)
            ) {
              candidateNames.set(
                normalizedRecipientFromBody,
                recipientFromBody
              );
            }
          }
          if (typeof decodedMessage?.to === "string") {
            const toFromBody = decodedMessage.to.trim();
            const normalizedToFromBody = toFromBody.toLowerCase();
            if (toFromBody && !ownedNameSet.has(normalizedToFromBody)) {
              candidateNames.set(normalizedToFromBody, toFromBody);
            }
          }
        } catch {
          // Ignore undecryptable/unavailable resources. We still persist checkpoint.
        }

        if (didDecrypt && candidateNames.size === 0) {
          const recipientHint = resource.recipientHint.trim();
          const normalizedRecipientHint = recipientHint.toLowerCase();
          if (recipientHint && !ownedNameSet.has(normalizedRecipientHint)) {
            candidateNames.set(normalizedRecipientHint, recipientHint);
          }
        }

        candidateNames.forEach((displayName, normalizedName) => {
          if (existingAliasMap.has(normalizedName)) return;
          if (discoveredAliasMap.has(normalizedName)) return;
          discoveredAliasMap.set(normalizedName, displayName);
        });
        persistAliasScanCheckpoint(
          resource.effectiveTimestamp,
          resource.identifier
        );

        setAliasScanScannedCount(index + 1);
        setAliasScanDiscoveredCount(discoveredAliasMap.size);
        setAliasScanStatusMessage(
          `Scanning messages... ${index + 1}/${sortedCandidates.length}`
        );
      }

      const newlyDiscoveredAliases = Array.from(discoveredAliasMap.values());
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

      const completionMessage =
        newlyDiscoveredAliases.length > 0
          ? `Alias scan complete: found ${newlyDiscoveredAliases.length} new aliases`
          : "Alias scan complete: no new aliases found";
      setAliasScanStatusMessage(completionMessage);
      dispatch(
        setNotification({
          msg: completionMessage,
          alertType: "success",
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
    aliasScanCheckpointIdentifier,
    aliasScanCheckpointTimestamp,
    dispatch,
    hasAuthenticatedIdentity,
    isAliasScanRunning,
    ownedNameCandidates,
    persistAliasScanCheckpoint,
    watchedAliases,
    watchedAliasOwnerAddress,
  ]);

  const applyReadStateToMessages = useCallback(
    (messagesToUpdate: any[], readIdSet: Set<string>): any[] => {
      let didChange = false;
      const nextMessages = messagesToUpdate.map(message => {
        const identifier = getMessageIdentifier(message);
        if (!identifier || !readIdSet.has(identifier)) return message;

        const existingThread = Array.isArray(
          message?.generalData?.threadV2
        )
          ? message.generalData.threadV2
          : [];
        if (existingThread.length > 0) return message;

        didChange = true;
        const updatedMessage = structuredClone(message);
        updatedMessage.generalData = updatedMessage.generalData || {};

        updatedMessage.generalData.threadV2 = [
          {
            reference: {
              identifier,
              name: updatedMessage?.user,
              service: MAIL_SERVICE_TYPE,
            },
            data: {
              markedAsReadLocally: true,
              createdAt: Date.now(),
            },
          },
        ];
        return updatedMessage;
      });
      return didChange ? nextMessages : messagesToUpdate;
    },
    []
  );

  const applyReadStateToCombinedMap = useCallback(
    (
      messageMap: Record<string, any[]>,
      readIdSet: Set<string>
    ): Record<string, any[]> => {
      let didChange = false;
      const nextMap = Object.entries(messageMap).reduce<Record<string, any[]>>(
        (accumulator, [name, entries]) => {
          const updatedEntries = applyReadStateToMessages(
            entries || [],
            readIdSet
          );
          accumulator[name] = updatedEntries;
          if (updatedEntries !== entries) {
            didChange = true;
          }
          return accumulator;
        },
        {}
      );
      return didChange ? nextMap : messageMap;
    },
    [applyReadStateToMessages]
  );

  const applyUnreadStateToMessages = useCallback(
    (messagesToUpdate: any[], unreadIdSet: Set<string>): any[] => {
      let didChange = false;
      const nextMessages = messagesToUpdate.map(message => {
        const identifier = getMessageIdentifier(message);
        if (!identifier || !unreadIdSet.has(identifier)) return message;

        const existingThread = Array.isArray(message?.generalData?.threadV2)
          ? message.generalData.threadV2
          : [];
        if (existingThread.length === 0) return message;

        didChange = true;
        const updatedMessage = structuredClone(message);
        updatedMessage.generalData = updatedMessage.generalData || {};
        updatedMessage.generalData.threadV2 = [];
        return updatedMessage;
      });
      return didChange ? nextMessages : messagesToUpdate;
    },
    []
  );

  const applyUnreadStateToCombinedMap = useCallback(
    (
      messageMap: Record<string, any[]>,
      unreadIdSet: Set<string>
    ): Record<string, any[]> => {
      let didChange = false;
      const nextMap = Object.entries(messageMap).reduce<Record<string, any[]>>(
        (accumulator, [name, entries]) => {
          const updatedEntries = applyUnreadStateToMessages(
            entries || [],
            unreadIdSet
          );
          accumulator[name] = updatedEntries;
          if (updatedEntries !== entries) {
            didChange = true;
          }
          return accumulator;
        },
        {}
      );
      return didChange ? nextMap : messageMap;
    },
    [applyUnreadStateToMessages]
  );

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
      return !arePublishedStateEntriesEqual(
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

        const readIdSet = new Set(readIdentifiers);
        dispatch(markRead({ ids: readIdentifiers }));
        const updatedMailMessages = applyReadStateToMessages(
          mailMessages,
          readIdSet
        );
        dispatch(upsertMessages(updatedMailMessages));
        setCombinedAliasInboxMessages(previous => {
          return applyReadStateToCombinedMap(previous, readIdSet);
        });
      } catch (error) {
        console.error("Failed to mark messages as read:", error);
      }
    },
    [
      applyReadStateToCombinedMap,
      applyReadStateToMessages,
      dispatch,
      mailMessages,
    ]
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

        const unreadIdSet = new Set(unreadIdentifiers);
        dispatch(markUnread({ ids: unreadIdentifiers }));
        const updatedMailMessages = applyUnreadStateToMessages(
          mailMessages,
          unreadIdSet
        );
        dispatch(upsertMessages(updatedMailMessages));
        setCombinedAliasInboxMessages(previous => {
          return applyUnreadStateToCombinedMap(previous, unreadIdSet);
        });
      } catch (error) {
        console.error("Failed to mark messages as unread:", error);
      }
    },
    [
      applyUnreadStateToCombinedMap,
      applyUnreadStateToMessages,
      dispatch,
      mailMessages,
    ]
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
      const { document: payload, mergedEntries: mergedStateEntries } =
        buildPublishedMailStateDocument({
          ownerAddress: user.address,
          names: ownedNameCandidates,
          publishedEntries: publishedMailStateById,
          localEntries: localMailStateById,
          archived,
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
      setPublishedMailStateById(mergedStateEntries);
      setPublishedArchivedById(archivedToPublish);
    } catch (error: any) {
      const messageText =
        typeof error?.message === "string"
          ? error.message
          : "Failed to publish Q-Mail state";
      dispatch(
        setNotification({
          msg: messageText,
          alertType: "error",
        })
      );
    } finally {
      setIsPublishingMailState(false);
    }
  }, [
    archived,
    dispatch,
    localMailStateById,
    ownedNameCandidates,
    publishedMailStateById,
    user?.address,
    user?.name,
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
    });
  }, [
    hasAuthenticatedIdentity,
    hasPendingArchivedChanges,
    hasPendingStateChanges,
    isPublishingMailState,
    publishMailStateToQdn,
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
      if (!parsed) return;
      const loadedArchived = parsed.archived;
      if (Object.keys(loadedArchived).length) {
        setPublishedArchivedById(loadedArchived);
        dispatch(applyPublishedArchived(loadedArchived));
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
    (mailboxLabel: "Inbox" | "Sent" | "Threads") => {
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
            Authenticate to view {mailboxLabel}
          </Typography>
          <Typography
            sx={{
              fontSize: "0.95rem",
              color: "var(--qmail-thread-subtle-text)",
            }}
          >
            Sign in to load and manage your messages.
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
            Authenticate
          </Button>
        </Box>
      );
    },
    []
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
    });
  }, [
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

      setIsChangelogOpen(false);
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
        setMobileMode("compose");
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
        setMobileMode("compose");
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
        setMobileMode("inbox");
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
        setMobileMode("aliases");
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
        setMobileMode("sent");
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
        setMobileMode("threads");
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
        setMobileMode("threads");
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
        setMobileMode("aliases");
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
        setMobileMode("inbox");
        setSelectedAlias(null);
        setSelectedAliasScope(null);
        setSelectedGroup(null);
        setCurrentThread(null);
        setIsOpen(false);
        setMessage(null);
        closeSidebarIfTransient();
        return;
      }

      if (itemId === "inbox" || itemId === "sent") {
        setActiveMailboxItem(itemId);
        setMobileMode(itemId);
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
    setPublishedMailStateById({});
    setPublishedArchivedById({});
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

  // Read store → the list copies, so rows show read state after a reload. Only
  // adds the local marker; "mark as unread" strips it through markMessagesAsUnread.
  useEffect(() => {
    const readIdSet = readIdsFromState(readState);
    if (!readIdSet.size) return;
    if (mailMessages.length > 0) {
      const updatedMailMessages = applyReadStateToMessages(
        mailMessages,
        readIdSet
      );
      if (updatedMailMessages !== mailMessages) {
        dispatch(upsertMessages(updatedMailMessages));
      }
    }
    setCombinedAliasInboxMessages(previous => {
      return applyReadStateToCombinedMap(previous, readIdSet);
    });
  }, [
    applyReadStateToCombinedMap,
    applyReadStateToMessages,
    dispatch,
    mailMessages,
    readState,
  ]);

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

  const shouldRenderAliasInboxMailbox = Boolean(activeAliasInboxName);
  const isMailBootstrapLoading =
    isLoading || isLoadingCombinedAliasInbox || isLoadingQdnState;

  const openSettings = useCallback(() => {
    navigate(SETTINGS_PATH, { state: { backgroundLocation: location } });
  }, [location, navigate]);

  const closeOpenMessage = useCallback(() => {
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
    if (composeReturnView === "threads") {
      setActiveMailboxItem("threads");
      setMobileMode("threads");
      if (composeReturnGroupId) {
        const returnGroup = groupOptionsById.get(composeReturnGroupId);
        if (returnGroup) {
          setSelectedGroup(returnGroup);
        }
      }
    } else if (shouldReturnToAliasInbox) {
      setActiveMailboxItem("aliases");
      setMobileMode("aliases");
      setSelectedAlias(selectedAliasInboxName);
      setSelectedAliasScope("aliases");
    } else {
      setActiveMailboxItem("inbox");
      setMobileMode("inbox");
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

  const spinner = (
    <Box sx={{ display: "flex", width: "100%", justifyContent: "center", py: 2 }}>
      <CircularProgress />
    </Box>
  );

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
        messageOpenedId={message?.id}
      />
    ) : (
      renderAuthenticationPrompt("Inbox")
    );
  } else if (isArchivedViewActive) {
    listTitle = "Archived";
    listSubtitle = user?.name || undefined;
    listBack = () => {
      onSelectSidebarItem("inbox");
    };
    listBody = hasAuthenticatedIdentity ? (
      archivedMessages.length ? (
        <GroupedMailboxList
          messages={archivedMessages}
          mailboxType="inbox"
          showSelectAll
          openMessage={openMessage}
          openedMessageId={message?.id || message?.identifier}
          onMarkAsRead={markMessagesAsRead}
          onMarkAsUnread={markMessagesAsUnread}
          onUnarchive={unarchiveMessages}
        />
      ) : (
        <EmptyState
          icon={<InboxOutlinedIcon />}
          title="Nothing archived"
          hint="Select messages in the inbox and choose Archive to tidy them away. They stay on QDN."
        />
      )
    ) : (
      renderAuthenticationPrompt("Inbox")
    );
  } else if (isThreadsView) {
    listTitle = "Threads";
    listSubtitle = "Group mail";
    listBody = hasAuthenticatedIdentity ? (
      <ThreadsMailbox
        groups={groupOptionsWithThreads}
        groupAvatarUrlById={groupAvatarUrlById}
        isLoadingGroups={isLoadingGroupInstances}
        onOpenThread={(thread, group) => {
          setSelectedGroup(group);
          setCurrentThread(thread);
          closeOpenMessage();
        }}
      />
    ) : (
      renderAuthenticationPrompt("Threads")
    );
  } else {
    listTitle = selectedInboxInstanceName || "Inbox";
    listSubtitle = selectedInboxInstanceName ? "Inbox" : user?.name || undefined;
    listBody = hasAuthenticatedIdentity ? (
      <>
        <MailboxSearchBar
          value={inboxSearchQuery}
          onChange={setInboxSearchQuery}
          placeholder="Search inbox messages..."
          status={inboxSearchStatus}
        />
        <GroupedMailboxList
          messages={inboxSearchResults}
          mailboxType="inbox"
          showSelectAll
          openMessage={openMessage}
          openedMessageId={message?.id || message?.identifier}
          onMarkAsRead={markMessagesAsRead}
          onMarkAsUnread={markMessagesAsUnread}
          onArchive={archiveMessages}
        />
        {isLoading && spinner}
        {isLoadingCombinedAliasInbox &&
          (!selectedInboxInstanceName ||
            !combinedAliasInboxMessages[selectedInboxInstanceName]) &&
          spinner}
      </>
    ) : (
      renderAuthenticationPrompt("Inbox")
    );
  }

  const listPane = (
    <>
      <PaneHeader
        title={listTitle}
        subtitle={listSubtitle}
        onBack={listBack}
        leading={menuButton}
        actions={settingsButton}
      />
      <PaneScroll>
        <Box className="step-1" sx={centeredColumnSx}>
          {listBody}
        </Box>
      </PaneScroll>
    </>
  );

  // ---- reading pane --------------------------------------------------------
  const readingPane = isReadingOpen ? (
    <>
      {isMobile && (
        <PaneHeader
          title={message?.subject || "Message"}
          subtitle={message?.user}
          onBack={closeOpenMessage}
          backLabel="Back to messages"
        />
      )}
      <PaneScroll>
        <Box sx={centeredColumnSx}>
          <ShowMessageV2
            isOpen={isOpen}
            setIsOpen={setIsOpen}
            message={message}
            setReplyTo={openReplyComposerFromMessage}
            setForwardInfo={openForwardComposerFromMessage}
            alias={activeAliasInboxName}
            onClose={closeOpenMessage}
          />
        </Box>
      </PaneScroll>
    </>
  ) : null;

  const readingPlaceholder = (
    <Box sx={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <EmptyState
        icon={<MailOutlineIcon />}
        title="Select a message"
        hint="Messages you open show up here."
      />
    </Box>
  );

  // ---- wide views (take the place of list + reading) -----------------------
  let wide: React.ReactNode | null = null;
  let wideKeepsChrome = false;
  if (isComposeView) {
    const composeTitle = replyTo
      ? "Reply"
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
          <NewMessage
            isFromTo={isFromTo}
            replyTo={replyTo}
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
            composePrefill={composePrefill}
            onRequestClose={handleComposerClose}
          />
        </Box>
      </>
    );
  } else if (isThreadsView && selectedGroup) {
    const groupName =
      typeof selectedGroup?.name === "string" && selectedGroup.name.trim()
        ? selectedGroup.name.trim()
        : "Group";
    wide = (
      <>
        <PaneHeader
          title={currentThread ? currentThread?.threadData?.title || "Thread" : groupName}
          subtitle={currentThread ? groupName : "Threads"}
          onBack={() => {
            if (currentThread) {
              setCurrentThread(null);
            } else {
              setSelectedGroup(null);
            }
          }}
          backLabel={currentThread ? "Back to threads" : "Back to groups"}
        />
        <PaneScroll>
          <Box sx={centeredColumnSx}>
            {hasAuthenticatedIdentity ? (
              <GroupMail
                groupInfo={selectedGroup}
                currentThread={currentThread}
                setCurrentThread={setCurrentThread}
                filterMode={filterMode}
                setFilterMode={setFilterMode}
                onRequestComposeThread={handleRequestComposeThread}
              />
            ) : (
              renderAuthenticationPrompt("Threads")
            )}
          </Box>
        </PaneScroll>
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
                }}
              />
            ) : (
              renderAuthenticationPrompt("Inbox")
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
        { id: "threads", label: "Threads", icon: <ForumOutlinedIcon /> },
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
      reading={readingPane}
      readingPlaceholder={readingPlaceholder}
      readingOpen={isReadingOpen}
      wide={wide}
      wideKeepsChrome={wideKeepsChrome}
      overlays={
        <>
          <LoadPublishedStateModal />
          {mailInfo && isShow && (
            <OpenMail open={isShow} handleClose={onOk} fileInfo={mailInfo} />
          )}
          {hasAuthenticatedIdentity && isInboxViewActive && (
            <Joyride
              steps={steps}
              run={run}
              onEvent={handleJoyrideCallback}
              continuous={true}
              scrollToFirstStep={true}
              options={{ showProgress: true }}
            />
          )}
        </>
      }
    />
  );
};

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number | null;
}

export function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`mail-tabs-${index}`}
      aria-labelledby={`mail-tabs-${index}`}
      {...other}
      style={{
        width: "100%",
      }}
    >
      {value === index && children}
    </div>
  );
}
