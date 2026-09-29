import React, {
  FC,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../../state/store";
import Joyride, { ACTIONS, EVENTS, STATUS, Step } from "react-joyride";
import SendIcon from "@mui/icons-material/Send";
import ComposeIconSVG from "../../assets/svgs/ComposeIcon.svg";
import MailSVG from "../../assets/svgs/mail.svg";
import SendSVG from "../../assets/svgs/Send.svg";
import ReplySVG from "../../assets/svgs/Reply.svg";

import MailIcon from "@mui/icons-material/Mail";
import GroupIcon from "@mui/icons-material/Group";
import GroupSVG from "../../assets/svgs/Group.svg";
import AddAliasSVG from "../../assets/svgs/AddAlias.svg";

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
import {
  CloseParent,
  ComposeP,
  MailBody,
  MailBodyInner,
  MailBodyInnerHeader,
  MailBodyInnerScroll,
  MailContainer,
  MailIconImg,
} from "./Mail-styles";
import { ShowMessageV2 } from "./ShowMessageV2";
import {
  executeEvent,
  subscribeToEvent,
  unsubscribeFromEvent,
} from "../../utils/events";
import { Spacer } from "../../components/common/Spacer";
import { ChangelogPage } from "./ChangelogPage";
import { GroupedMailboxList } from "./GroupedMailboxList";
import { MailboxSearchBar } from "./MailboxSearchBar";
import { useMailboxSearch } from "./useMailboxSearch";
import { ThreadsMailbox } from "./ThreadsMailbox";
import { AliasesPage } from "./AliasesPage";
import {
  isSentMailIdentifier,
  parseSentRecipientFromIdentifier,
} from "./mailIdentifier";
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
import PublishIcon from "@mui/icons-material/Publish";
import {
  LeftSidebar,
  useLeftSidebarController,
  useLeftSidebarHoverPreview,
  useLeftSidebarState,
} from "@qortal/qapp-lib/left-sidebar/react";
import type {
  LeftSidebarConfig,
  LeftSidebarDeps,
  LeftSidebarItem,
} from "@qortal/qapp-lib/left-sidebar/core";

type MailboxSidebarItemId =
  | "inbox"
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
const MAIL_STATE_DOCUMENT_SERVICE = "DOCUMENT_PRIVATE";
const MAIL_STATE_DOCUMENT_IDENTIFIER = "qmail_state_v1";

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

interface QMailPublishedStateEntry {
  read?: boolean;
  updatedAt?: number;
  subject?: string;
}

interface QMailPublishedStateDocument {
  version: number;
  updatedAt: number;
  ownerAddress: string;
  names: string[];
  messages: Record<string, QMailPublishedStateEntry>;
}

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
}

const getMessageIdentifier = (message: any): string => {
  const value = message?.id ?? message?.identifier;
  if (value === undefined || value === null) return "";
  return String(value);
};

const normalizePublishedStateEntry = (
  entry: QMailPublishedStateEntry | null | undefined
): QMailPublishedStateEntry => {
  const read = Boolean(entry?.read);
  const subject =
    typeof entry?.subject === "string" ? entry.subject.trim() : "";
  const updatedAt = Number(entry?.updatedAt || 0);
  const normalized: QMailPublishedStateEntry = {};
  if (read) normalized.read = true;
  if (subject) normalized.subject = subject;
  if (Number.isFinite(updatedAt) && updatedAt > 0) {
    normalized.updatedAt = updatedAt;
  }
  return normalized;
};

const mergePublishedStateEntries = (
  base: QMailPublishedStateEntry | null | undefined,
  incoming: QMailPublishedStateEntry | null | undefined
): QMailPublishedStateEntry => {
  const normalizedBase = normalizePublishedStateEntry(base);
  const normalizedIncoming = normalizePublishedStateEntry(incoming);
  return {
    read: Boolean(normalizedBase.read || normalizedIncoming.read) || undefined,
    subject: normalizedIncoming.subject || normalizedBase.subject || undefined,
    updatedAt:
      Math.max(
        Number(normalizedBase.updatedAt || 0),
        Number(normalizedIncoming.updatedAt || 0)
      ) || undefined,
  };
};

const arePublishedStateEntriesEqual = (
  a: QMailPublishedStateEntry | null | undefined,
  b: QMailPublishedStateEntry | null | undefined
): boolean => {
  const normalizedA = normalizePublishedStateEntry(a);
  const normalizedB = normalizePublishedStateEntry(b);
  return (
    Boolean(normalizedA.read) === Boolean(normalizedB.read) &&
    (normalizedA.subject || "") === (normalizedB.subject || "")
  );
};

const buildSidebarItems = ({
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

  items.push({ id: "inbox", label: "Inbox" });

  sortOwnedNamesForDisplay(inboxNames, primaryName).forEach(name => {
    items.push({
      id: createInboxInstanceItemId(name),
      label: name,
    });
  });

  items.push({ id: "aliases", label: "Aliases" });
  sortOwnedNamesForDisplay(aliasesNames, primaryName).forEach(name => {
    const normalizedAliasName = name.trim().toLowerCase();
    const linkedReplyAlias = aliasReplyLinks[normalizedAliasName] || "";
    items.push({
      id: createAliasesInstanceItemId(name),
      label: name,
      secondaryLabel: linkedReplyAlias || undefined,
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

const fetchHasMailResources = async (
  params: URLSearchParams,
  matcher?: (item: any) => boolean
): Promise<boolean> => {
  try {
    const response = await fetch(
      `/arbitrary/resources/search?${params.toString()}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
    const responseData = await response.json();
    if (!Array.isArray(responseData) || responseData.length === 0) {
      return false;
    }

    if (!matcher) {
      return responseData.length > 0;
    }

    return responseData.some(matcher);
  } catch {
    return false;
  }
};

const hasGroupThreadActivity = async (
  groupId: string | number
): Promise<boolean> => {
  const normalizedGroupId =
    typeof groupId === "number"
      ? String(groupId)
      : typeof groupId === "string"
      ? groupId.trim()
      : "";
  if (!normalizedGroupId) return false;

  const params = new URLSearchParams({
    mode: "ALL",
    service: THREAD_SERVICE_TYPE,
    query: `qortal_qmail_thread_group${normalizedGroupId}`,
    limit: "1",
    includemetadata: "false",
    reverse: "true",
    excludeblocked: "true",
  });

  return fetchHasMailResources(params);
};

const fetchGroupAvatarPublisherName = async (
  groupId: string | number
): Promise<string | null> => {
  const normalizedGroupId =
    typeof groupId === "number"
      ? String(groupId)
      : typeof groupId === "string"
      ? groupId.trim()
      : "";
  if (!normalizedGroupId) return null;

  try {
    const params = new URLSearchParams({
      mode: "ALL",
      service: "THUMBNAIL",
      identifier: `qortal_group_avatar_${normalizedGroupId}`,
      limit: "1",
      reverse: "true",
      excludeblocked: "true",
    });
    const response = await fetch(
      `/arbitrary/resources/search?${params.toString()}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
    const responseData = await response.json();
    if (!Array.isArray(responseData) || responseData.length === 0) {
      return null;
    }
    const publisherName =
      typeof responseData[0]?.name === "string"
        ? responseData[0].name.trim()
        : "";
    return publisherName || null;
  } catch {
    return null;
  }
};

const fetchGroupAvatarUrl = async (
  groupId: string | number
): Promise<string> => {
  const normalizedGroupId =
    typeof groupId === "number"
      ? String(groupId)
      : typeof groupId === "string"
      ? groupId.trim()
      : "";
  if (!normalizedGroupId) return "";

  const publisherName = await fetchGroupAvatarPublisherName(normalizedGroupId);
  if (!publisherName) return "";

  try {
    const avatarUrl = await qortalRequest({
      action: "GET_QDN_RESOURCE_URL",
      name: publisherName,
      service: "THUMBNAIL",
      identifier: `qortal_group_avatar_${normalizedGroupId}`,
    });
    if (typeof avatarUrl !== "string") return "";
    const normalizedUrl = avatarUrl.trim();
    if (!normalizedUrl || normalizedUrl === "Resource does not exist") {
      return "";
    }
    return normalizedUrl;
  } catch {
    return "";
  }
};

const isDeletedSentResourceInSearch = (item: any): boolean => {
  const title =
    typeof item?.metadata?.title === "string"
      ? item.metadata.title.trim().toLowerCase()
      : "";
  const tags = Array.isArray(item?.metadata?.tags)
    ? item.metadata.tags.map((tag: any) => {
        return typeof tag === "string" ? tag.trim().toLowerCase() : "";
      })
    : [];
  return title === "__qmail_deleted__" || tags.includes("qmail-deleted");
};

const hasSentMailActivityForOwnedName = async (
  name: string
): Promise<boolean> => {
  const normalizedName = typeof name === "string" ? name.trim() : "";
  if (!normalizedName) return false;
  const normalizedNameLower = normalizedName.toLowerCase();

  const sentQueryConfigs: Array<{ query: string; identifier?: string }> = [
    {
      query: "_mail_qortal_qmail_",
      identifier: "_mail_",
    },
    {
      query: "qortal_qmail_",
    },
  ];

  for (const queryConfig of sentQueryConfigs) {
    const sentParams = new URLSearchParams({
      mode: "ALL",
      service: MAIL_SERVICE_TYPE,
      query: queryConfig.query,
      name: normalizedName,
      exactmatchnames: "true",
      limit: "20",
      includemetadata: "true",
      reverse: "true",
      excludeblocked: "true",
    });

    if (queryConfig.identifier) {
      sentParams.set("identifier", queryConfig.identifier);
    }

    const hasSent = await fetchHasMailResources(sentParams, item => {
      const itemName =
        typeof item?.name === "string" ? item.name.trim().toLowerCase() : "";
      const identifier =
        typeof item?.identifier === "string" ? item.identifier : "";
      return (
        itemName === normalizedNameLower &&
        isSentMailIdentifier(identifier) &&
        !isDeletedSentResourceInSearch(item)
      );
    });

    if (hasSent) {
      return true;
    }
  }

  return false;
};

const hasInboxMailActivityForOwnedName = async (
  name: string,
  ownerAddress: string
): Promise<boolean> => {
  const normalizedName = typeof name === "string" ? name.trim() : "";
  const normalizedAddress =
    typeof ownerAddress === "string" ? ownerAddress.trim() : "";
  if (!normalizedName || !normalizedAddress) return false;
  const normalizedAddressSuffix = normalizedAddress.slice(-6).toLowerCase();

  const inboxAddressQuery = `qortal_qmail_${normalizedName.slice(
    0,
    20
  )}_${normalizedAddress.slice(-6)}_mail_`;
  const expectedAddressIdentifierPrefix =
    `_mail_${inboxAddressQuery}`.toLowerCase();
  const inboxByAddressParams = new URLSearchParams({
    mode: "ALL",
    service: MAIL_SERVICE_TYPE,
    query: inboxAddressQuery,
    limit: "20",
    includemetadata: "false",
    reverse: "true",
    excludeblocked: "true",
  });

  if (
    await fetchHasMailResources(inboxByAddressParams, item => {
      const identifier =
        typeof item?.identifier === "string"
          ? item.identifier.toLowerCase()
          : "";
      return (
        identifier.startsWith(expectedAddressIdentifierPrefix) &&
        identifier.includes(`_${normalizedAddressSuffix}_mail_`)
      );
    })
  ) {
    return true;
  }

  const inboxAliasQuery = `qortal_qmail_${normalizedName}_mail_`;
  const expectedAliasIdentifierPrefix =
    `_mail_${inboxAliasQuery}`.toLowerCase();
  const inboxAliasParams = new URLSearchParams({
    mode: "ALL",
    service: MAIL_SERVICE_TYPE,
    query: inboxAliasQuery,
    limit: "20",
    includemetadata: "false",
    reverse: "true",
    excludeblocked: "true",
  });

  return fetchHasMailResources(inboxAliasParams, item => {
    const identifier =
      typeof item?.identifier === "string" ? item.identifier.toLowerCase() : "";
    return identifier.startsWith(expectedAliasIdentifierPrefix);
  });
};

const hasInboxMailActivityForSavedAlias = async (
  aliasName: string
): Promise<boolean> => {
  const normalizedAlias = typeof aliasName === "string" ? aliasName.trim() : "";
  if (!normalizedAlias) return false;

  const aliasQuery = `qortal_qmail_${normalizedAlias}_mail_`;
  const expectedAliasIdentifierPrefix = `_mail_${aliasQuery}`.toLowerCase();
  const aliasParams = new URLSearchParams({
    mode: "ALL",
    service: MAIL_SERVICE_TYPE,
    query: aliasQuery,
    limit: "20",
    includemetadata: "false",
    reverse: "true",
    excludeblocked: "true",
  });

  return fetchHasMailResources(aliasParams, item => {
    const identifier =
      typeof item?.identifier === "string" ? item.identifier.toLowerCase() : "";
    return identifier.startsWith(expectedAliasIdentifierPrefix);
  });
};

const mapMailResources = (resources: any[]) => {
  return resources.map((post: any) => {
    return {
      title: post?.metadata?.title,
      category: post?.metadata?.category,
      categoryName: post?.metadata?.categoryName,
      tags: post?.metadata?.tags || [],
      description: post?.metadata?.description,
      createdAt: post?.created,
      updated: post?.updated,
      user: post?.name,
      id: post?.identifier,
    };
  });
};

const fetchInboxMessagesForOwnedName = async (
  name: string,
  ownerAddress: string
): Promise<any[]> => {
  const normalizedName = typeof name === "string" ? name.trim() : "";
  const normalizedAddress =
    typeof ownerAddress === "string" ? ownerAddress.trim() : "";
  if (!normalizedName || !normalizedAddress) return [];

  const addressSuffix = normalizedAddress.slice(-6);
  if (!addressSuffix) return [];
  const normalizedAddressSuffix = `_${addressSuffix}_mail_`.toLowerCase();
  const byAddressQuery = `qortal_qmail_${normalizedName.slice(
    0,
    20
  )}_${addressSuffix}_mail_`;
  const byAliasQuery = `qortal_qmail_${normalizedName}_mail_`;

  const queryConfigs: Array<{
    query: string;
    matches: (identifier: string) => boolean;
  }> = [
    {
      query: byAddressQuery,
      matches: (identifier: string) => {
        const normalizedIdentifier = identifier.toLowerCase();
        return (
          normalizedIdentifier.startsWith(
            `_mail_${byAddressQuery}`.toLowerCase()
          ) && normalizedIdentifier.includes(normalizedAddressSuffix)
        );
      },
    },
    {
      query: byAliasQuery,
      matches: (identifier: string) => {
        return identifier
          .toLowerCase()
          .startsWith(`_mail_${byAliasQuery}`.toLowerCase());
      },
    },
  ];

  const allResources: any[] = [];
  const pageSize = 200;

  for (const queryConfig of queryConfigs) {
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const params = new URLSearchParams({
        mode: "ALL",
        service: MAIL_SERVICE_TYPE,
        query: queryConfig.query,
        limit: String(pageSize),
        includemetadata: "true",
        offset: String(offset),
        reverse: "true",
        excludeblocked: "true",
      });

      const response = await fetch(
        `/arbitrary/resources/search?${params.toString()}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
      const responseData = await response.json();

      if (!Array.isArray(responseData) || responseData.length === 0) {
        break;
      }

      const filteredResponse = responseData.filter((item: any) => {
        const identifier =
          typeof item?.identifier === "string" ? item.identifier : "";
        if (!identifier) return false;
        return queryConfig.matches(identifier);
      });
      allResources.push(...filteredResponse);

      if (responseData.length < pageSize) {
        hasMore = false;
      } else {
        offset += responseData.length;
      }
    }
  }

  const mapped = mapMailResources(allResources);
  const deduped = new Map<string, any>();
  mapped.forEach(item => {
    if (!item?.id) return;
    if (!deduped.has(item.id)) {
      deduped.set(item.id, item);
    }
  });

  return Array.from(deduped.values()).sort((a, b) => {
    return Number(b?.createdAt || 0) - Number(a?.createdAt || 0);
  });
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
  const isMobile = useMediaQuery("(max-width:950px)");
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
  const markMessagesAsReadRef = useRef<
    ((messages: any[]) => void | Promise<void>) | null
  >(null);
  const publishedMailStateApplyStatusRef = useRef<{
    mailMessagesApplied: boolean;
    combinedAliasInboxMessagesApplied: boolean;
  }>({
    mailMessagesApplied: false,
    combinedAliasInboxMessagesApplied: false,
  });
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
  const isAliasesViewActive =
    (!isMobile && activeMailboxItem === "aliases") ||
    (isMobile && mobileMode === "aliases");
  const isSentViewActive =
    (!isMobile && activeMailboxItem === "sent") ||
    (isMobile && mobileMode === "sent");
  const isInboxViewActive =
    (!isMobile && activeMailboxItem === "inbox") ||
    (isMobile && mobileMode === "inbox");
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
  const inboxMessagesForList = useMemo(() => {
    if (!selectedInboxInstanceName) {
      return combinedInboxMessages;
    }
    if (selectedInboxInstanceName.toLowerCase() === normalizedUserName) {
      return mailMessages;
    }
    return null;
  }, [
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

  const interval = useRef<any>(null);

  const checkNewMessagesFunc = useCallback(() => {
    if (!user?.name || !user?.address) return;
    let isCalling = false;
    interval.current = setInterval(async () => {
      if (isCalling || !user?.name || !user?.address) return;
      isCalling = true;
      const res = await checkNewMessages(user?.name, user.address);
      isCalling = false;
    }, 30000);
  }, [checkNewMessages, user]);

  useEffect(() => {
    checkNewMessagesFunc();
    return () => {
      if (interval?.current) {
        clearInterval(interval.current);
      }
    };
  }, [checkNewMessagesFunc]);

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

      if (!isMobile) {
        setActiveMailboxItem("compose");
      }
    },
    [activeAliasInboxName, aliasReplyLinks, isMobile]
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

      if (!isMobile) {
        setActiveMailboxItem("compose");
      }
    },
    [activeAliasInboxName, isMobile]
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
  const prevName = useRef<string>();
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
      setIsLoadingWatchedAliasActivity(false);
      return;
    }

    let cancelled = false;
    const populateWatchedAliasesWithMessages = async () => {
      setIsLoadingWatchedAliasActivity(true);
      try {
        const results = await Promise.all(
          watchedAliases.map(async aliasName => {
            const hasMessages = await hasInboxMailActivityForSavedAlias(
              aliasName
            );
            return {
              aliasName,
              hasMessages,
            };
          })
        );

        if (cancelled) return;
        const aliasesWithMessages = results
          .filter(result => result.hasMessages)
          .map(result => result.aliasName);
        setWatchedAliasesWithMessages(aliasesWithMessages);
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

  useEffect(() => {
    if (
      !hasAuthenticatedIdentity ||
      !user?.address ||
      !isInboxViewActive ||
      selectedInboxInstanceName
    ) {
      return;
    }

    if (!combinedAliasInboxNames.length) {
      setCombinedAliasInboxMessages({});
      return;
    }

    let canceled = false;
    const fetchCombinedAliasInboxMessages = async () => {
      setIsLoadingCombinedAliasInbox(true);
      try {
        const results = await Promise.all(
          combinedAliasInboxNames.map(async name => {
            const messages = await fetchInboxMessagesForOwnedName(
              name,
              user.address
            );
            return { name, messages };
          })
        );

        if (canceled) return;
        const nextState = results.reduce<Record<string, any[]>>(
          (accumulator, result) => {
            accumulator[result.name] = result.messages;
            return accumulator;
          },
          {}
        );
        setCombinedAliasInboxMessages(nextState);
      } finally {
        if (!canceled) {
          setIsLoadingCombinedAliasInbox(false);
        }
      }
    };

    void fetchCombinedAliasInboxMessages();
    return () => {
      canceled = true;
    };
  }, [
    combinedAliasInboxNames,
    hasAuthenticatedIdentity,
    isInboxViewActive,
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

        const response = await fetch(
          `/arbitrary/resources/search?${params.toString()}`,
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
            },
          }
        );
        const responseData = await response.json();
        if (!Array.isArray(responseData) || responseData.length === 0) {
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
      const isRead =
        (Array.isArray(message?.generalData?.threadV2) &&
          message.generalData.threadV2.length > 0) ||
        (Array.isArray(relatedHashMessage?.generalData?.threadV2) &&
          relatedHashMessage.generalData.threadV2.length > 0);

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
  }, [combinedAliasInboxMessages, hashMapMailMessages, mailMessages]);

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

  const publishMailStateToQdn = useCallback(async () => {
    if (!user?.name || !user?.address) return;
    try {
      setIsPublishingMailState(true);
      const mergedStateEntries: Record<string, QMailPublishedStateEntry> = {
        ...publishedMailStateById,
      };
      Object.entries(localMailStateById).forEach(([identifier, entry]) => {
        mergedStateEntries[identifier] = mergePublishedStateEntries(
          mergedStateEntries[identifier],
          {
            ...entry,
            updatedAt: Date.now(),
          }
        );
      });

      const payload: QMailPublishedStateDocument = {
        version: 1,
        updatedAt: Date.now(),
        ownerAddress: user.address,
        names: ownedNameCandidates,
        messages: mergedStateEntries,
      };
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

      dispatch(
        setNotification({
          msg: "Published Q-Mail read state",
          alertType: "success",
        })
      );
      setPublishedMailStateById(mergedStateEntries);
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
    dispatch,
    localMailStateById,
    ownedNameCandidates,
    publishedMailStateById,
    user?.address,
    user?.name,
  ]);

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
        const searchResponse = await fetch(
          `/arbitrary/resources/search?${searchParams.toString()}`,
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
            },
          }
        );
        const searchData = await searchResponse.json();
        if (!Array.isArray(searchData) || searchData.length === 0) {
          return;
        }

        const shouldLoad = await showLoadPublishedStateModal();
        if (!shouldLoad) {
          return;
        }

        if (rememberQdnStatePreferenceOnLoad) {
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

      if (!decodedObject || typeof decodedObject !== "object") return;
      const maybeMessages = decodedObject.messages;
      if (!maybeMessages || typeof maybeMessages !== "object") return;

      const normalizedPublishedStateById: Record<
        string,
        QMailPublishedStateEntry
      > = {};
      Object.entries(maybeMessages).forEach(([identifier, entry]) => {
        if (!identifier || typeof entry !== "object" || !entry) return;
        const normalizedEntry = normalizePublishedStateEntry(
          entry as QMailPublishedStateEntry
        );
        if (!normalizedEntry.read && !normalizedEntry.subject) return;
        normalizedPublishedStateById[identifier] = normalizedEntry;
      });

      if (!Object.keys(normalizedPublishedStateById).length) return;
      publishedMailStateApplyStatusRef.current = {
        mailMessagesApplied: false,
        combinedAliasInboxMessagesApplied: false,
      };
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
    rememberQdnStatePreferenceOnLoad,
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
      hasPendingStateChanges,
    });
  }, [
    aliasSidebarNames,
    aliasReplyLinks,
    groupOptionsWithThreads,
    hasAuthenticatedIdentity,
    hasPendingStateChanges,
    inboxSidebarNames,
    isThreadsSectionExpanded,
    isPublishingMailState,
    ownedSentNames,
    selectedAliasInboxName,
    user?.name,
  ]);
  const leftSidebarStorage = useMemo<LeftSidebarDeps["storage"]>(() => {
    return {
      get: <T,>(key: string): T | null => {
        try {
          const raw = localStorage.getItem(key);
          if (raw === null) return null;
          return JSON.parse(raw) as T;
        } catch {
          return null;
        }
      },
      set: <T,>(key: string, value: T) => {
        try {
          localStorage.setItem(key, JSON.stringify(value));
        } catch {
          /* ignore */
        }
      },
      remove: (key: string) => {
        try {
          localStorage.removeItem(key);
        } catch {
          /* ignore */
        }
      },
    };
  }, []);

  const leftSidebarConfig = useMemo<LeftSidebarConfig>(
    () => ({
      appId: "qmail",
      items: sidebarItems,
      breakpointPx: 950,
      defaults: {
        pinned: true,
        openDesktop: true,
        openMobile: false,
      },
    }),
    [sidebarItems]
  );

  const leftSidebarDeps = useMemo<LeftSidebarDeps>(
    () => ({
      storage: leftSidebarStorage,
      getViewportWidth: () => window.innerWidth,
    }),
    [leftSidebarStorage]
  );

  const leftSidebarController = useLeftSidebarController(
    leftSidebarConfig,
    leftSidebarDeps
  );
  const leftSidebarState = useLeftSidebarState(leftSidebarController);
  const leftSidebarHoverPreviewBindings = useLeftSidebarHoverPreview(
    leftSidebarController,
    {
      closeDelayMs: SIDEBAR_HOVER_CLOSE_DELAY_MS,
      onAnchorClickMode: "togglePinnedDesktop",
    }
  );

  useEffect(() => {
    leftSidebarController.setItems(sidebarItems);
  }, [leftSidebarController, sidebarItems]);

  const renderSidebarIcon = useCallback(
    (item: LeftSidebarItem) => {
      const isComposeItem = item.id === "compose";
      const iconStyle: React.CSSProperties = {
        width: isComposeItem ? "1.5rem" : "1rem",
        height: isComposeItem ? "1.5rem" : "1rem",
        objectFit: "contain",
        filter: "var(--qmail-shell-icon-filter)",
      };

      const inboxInstanceName = parseSidebarInstanceNameFromItemId(
        item.id,
        INBOX_INSTANCE_ITEM_PREFIX
      );
      const aliasesInstanceName = parseSidebarInstanceNameFromItemId(
        item.id,
        ALIASES_INSTANCE_ITEM_PREFIX
      );
      const sentInstanceName = parseSidebarInstanceNameFromItemId(
        item.id,
        SENT_INSTANCE_ITEM_PREFIX
      );
      const threadGroupId = parseSidebarGroupIdFromItemId(item.id);
      const instanceName =
        inboxInstanceName || aliasesInstanceName || sentInstanceName;
      if (instanceName) {
        const avatarUrl =
          avatarUrlByNameLowercase.get(instanceName.toLowerCase()) || undefined;
        return (
          <span
            className="qapp-lib-left-sidebar-item-icon qmail-sidebar-subitem-avatar-icon"
            aria-hidden="true"
          >
            <Avatar
              className="qmail-sidebar-subitem-avatar"
              src={avatarUrl}
              alt={instanceName}
            >
              {instanceName.charAt(0).toUpperCase()}
            </Avatar>
          </span>
        );
      }

      if (threadGroupId) {
        const groupInfo = groupOptionsById.get(threadGroupId);
        const groupName =
          typeof groupInfo?.name === "string" && groupInfo.name.trim()
            ? groupInfo.name.trim()
            : `Group ${threadGroupId}`;
        const avatarUrl = groupAvatarUrlById[threadGroupId] || undefined;
        return (
          <span
            className="qapp-lib-left-sidebar-item-icon qmail-sidebar-subitem-avatar-icon"
            aria-hidden="true"
          >
            <Avatar
              className="qmail-sidebar-subitem-avatar"
              src={avatarUrl}
              alt={groupName}
            >
              {groupName.charAt(0).toUpperCase()}
            </Avatar>
          </span>
        );
      }

      if (item.id === "inbox") {
        return <img src={MailSVG} alt="" style={iconStyle} />;
      }

      if (item.id === "sent") {
        return <img src={SendSVG} alt="" style={iconStyle} />;
      }

      if (item.id === "aliases") {
        return <img src={AddAliasSVG} alt="" style={iconStyle} />;
      }

      if (item.id === "threads") {
        return <img src={GroupSVG} alt="" style={iconStyle} />;
      }

      if (item.id === "compose") {
        return <img src={ComposeIconSVG} alt="" style={iconStyle} />;
      }

      if (item.id === ALIAS_COMPOSE_ITEM_ID) {
        return <img src={ReplySVG} alt="" style={iconStyle} />;
      }

      if (item.id === PUBLISH_STATE_ITEM_ID) {
        const hasPendingChanges = item.badgeText === "!";
        return (
          <PublishIcon
            sx={{
              fontSize: "1rem",
              color: hasPendingChanges
                ? "var(--qmail-warning-border, rgba(255, 171, 64, 0.95))"
                : "inherit",
            }}
          />
        );
      }

      return null;
    },
    [avatarUrlByNameLowercase, groupAvatarUrlById, groupOptionsById]
  );

  const onSelectSidebarItem = useCallback(
    (itemId: string) => {
      const closeSidebarIfTransient = () => {
        leftSidebarController.handleOutsideInteraction();
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
      leftSidebarController,
      publishMailStateToQdn,
      selectedAliasInboxName,
    ]
  );

  useEffect(() => {
    setPublishedMailStateById({});
    publishedMailStateApplyStatusRef.current = {
      mailMessagesApplied: false,
      combinedAliasInboxMessagesApplied: false,
    };
  }, [user?.address, user?.name]);

  useEffect(() => {
    setRememberQdnStatePreferenceOnLoad(false);
  }, [user?.address, user?.name]);

  useEffect(() => {
    if (!Object.keys(publishedMailStateById).length) {
      publishedMailStateApplyStatusRef.current = {
        mailMessagesApplied: false,
        combinedAliasInboxMessagesApplied: false,
      };
      return;
    }

    const readIdSet = new Set<string>();
    Object.entries(publishedMailStateById).forEach(([identifier, entry]) => {
      if (!identifier || !entry?.read) return;
      readIdSet.add(identifier);
    });

    const applyStatus = publishedMailStateApplyStatusRef.current;
    if (!readIdSet.size) {
      applyStatus.mailMessagesApplied = true;
      applyStatus.combinedAliasInboxMessagesApplied = true;
      return;
    }

    if (!applyStatus.mailMessagesApplied && mailMessages.length > 0) {
      const updatedMailMessages = applyReadStateToMessages(
        mailMessages,
        readIdSet
      );
      applyStatus.mailMessagesApplied = true;
      if (updatedMailMessages !== mailMessages) {
        dispatch(upsertMessages(updatedMailMessages));
      }
    }

    if (
      !applyStatus.combinedAliasInboxMessagesApplied &&
      Object.keys(combinedAliasInboxMessages).length > 0
    ) {
      const updatedCombinedAliasInboxMessages = applyReadStateToCombinedMap(
        combinedAliasInboxMessages,
        readIdSet
      );
      applyStatus.combinedAliasInboxMessagesApplied = true;
      if (updatedCombinedAliasInboxMessages !== combinedAliasInboxMessages) {
        setCombinedAliasInboxMessages(updatedCombinedAliasInboxMessages);
      }
    }
  }, [
    applyReadStateToCombinedMap,
    applyReadStateToMessages,
    combinedAliasInboxMessages,
    dispatch,
    mailMessages,
    publishedMailStateById,
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

  useEffect(() => {
    const onToggleChangelog = () => {
      setIsOpen(false);
      setMessage(null);
      setIsChangelogOpen(prev => !prev);
    };
    subscribeToEvent("qmail:toggle-changelog", onToggleChangelog);
    return () => {
      unsubscribeFromEvent("qmail:toggle-changelog", onToggleChangelog);
    };
  }, []);

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

  useEffect(() => {
    leftSidebarController.setActiveItem(activeSidebarItem);
  }, [activeSidebarItem, leftSidebarController]);

  useEffect(() => {
    leftSidebarController.setViewportWidth(window.innerWidth);
    const handleResize = () => {
      leftSidebarController.setViewportWidth(window.innerWidth);
    };
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [leftSidebarController]);

  useEffect(() => {
    const onAnchorClick = () => {
      leftSidebarHoverPreviewBindings.onAnchorClick();
    };
    const onAnchorPointerEnter = () => {
      leftSidebarHoverPreviewBindings.onAnchorPointerEnter();
    };
    const onAnchorPointerLeave = () => {
      leftSidebarHoverPreviewBindings.onAnchorPointerLeave();
    };

    subscribeToEvent("qmail:left-sidebar-anchor-click", onAnchorClick);
    subscribeToEvent(
      "qmail:left-sidebar-anchor-pointer-enter",
      onAnchorPointerEnter
    );
    subscribeToEvent(
      "qmail:left-sidebar-anchor-pointer-leave",
      onAnchorPointerLeave
    );

    return () => {
      unsubscribeFromEvent("qmail:left-sidebar-anchor-click", onAnchorClick);
      unsubscribeFromEvent(
        "qmail:left-sidebar-anchor-pointer-enter",
        onAnchorPointerEnter
      );
      unsubscribeFromEvent(
        "qmail:left-sidebar-anchor-pointer-leave",
        onAnchorPointerLeave
      );
    };
  }, [leftSidebarHoverPreviewBindings]);

  useEffect(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }
      leftSidebarController.handleEscapeKey();
    };
    document.addEventListener("keydown", handleKeydown);
    return () => {
      document.removeEventListener("keydown", handleKeydown);
    };
  }, [leftSidebarController]);

  useEffect(() => {
    if (!leftSidebarState.open) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }
      if (target.closest(".qapp-lib-top-bar-icon")) {
        return;
      }
      if (target.closest("[data-qapp-lib='left-sidebar']")) {
        return;
      }
      leftSidebarController.handleOutsideInteraction();
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [leftSidebarController, leftSidebarState.open]);

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

  return (
    <MailContainer className="qmail-mail-page">
      <LoadPublishedStateModal />
      {isMailBootstrapLoading && (
        <Box
          sx={{
            width: "100%",
            display: "flex",
            flexDirection: "column",
            borderBottom: "1px solid var(--qmail-warning-border, rgba(255, 171, 64, 0.95))",
            background:
              "linear-gradient(90deg, rgba(255, 171, 64, 0.24), rgba(255, 171, 64, 0.12) 55%, var(--qmail-shell-bg))",
            boxShadow: "0 10px 24px rgba(0, 0, 0, 0.22)",
            backdropFilter: "blur(10px)",
            position: "sticky",
            top: 0,
            zIndex: 4,
            flexShrink: 0,
          }}
          role="status"
          aria-live="polite"
        >
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: "14px",
              padding: {
                xs: "12px 14px",
                md: "14px 18px",
              },
            }}
          >
            <Box
              sx={{
                width: "42px",
                height: "42px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: "999px",
                backgroundColor: "var(--qmail-shell-bg)",
                border: "1px solid var(--qmail-warning-border, rgba(255, 171, 64, 0.95))",
                boxShadow: "0 0 0 4px rgba(255, 171, 64, 0.12)",
                flexShrink: 0,
              }}
            >
              <CircularProgress
                size={30}
                thickness={4.5}
                sx={{
                  color: "var(--qmail-warning-border, rgba(255, 171, 64, 0.95))",
                }}
              />
            </Box>
            <Box
              sx={{
                minWidth: 0,
                flex: 1,
                display: "flex",
                flexDirection: "column",
                gap: "2px",
              }}
            >
              <Typography
                sx={{
                  fontSize: {
                    xs: "0.68rem",
                    md: "0.72rem",
                  },
                  fontWeight: 800,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "var(--qmail-warning-border, rgba(255, 171, 64, 0.95))",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                Loading
              </Typography>
              <Typography
                sx={{
                  fontSize: {
                    xs: "0.92rem",
                    md: "0.98rem",
                  },
                  fontWeight: 800,
                  color: "var(--qmail-thread-text)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                Fetching mail and state...
              </Typography>
              <Typography
                sx={{
                  fontSize: {
                    xs: "0.78rem",
                    md: "0.82rem",
                  },
                  fontWeight: 500,
                  color: "var(--qmail-thread-subtle-text)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  display: {
                    xs: "none",
                    sm: "block",
                  },
                }}
              >
                QDN state and inbox history are still syncing. This can take a
                bit on larger mailboxes.
              </Typography>
            </Box>
          </Box>
          <LinearProgress
            sx={{
              height: "4px",
              borderRadius: 0,
              backgroundColor: "rgba(0, 0, 0, 0.06)",
              "& .MuiLinearProgress-bar": {
                backgroundColor: "var(--qmail-warning-border, rgba(255, 171, 64, 0.95))",
              },
            }}
          />
        </Box>
      )}
      <>
        {!isMobile && (
          <MailBody>
            <LeftSidebar
              state={leftSidebarState}
              controller={leftSidebarController}
              onSelectItem={onSelectSidebarItem}
              renderItemIcon={renderSidebarIcon}
              hoverPreviewBindings={{
                onSidebarPointerEnter:
                  leftSidebarHoverPreviewBindings.onSidebarPointerEnter,
                onSidebarPointerLeave:
                  leftSidebarHoverPreviewBindings.onSidebarPointerLeave,
              }}
            />
            <Box
              sx={{
                display: "flex",
                flex: 1,
                minWidth: 0,
              }}
            >
              {isChangelogOpen ? (
                <MailBodyInner sx={{ width: "100%" }}>
                  <MailBodyInnerScroll
                    sx={{
                      direction: "rtl",
                      height: "100%",
                    }}
                  >
                    <Box
                      sx={{
                        display: "flex",
                        width: "100%",
                        flexDirection: "column",
                        alignItems: "center",
                        direction: "ltr",
                      }}
                    >
                      <ChangelogPage />
                    </Box>
                  </MailBodyInnerScroll>
                </MailBodyInner>
              ) : activeMailboxItem === "compose" ? (
                <MailBodyInner sx={{ width: "100%" }}>
                  <Box
                    sx={{
                      flex: 1,
                      minHeight: 0,
                      width: "100%",
                    }}
                  >
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
                      onRequestClose={() => {
                        const shouldReturnToAliasInbox =
                          composeMode === "alias" &&
                          Boolean(selectedAliasInboxName);
                        setComposeRecipientAlias(null);
                        setComposeRequireReplyAlias(false);
                        setComposeDefaultReplyAlias("");
                        setComposeMode("standard");
                        if (composeReturnView === "threads") {
                          setActiveMailboxItem("threads");
                          setMobileMode("threads");
                          if (composeReturnGroupId) {
                            const returnGroup =
                              groupOptionsById.get(composeReturnGroupId);
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
                      }}
                    />
                  </Box>
                </MailBodyInner>
              ) : activeMailboxItem === "threads" ? (
                <MailBodyInner sx={{ width: "100%" }}>
                  <MailBodyInnerScroll
                    sx={{
                      direction: "ltr",
                      height: "100%",
                    }}
                  >
                    <Box
                      className="step-1"
                      sx={{
                        display: "flex",
                        width: "100%",
                        flexDirection: "column",
                        alignItems: "center",
                        direction: "ltr",
                      }}
                    >
                      {hasAuthenticatedIdentity ? (
                        selectedGroup ? (
                          <GroupMail
                            groupInfo={selectedGroup}
                            currentThread={currentThread}
                            setCurrentThread={setCurrentThread}
                            filterMode={filterMode}
                            setFilterMode={setFilterMode}
                            onRequestComposeThread={handleRequestComposeThread}
                          />
                        ) : (
                          <ThreadsMailbox
                            groups={groupOptionsWithThreads}
                            groupAvatarUrlById={groupAvatarUrlById}
                            isLoadingGroups={isLoadingGroupInstances}
                            onOpenThread={(thread, group) => {
                              setSelectedGroup(group);
                              setCurrentThread(thread);
                              setIsOpen(false);
                              setMessage(null);
                            }}
                          />
                        )
                      ) : (
                        renderAuthenticationPrompt("Threads")
                      )}
                    </Box>
                  </MailBodyInnerScroll>
                </MailBodyInner>
              ) : activeMailboxItem === "aliases" ? (
                <MailBodyInner sx={{ width: "100%" }}>
                  <MailBodyInnerScroll
                    sx={{
                      direction: "ltr",
                      height: "100%",
                    }}
                  >
                    <Box
                      className="step-1"
                      sx={{
                        display: "flex",
                        width: "100%",
                        flexDirection: "column",
                        alignItems: "center",
                        direction: "ltr",
                      }}
                    >
                      {hasAuthenticatedIdentity ? (
                        activeAliasInboxName ? (
                          <AliasMail
                            value={activeAliasInboxName}
                            onOpen={openMessage}
                            messageOpenedId={message?.id}
                          />
                        ) : (
                          <AliasesPage
                            aliases={watchedAliases}
                            aliasesWithMessages={watchedAliasesWithMessages}
                            replyAliasLinks={aliasReplyLinks}
                            isLoadingAliasesWithMessages={
                              isLoadingWatchedAliasActivity
                            }
                            onOpenAlias={aliasName => {
                              setSelectedAlias(aliasName);
                              setSelectedAliasScope("aliases");
                            }}
                            onAddAlias={aliasName => {
                              setSelectedAlias(null);
                              setSelectedAliasScope(null);
                              const didAdd = addWatchedAliasByName(aliasName);
                              if (didAdd) {
                                dispatch(
                                  setNotification({
                                    msg: `Alias saved: ${aliasName}`,
                                    alertType: "success",
                                  })
                                );
                              } else {
                                dispatch(
                                  setNotification({
                                    msg: "Alias is already saved or invalid",
                                    alertType: "info",
                                  })
                                );
                              }
                            }}
                            onRemoveAlias={aliasName => {
                              removeWatchedAlias(aliasName);
                            }}
                            onSetReplyAlias={(aliasName, replyAlias) => {
                              const didSet = setLinkedReplyAlias(
                                aliasName,
                                replyAlias
                              );
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
                            scanCheckpointTimestamp={
                              aliasScanCheckpointTimestamp
                            }
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
                        )
                      ) : (
                        renderAuthenticationPrompt("Inbox")
                      )}
                    </Box>
                  </MailBodyInnerScroll>
                </MailBodyInner>
              ) : (
                <MailBodyInner sx={{ width: "100%" }}>
                  {isOpen && message ? (
                    <>
                      <MailBodyInnerScroll
                        sx={{
                          direction: "rtl",
                          height: "100%",
                        }}
                      >
                        <Box
                          className="step-1"
                          sx={{
                            display: "flex",
                            width: "100%",
                            flexDirection: "column",
                            alignItems: "center",
                            direction: "ltr",
                          }}
                        >
                          <ShowMessageV2
                            isOpen={isOpen}
                            setIsOpen={setIsOpen}
                            message={message}
                            setReplyTo={openReplyComposerFromMessage}
                            setForwardInfo={openForwardComposerFromMessage}
                            alias={activeAliasInboxName}
                            onClose={() => {
                              setIsOpen(false);
                              setMessage(null);
                            }}
                          />
                        </Box>
                      </MailBodyInnerScroll>
                    </>
                  ) : (
                    <>
                      <MailBodyInnerScroll
                        sx={{
                          direction:
                            activeMailboxItem === "sent" ? "rtl" : "ltr",
                          height: "100%",
                        }}
                      >
                        <Box
                          className="step-1"
                          sx={{
                            display: "flex",
                            width: "100%",
                            flexDirection: "column",
                            alignItems: "center",
                            direction: "ltr",
                          }}
                        >
                          {activeMailboxItem === "sent" ? (
                            hasAuthenticatedIdentity ? (
                              <SentMail
                                instanceNames={sentInstanceNamesForCurrentView}
                                onOpen={openMessage}
                                openedMessageId={
                                  message?.id || message?.identifier
                                }
                              />
                            ) : (
                              renderAuthenticationPrompt("Sent")
                            )
                          ) : hasAuthenticatedIdentity ? (
                            <>
                              {!shouldRenderAliasInboxMailbox && (
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
                                    openedMessageId={
                                      message?.id || message?.identifier
                                    }
                                    onMarkAsRead={markMessagesAsRead}
                                    onMarkAsUnread={markMessagesAsUnread}
                                  />
                                  {isLoading && (
                                    <Box
                                      sx={{
                                        display: "flex",
                                        width: "100%",
                                        justifyContent: "center",
                                      }}
                                    >
                                      <CircularProgress />
                                    </Box>
                                  )}
                                  {!selectedInboxInstanceName &&
                                    isLoadingCombinedAliasInbox && (
                                      <Box
                                        sx={{
                                          display: "flex",
                                          width: "100%",
                                          justifyContent: "center",
                                        }}
                                      >
                                        <CircularProgress />
                                      </Box>
                                    )}
                                </>
                              )}

                              {shouldRenderAliasInboxMailbox && (
                                <AliasMail
                                  value={activeAliasInboxName || ""}
                                  onOpen={openMessage}
                                  messageOpenedId={message?.id}
                                />
                              )}
                              <Joyride
                                steps={steps}
                                run={run}
                                callback={handleJoyrideCallback}
                                continuous={true}
                                scrollToFirstStep={true}
                                showProgress={true}
                                showSkipButton={true}
                              />
                            </>
                          ) : (
                            renderAuthenticationPrompt("Inbox")
                          )}
                          {mailInfo && isShow && (
                            <OpenMail
                              open={isShow}
                              handleClose={onOk}
                              fileInfo={mailInfo}
                            />
                          )}
                        </Box>
                      </MailBodyInnerScroll>
                    </>
                  )}
                </MailBodyInner>
              )}
            </Box>
          </MailBody>
        )}
        {isMobile && (
          <MailBody
            sx={{
              height: "100%",
            }}
          >
            <LeftSidebar
              state={leftSidebarState}
              controller={leftSidebarController}
              onSelectItem={onSelectSidebarItem}
              renderItemIcon={renderSidebarIcon}
              hoverPreviewBindings={{
                onSidebarPointerEnter:
                  leftSidebarHoverPreviewBindings.onSidebarPointerEnter,
                onSidebarPointerLeave:
                  leftSidebarHoverPreviewBindings.onSidebarPointerLeave,
              }}
            />
            {isChangelogOpen && (
              <Box
                sx={{
                  position: "absolute",
                  top: 0,
                  bottom: 0,
                  left: 0,
                  right: 0,
                  zIndex: 6,
                  backgroundColor: "var(--Mail-Background)",
                }}
              >
                <MailBodyInnerScroll
                  sx={{
                    direction: "rtl",
                    height: "100%",
                  }}
                >
                  <Box
                    sx={{
                      display: "flex",
                      width: "100%",
                      flexDirection: "column",
                      alignItems: "center",
                      direction: "ltr",
                    }}
                  >
                    <ChangelogPage />
                  </Box>
                </MailBodyInnerScroll>
              </Box>
            )}
            {isOpen && message && (
              <Box
                sx={{
                  position: "absolute",
                  top: 0,
                  bottom: 0,
                  left: 0,
                  right: 0,
                  zIndex: 5,
                  backgroundColor: "var(--Mail-Background)",
                }}
              >
                <MailBodyInnerScroll
                  sx={{
                    direction: "rtl",
                    height: "100%",
                  }}
                >
                  <Box
                    className="step-1"
                    sx={{
                      display: "flex",
                      width: "100%",
                      flexDirection: "column",
                      alignItems: "center",
                      direction: "ltr",
                    }}
                  >
                    <ShowMessageV2
                      isOpen={isOpen}
                      setIsOpen={setIsOpen}
                      message={message}
                      setReplyTo={openReplyComposerFromMessage}
                      setForwardInfo={openForwardComposerFromMessage}
                      alias={activeAliasInboxName}
                      onClose={() => {
                        setIsOpen(false);
                        setMessage(null);
                      }}
                    />
                  </Box>
                </MailBodyInnerScroll>
              </Box>
            )}
            {mailInfo && isShow && (
              <OpenMail open={isShow} handleClose={onOk} fileInfo={mailInfo} />
            )}

            {mobileMode === "compose" && (
              <MailBodyInner
                sx={{
                  width: "100%",
                }}
              >
                <Box
                  sx={{
                    width: "100%",
                    height: "100%",
                    minHeight: 0,
                  }}
                >
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
                    onRequestClose={() => {
                      const shouldReturnToAliasInbox =
                        composeMode === "alias" &&
                        Boolean(selectedAliasInboxName);
                      setComposeRecipientAlias(null);
                      setComposeRequireReplyAlias(false);
                      setComposeDefaultReplyAlias("");
                      setComposeMode("standard");
                      if (composeReturnView === "threads") {
                        setMobileMode("threads");
                        setActiveMailboxItem("threads");
                        if (composeReturnGroupId) {
                          const returnGroup =
                            groupOptionsById.get(composeReturnGroupId);
                          if (returnGroup) {
                            setSelectedGroup(returnGroup);
                          }
                        }
                      } else if (shouldReturnToAliasInbox) {
                        setMobileMode("aliases");
                        setActiveMailboxItem("aliases");
                        setSelectedAlias(selectedAliasInboxName);
                        setSelectedAliasScope("aliases");
                      } else {
                        setMobileMode("inbox");
                        setActiveMailboxItem("inbox");
                        setSelectedAlias(null);
                        setSelectedAliasScope(null);
                      }
                      setComposePrefill(null);
                      setComposeReturnView("inbox");
                      setComposeReturnGroupId(null);
                    }}
                  />
                </Box>
              </MailBodyInner>
            )}

            {mobileMode === "aliases" && (
              <MailBodyInner
                sx={{
                  width: "100%",
                }}
              >
                <MailBodyInnerScroll
                  sx={{
                    direction: "ltr",
                    height: "100%",
                  }}
                >
                  <Box
                    sx={{
                      display: "flex",
                      width: "100%",
                      flexDirection: "column",
                      alignItems: "center",
                      direction: "ltr",
                    }}
                  >
                    {hasAuthenticatedIdentity ? (
                      activeAliasInboxName ? (
                        <AliasMail
                          value={activeAliasInboxName}
                          onOpen={openMessage}
                          messageOpenedId={message?.id}
                        />
                      ) : (
                        <AliasesPage
                          aliases={watchedAliases}
                          aliasesWithMessages={watchedAliasesWithMessages}
                          replyAliasLinks={aliasReplyLinks}
                          isLoadingAliasesWithMessages={
                            isLoadingWatchedAliasActivity
                          }
                          onOpenAlias={aliasName => {
                            setSelectedAlias(aliasName);
                            setSelectedAliasScope("aliases");
                          }}
                          onAddAlias={aliasName => {
                            setSelectedAlias(null);
                            setSelectedAliasScope(null);
                            const didAdd = addWatchedAliasByName(aliasName);
                            if (didAdd) {
                              dispatch(
                                setNotification({
                                  msg: `Alias saved: ${aliasName}`,
                                  alertType: "success",
                                })
                              );
                            } else {
                              dispatch(
                                setNotification({
                                  msg: "Alias is already saved or invalid",
                                  alertType: "info",
                                })
                              );
                            }
                          }}
                          onRemoveAlias={aliasName => {
                            removeWatchedAlias(aliasName);
                          }}
                          onSetReplyAlias={(aliasName, replyAlias) => {
                            const didSet = setLinkedReplyAlias(
                              aliasName,
                              replyAlias
                            );
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
                      )
                    ) : (
                      renderAuthenticationPrompt("Inbox")
                    )}
                  </Box>
                </MailBodyInnerScroll>
              </MailBodyInner>
            )}

            {mobileMode === "inbox" && (
              <MailBodyInner
                sx={{
                  width: "100%",
                }}
              >
                <Spacer height="15px" />
                <Box
                  sx={{
                    display: "flex",
                    gap: "20px",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <ButtonBase
                    onClick={() => {
                      setMobileMode("inbox");
                    }}
                    sx={{
                      height: "40px",
                    }}
                  >
                    <MailBodyInnerHeader
                      sx={{
                        marginTop: "0px",
                        marginBottom: "0px",
                        outline:
                          "1px solid var(--qmail-shell-mobile-toggle-border)",
                        padding: "4px 8px",
                        borderRadius: "5px",
                        height: "100%",
                      }}
                    >
                      <MailIconImg src={MailSVG} />
                      <ComposeP>Inbox</ComposeP>
                    </MailBodyInnerHeader>
                  </ButtonBase>
                  <ButtonBase
                    onClick={() => {
                      setMobileMode("sent");
                    }}
                    sx={{
                      height: "40px",
                    }}
                  >
                    <MailBodyInnerHeader
                      sx={{
                        marginTop: "0px",
                        marginBottom: "0px",
                        outline: "none",
                        padding: "4px 8px",
                        borderRadius: "5px",
                        height: "100%",
                      }}
                    >
                      <MailIconImg src={SendSVG} />
                      <ComposeP>Sent</ComposeP>
                    </MailBodyInnerHeader>
                  </ButtonBase>
                </Box>
                <Spacer height="15px" />

                <MailBodyInnerScroll
                  sx={{
                    borderRight: "1px solid var(--qmail-shell-border)",
                    height: "calc(100% - 75px)",
                  }}
                >
                  <Box
                    className="step-1"
                    sx={{
                      display: "flex",
                      width: "100%",
                      flexDirection: "column",
                      alignItems: "center",
                    }}
                  >
                    {hasAuthenticatedIdentity ? (
                      <>
                        {!shouldRenderAliasInboxMailbox && (
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
                              openedMessageId={
                                message?.id || message?.identifier
                              }
                              onMarkAsRead={markMessagesAsRead}
                              onMarkAsUnread={markMessagesAsUnread}
                            />
                            {isLoading && (
                              <Box
                                sx={{
                                  display: "flex",
                                  width: "100%",
                                  justifyContent: "center",
                                }}
                              >
                                <CircularProgress />
                              </Box>
                            )}
                            {!selectedInboxInstanceName &&
                              isLoadingCombinedAliasInbox && (
                                <Box
                                  sx={{
                                    display: "flex",
                                    width: "100%",
                                    justifyContent: "center",
                                  }}
                                >
                                  <CircularProgress />
                                </Box>
                              )}
                          </>
                        )}
                        {shouldRenderAliasInboxMailbox && (
                          <AliasMail
                            value={activeAliasInboxName || ""}
                            onOpen={openMessage}
                            messageOpenedId={message?.id}
                          />
                        )}
                      </>
                    ) : (
                      renderAuthenticationPrompt("Inbox")
                    )}
                  </Box>
                </MailBodyInnerScroll>
              </MailBodyInner>
            )}

            {mobileMode === "sent" && (
              <MailBodyInner
                sx={{
                  width: "100%",
                }}
              >
                <>
                  <Spacer height="15px" />
                  <Box
                    sx={{
                      display: "flex",
                      gap: "20px",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <ButtonBase
                      onClick={() => {
                        setMobileMode("inbox");
                      }}
                      sx={{
                        height: "40px",
                      }}
                    >
                      <MailBodyInnerHeader
                        sx={{
                          marginTop: "0px",
                          marginBottom: "0px",
                          outline: "none",
                          padding: "4px 8px",
                          borderRadius: "5px",
                          height: "100%",
                        }}
                      >
                        <MailIconImg src={MailSVG} />
                        <ComposeP>Inbox</ComposeP>
                      </MailBodyInnerHeader>
                    </ButtonBase>
                    <ButtonBase
                      onClick={() => {
                        setMobileMode("sent");
                      }}
                      sx={{
                        height: "40px",
                      }}
                    >
                      <MailBodyInnerHeader
                        sx={{
                          marginTop: "0px",
                          marginBottom: "0px",
                          outline:
                            "1px solid var(--qmail-shell-mobile-toggle-border)",
                          padding: "4px 8px",
                          borderRadius: "5px",
                          height: "100%",
                        }}
                      >
                        <MailIconImg src={SendSVG} />
                        <ComposeP>Sent</ComposeP>
                      </MailBodyInnerHeader>
                    </ButtonBase>
                  </Box>
                  <Spacer height="15px" />
                  <MailBodyInnerScroll
                    sx={{
                      direction: "rtl",
                      display: isOpen && message ? "none" : "flex",
                      height: "calc(100% - 75px)",
                    }}
                  >
                    <Box
                      className="step-1"
                      sx={{
                        display: "flex",
                        width: "100%",
                        flexDirection: "column",
                        alignItems: "center",
                        direction: "ltr",
                      }}
                    >
                      {hasAuthenticatedIdentity ? (
                        <SentMail
                          instanceNames={sentInstanceNamesForCurrentView}
                          onOpen={openMessage}
                          openedMessageId={message?.id || message?.identifier}
                        />
                      ) : (
                        renderAuthenticationPrompt("Sent")
                      )}
                    </Box>
                  </MailBodyInnerScroll>
                </>
              </MailBodyInner>
            )}
            {mobileMode === "threads" && (
              <MailBodyInner
                sx={{
                  width: "100%",
                }}
              >
                <>
                  <Spacer height="15px" />
                  <Box
                    sx={{
                      display: "flex",
                      gap: "12px",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <ButtonBase
                      onClick={() => {
                        setMobileMode("inbox");
                        setActiveMailboxItem("inbox");
                        setSelectedGroup(null);
                        setCurrentThread(null);
                      }}
                      sx={{
                        height: "40px",
                      }}
                    >
                      <MailBodyInnerHeader
                        sx={{
                          marginTop: "0px",
                          marginBottom: "0px",
                          outline: "none",
                          padding: "4px 8px",
                          borderRadius: "5px",
                          height: "100%",
                        }}
                      >
                        <MailIconImg src={MailSVG} />
                        <ComposeP>Inbox</ComposeP>
                      </MailBodyInnerHeader>
                    </ButtonBase>
                    <ButtonBase
                      onClick={() => {
                        setMobileMode("sent");
                        setActiveMailboxItem("sent");
                        setSelectedGroup(null);
                        setCurrentThread(null);
                      }}
                      sx={{
                        height: "40px",
                      }}
                    >
                      <MailBodyInnerHeader
                        sx={{
                          marginTop: "0px",
                          marginBottom: "0px",
                          outline: "none",
                          padding: "4px 8px",
                          borderRadius: "5px",
                          height: "100%",
                        }}
                      >
                        <MailIconImg src={SendSVG} />
                        <ComposeP>Sent</ComposeP>
                      </MailBodyInnerHeader>
                    </ButtonBase>
                    <ButtonBase
                      onClick={() => {
                        setMobileMode("threads");
                        setActiveMailboxItem("threads");
                      }}
                      sx={{
                        height: "40px",
                      }}
                    >
                      <MailBodyInnerHeader
                        sx={{
                          marginTop: "0px",
                          marginBottom: "0px",
                          outline:
                            "1px solid var(--qmail-shell-mobile-toggle-border)",
                          padding: "4px 8px",
                          borderRadius: "5px",
                          height: "100%",
                        }}
                      >
                        <MailIconImg src={GroupSVG} />
                        <ComposeP>Threads</ComposeP>
                      </MailBodyInnerHeader>
                    </ButtonBase>
                  </Box>
                  <Spacer height="15px" />
                  <MailBodyInnerScroll
                    sx={{
                      direction: "ltr",
                      display: isOpen && message ? "none" : "flex",
                      height: "calc(100% - 75px)",
                    }}
                  >
                    <Box
                      className="step-1"
                      sx={{
                        display: "flex",
                        width: "100%",
                        flexDirection: "column",
                        alignItems: "center",
                        direction: "ltr",
                      }}
                    >
                      {hasAuthenticatedIdentity ? (
                        selectedGroup ? (
                          <GroupMail
                            groupInfo={selectedGroup}
                            currentThread={currentThread}
                            setCurrentThread={setCurrentThread}
                            filterMode={filterMode}
                            setFilterMode={setFilterMode}
                            onRequestComposeThread={handleRequestComposeThread}
                          />
                        ) : (
                          <ThreadsMailbox
                            groups={groupOptionsWithThreads}
                            groupAvatarUrlById={groupAvatarUrlById}
                            isLoadingGroups={isLoadingGroupInstances}
                            onOpenThread={(thread, group) => {
                              setSelectedGroup(group);
                              setCurrentThread(thread);
                              setIsOpen(false);
                              setMessage(null);
                            }}
                          />
                        )
                      ) : (
                        renderAuthenticationPrompt("Threads")
                      )}
                    </Box>
                  </MailBodyInnerScroll>
                </>
              </MailBodyInner>
            )}
          </MailBody>
        )}
      </>
    </MailContainer>
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
