import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ReusableModal } from "../../components/modals/ReusableModal";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  CircularProgress,
  IconButton,
  Input,
  LinearProgress,
  MenuItem,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { useLayoutMode } from "../../layout/useLayoutMode";
import { SHORT_FRAME_MEDIA, useLandscapeFrame } from "../../utils/hubFrame";
import ShortUniqueId from "short-unique-id";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../../state/store";
import { useDropzone } from "react-dropzone";
import CloseIcon from "@mui/icons-material/Close";
import { setNotification } from "../../state/features/notificationsSlice";
import { useParams } from "react-router-dom";
import { extensionFromMimeType } from "../../utils/fileExtension";
import { objectToBase64, toBase64 } from "../../utils/toBase64";
import {
  MAIL_ATTACHMENT_SERVICE_TYPE,
  MAIL_SERVICE_TYPE,
  THREAD_SERVICE_TYPE,
} from "../../constants/mail";
import useConfirmationModal from "../../hooks/useConfirmModal";
import { MultiplePublish } from "../../components/common/MultiplePublish/MultiplePublish";
import {
  ChipInputComponent,
  NameChip,
} from "../../components/common/ChipInputComponent/ChipInputComponent";
import { TextEditor } from "../../components/common/TextEditor/TextEditor";
import { toPublishedMailHtml } from "../../components/common/TextEditor/quillHtml";
import {
  AttachmentContainer,
  ComposeContainer,
  ComposeIcon,
  ComposeP,
  InstanceFooter,
  InstanceListContainer,
  NewMessageAliasContainer,
  NewMessageAttachmentImg,
  NewMessageInputLabelP,
  NewMessageInputRow,
} from "./Mail-styles";
import ComposeIconSVG from "../../assets/svgs/ComposeIcon.svg";
import AttachmentSVG from "../../assets/svgs/NewMessageAttachment.svg";
import { SendNewMessage } from "../../assets/svgs/SendNewMessage";
import { formatBytes } from "../../utils/displaySize";
import { formatFullTimestamp } from "../../utils/time";
import { extractTextFromSlate } from "../../utils/extractTextFromSlate";
import { CreateThreadIcon } from "../../assets/svgs/CreateThreadIcon";
import {
  buildDirectMailPublishRequest,
  buildForwardHtml,
  buildReplyQuoteHtml,
  messageBodyLines,
  recipientActivityByName,
  replyAllRecipients,
  sortNamesByRecency,
  withSubjectPrefix,
} from "../../utils/mailCompose";
import {
  buildNewMessageBody,
  footerBlockFor,
  readMailFooter,
  swapFooterInBody,
  type FooterKind,
} from "../../utils/mailFooter";
import {
  lookupName,
  lookupPublicKey,
  peekName,
  resolveName,
  searchDirectoryNames,
} from "../../utils/nameCache";
import { AvatarWrapper } from "./MailTable";
import { HIDDEN_CHARACTERS_TITLE, NameText, strikeNameSx } from "../../components/common/NameText";
import { NameAvatar } from "../../components/common/NameAvatar";
import { hasInvisibleCharacters } from "../../utils/invisibleCharacters";
import type { Theme } from "@mui/material/styles";
import ForumOutlinedIcon from "@mui/icons-material/ForumOutlined";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutlined";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutlined";
import {
  composeDraftKey,
  createComposeDraftId,
  deleteComposeDraft,
  hasComposerContent,
  readComposeDrafts,
  saveComposeDraft,
  type StoredComposeDraft,
} from "./composeDrafts";
import {
  fetchAttachmentFile,
  type AttachmentFetchProgress,
  type AttachmentReference,
} from "../../utils/attachmentBytes";
import { getGroupPublicKeys } from "../../utils/groupMembersCache";
import { fetchingLabel } from "../../layout/states";

const uid = new ShortUniqueId();
const maxSize = 40 * 1024 * 1024; // 40 MB in bytes

const aliasToggleSx = {
  textTransform: "none",
  minHeight: 44,
  px: 1,
  fontWeight: 500,
  color: "var(--qmail-compose-muted)",
  "&:hover": { color: "var(--qmail-compose-text)" },
} as const;

/**
 * What "Send to alias", "Cc" and "Bcc" do, on hover, keyboard focus or a long
 * press. Checked against the send path (buildDirectMailPublishRequest, data
 * contract §3, §8, §17): every copy of a send shares one send id, is a public
 * record under the From name labelled with its recipient's name (or the
 * alias), and is encrypted to To, Cc and Bcc alike; the mail lists To and Cc,
 * never Bcc; an alias message gets no Cc or Bcc copies.
 */
export const COMPOSE_TOGGLE_HELP = {
  alias:
    "Sends to an alias inbox the recipient told you about, not to their name inbox, so the public QDN record shows the alias, not their name. It is still encrypted to the recipient, and you stay the sender.",
  cc: "Each Cc name gets its own encrypted copy. Everyone who gets the mail can see the Cc names.",
  bcc: "Each Bcc name gets its own encrypted copy, and the mail doesn't list Bcc names. But each copy is a public QDN record under your name, labelled with that name and sharing one send id with the other copies.",
} as const;

/** Those tooltips describe their button (describeChild), in 14 px text, and open on a long press on touch. */
const composeToggleTooltipProps = {
  describeChild: true,
  enterTouchDelay: 500,
  leaveTouchDelay: 6000,
  slotProps: {
    tooltip: { sx: { fontSize: "0.875rem", fontWeight: 400, lineHeight: 1.45, maxWidth: 320 } },
  },
};

/** NameText's strike for a field's own text (the To and alias fields). */
const strikeInputSx = (theme: Theme) => ({ "& .MuiInputBase-input": strikeNameSx(theme) });

type ComposeTargetType = "name" | "group";
type PendingPublishType = "mail" | "thread";

interface JoinedGroupOption {
  id: string | number;
  name: string;
}

interface ComposePrefill {
  draftId: number;
  fromName?: string;
  toValue?: string;
  toType?: ComposeTargetType;
  groupId?: string | number | null;
  subject?: string;
  /** Open this stored draft (its key in qmail_compose_drafts_<address>). */
  draftKey?: string;
}

interface ThreadPublishResult {
  threadData: {
    title: string;
    groupId: string;
    createdAt: number;
    name: string;
  };
  threadOwner: string;
  name: string;
  threadId: string;
  created: number;
  service: string;
  identifier: string;
}

interface ComposeTargetOption {
  id: string;
  label: string;
  normalizedLabel: string;
  targetType: ComposeTargetType;
  source: "known-name" | "directory-name" | "joined-group";
  groupId?: string;
}

interface AttachmentPublishItem {
  name: string;
  service: string;
  filename: string;
  originalFilename: string;
  identifier: string;
  data64: string;
  type: string | null;
  size: number;
}

interface AttachmentReferenceItem {
  identifier: string;
  name: string;
  service: string;
  filename: string;
  originalFilename: string;
  type: string | null;
  size: number;
}

interface ResolvedComposeTarget {
  type: ComposeTargetType;
  label: string;
  groupId?: string;
}

/**
 * What Mail.tsx hands over for a forward: the original message (subject,
 * body and attachments come from it) and, for older callers, a ready-made
 * HTML string. `to` is the label for the header's To line.
 */
interface ForwardInfo {
  message?: any;
  html?: string;
  to?: string;
}

interface ForwardAttachmentJob {
  key: string;
  reference: AttachmentReference;
  status: "loading" | "error";
  progress?: AttachmentFetchProgress;
  error?: string;
}

const attachmentReferencesOf = (message: any): AttachmentReference[] => {
  if (!Array.isArray(message?.attachments)) return [];
  return message.attachments.filter((item: any) => {
    return (
      item &&
      typeof item.identifier === "string" &&
      item.identifier &&
      typeof item.name === "string" &&
      item.name &&
      typeof item.service === "string" &&
      item.service
    );
  });
};

/**
 * Whether a forwarded message's attachment reference may be fetched,
 * decrypted and re-sent: it must be a mail attachment (ATTACHMENT_PRIVATE,
 * data contract §6) published by the message's own sender, whom `user`
 * names from the search row. The body is the sender's to write, so without
 * this a reference could point at any resource the user can decrypt (their
 * private state document, their other mail) and Forward would send it on.
 */
export const isForwardableAttachment = (reference: AttachmentReference, messagePublisher: unknown): boolean => {
  const publisher = typeof messagePublisher === "string" ? messagePublisher.trim().toLowerCase() : "";
  return (
    Boolean(publisher) &&
    reference.service === MAIL_ATTACHMENT_SERVICE_TYPE &&
    reference.name.trim().toLowerCase() === publisher
  );
};

const extensionOfFile = (file: File): string | null => {
  const fromName = file.name.includes(".") ? file.name.split(".").pop() || "" : "";
  if (fromName) return fromName;
  return extensionFromMimeType(file.type);
};

interface NewMessageProps {
  replyTo?: any;
  /** Reply to the sender plus everyone in the original's `to`/`cc` (each a separate copy). */
  replyAll?: boolean;
  setReplyTo: React.Dispatch<any>;
  recipientAlias?: string;
  requireSenderAlias?: boolean;
  defaultReplyAlias?: string;
  hideButton?: boolean;
  isFromTo?: boolean;
  setForwardInfo: React.Dispatch<any>;
  forwardInfo: ForwardInfo | string | null;
  inlineMode?: boolean;
  onRequestClose?: () => void;
  ownedNames?: string[];
  joinedGroups?: JoinedGroupOption[];
  priorityRecipientNames?: string[];
  /** Inbox rows and opened messages, to order "Recent" names by last contact. */
  recentInboxMessages?: any[];
  openedMessagesById?: Record<string, any>;
  composePrefill?: ComposePrefill | null;
  onThreadPublished?: (result: ThreadPublishResult) => void;
}

const normalizeValue = (value: string): string => value.trim().toLowerCase();

// Stable defaults: a fresh [] per render would re-run every memo and effect
// that depends on these (the recipient check then re-renders forever).
const NO_NAMES: string[] = [];
const NO_GROUPS: JoinedGroupOption[] = [];
const NO_MESSAGES: any[] = [];

const dedupeStrings = (values: string[]): string[] => {
  const deduped = new Map<string, string>();
  values.forEach(value => {
    const normalized = normalizeValue(value);
    if (!normalized || deduped.has(normalized)) return;
    deduped.set(normalized, value.trim());
  });
  return Array.from(deduped.values());
};

const normalizeJoinedGroups = (
  groups: JoinedGroupOption[]
): JoinedGroupOption[] => {
  const deduped = new Map<string, JoinedGroupOption>();
  groups.forEach(group => {
    const id = String(group?.id || "").trim();
    const name = typeof group?.name === "string" ? group.name.trim() : "";
    if (!id || !name || deduped.has(id)) return;
    deduped.set(id, {
      id,
      name,
    });
  });
  return Array.from(deduped.values());
};

const stripHtmlTags = (value: string): string => {
  if (!value) return "";
  if (typeof window !== "undefined" && window.document) {
    const temp = window.document.createElement("div");
    temp.innerHTML = value;
    return temp.textContent || temp.innerText || "";
  }
  return value.replace(/<[^>]*>/g, " ");
};

/** Applies a stored draft to the composer fields (not From/To, which pick the key). */
const draftFieldsOf = (draft: StoredComposeDraft) => ({
  subject: draft.subject || "",
  value: draft.value || "",
  aliasValue: draft.aliasValue || "",
  showAlias: Boolean(draft.showAlias || draft.aliasValue),
  showBCC: Boolean(draft.showBCC && draft.bccNames?.length),
  bccNames: Array.isArray(draft.bccNames) ? draft.bccNames : [],
  showCC: Boolean(draft.ccNames?.length),
  ccNames: Array.isArray(draft.ccNames) ? draft.ccNames : [],
});

export const NewMessage = ({
  setReplyTo,
  replyTo,
  replyAll = false,
  recipientAlias,
  requireSenderAlias = false,
  defaultReplyAlias = "",
  hideButton,
  isFromTo,
  setForwardInfo,
  forwardInfo,
  inlineMode = false,
  onRequestClose,
  ownedNames = NO_NAMES,
  joinedGroups = NO_GROUPS,
  priorityRecipientNames = NO_NAMES,
  recentInboxMessages = NO_MESSAGES,
  openedMessagesById,
  composePrefill = null,
  onThreadPublished,
}: NewMessageProps) => {
  const { name } = useParams();
  const dispatch = useDispatch();
  const { user } = useSelector((state: RootState) => state.auth);
  // Avatar URLs other screens already loaded: From reuses them instead of asking again.
  const userAvatarHash = useSelector((state: RootState) => state.global.userAvatarHash);

  const [publishes, setPublishes] = useState<any>(null);
  const [isOpenMultiplePublish, setIsOpenMultiplePublish] = useState(false);
  const [pendingPublishType, setPendingPublishType] =
    useState<PendingPublishType>("mail");
  const [threadPublishResult, setThreadPublishResult] =
    useState<ThreadPublishResult | null>(null);
  const [isFromToName, setIsFromToName] = useState<null | string>(null);
  const [isOpen, setIsOpen] = useState<boolean>(inlineMode);
  const [value, setValue] = useState("");
  const [attachments, setAttachments] = useState<any[]>([]);
  const [subject, setSubject] = useState<string>("");
  const [destinationName, setDestinationName] = useState("");
  const [selectedTargetOption, setSelectedTargetOption] =
    useState<ComposeTargetOption | null>(null);
  const [directoryNameOptions, setDirectoryNameOptions] = useState<string[]>(
    []
  );
  const [isDirectorySearchLoading, setIsDirectorySearchLoading] =
    useState<boolean>(false);
  const [fromName, setFromName] = useState<string>(
    (user?.name || "").trim() || dedupeStrings(ownedNames)[0] || ""
  );
  const [aliasValue, setAliasValue] = useState<string>("");
  const [showAlias, setShowAlias] = useState<boolean>(false);
  const [showBCC, setShowBCC] = useState<boolean>(false);
  const [bccNames, setBccNames] = useState<NameChip[]>([]);
  // Visible Cc: each name gets its own copy (like Bcc) and is listed in the
  // additive `cc` field of every copy.
  const [showCC, setShowCC] = useState<boolean>(false);
  const [ccNames, setCcNames] = useState<NameChip[]>([]);
  // Names typed into Cc/Bcc but not added yet: Send waits for them.
  const [ccPending, setCcPending] = useState("");
  const [bccPending, setBccPending] = useState("");
  const [replyPreviewMode, setReplyPreviewMode] = useState<
    "preview" | "full" | "hidden"
  >("preview");
  // The shell decides the layout; "phone" also covers narrow Hub panes. A
  // landscape Hub frame (703x201) is far too short for the desktop spacing,
  // so it gets the compact one too.
  const landscapeFrame = useLandscapeFrame();
  const isMobile = useLayoutMode() === "phone" || landscapeFrame;
  const isHydratingDraftRef = useRef(false);
  // A clear, inline error for the current send attempt (next to the toast).
  const [composeError, setComposeError] = useState<{
    text: string;
    retry?: "thread-header";
  } | null>(null);
  // The MAIL thread header is published only after the message batch
  // succeeds, so declining or failing the batch leaves no empty thread
  // behind (Bugs #21).
  const pendingThreadHeaderRef = useRef<{
    groupId: string;
    threadToken: string;
    messageIdentifier: string;
    request: any;
  } | null>(null);
  const lastLoadedDraftKeyRef = useRef<string | null>(null);
  // What the composer started with (the reply quote, the forward header, a
  // prefilled subject). Content equal to this is not "something the user
  // wrote", so it is neither saved as a draft nor guarded on Discard.
  const initialValueRef = useRef("");
  const initialSubjectRef = useRef("");
  // Quill normalises the starting HTML (and reports it as an "api" change),
  // so the baseline follows the editor until the body is really written:
  // the first user edit, or a stored draft being loaded, freezes it.
  const bodyBaselineFrozenRef = useRef(false);
  // A stored draft was loaded into this composer: Reply all must not add
  // its names back over the draft's own Cc list.
  const hydratedDraftRef = useRef(false);
  // Cc names Reply all filled in by itself (not something the user wrote).
  const initialCcRef = useRef<string[]>([]);
  // A draft opened from the Drafts mailbox: its stored key (deleted once the
  // composer saves under a different key) and, while it is being applied, the
  // draft itself so the reply/forward initialisers do not overwrite it.
  const openedDraftKeyRef = useRef<string | null>(null);
  const pendingDraftRef = useRef<StoredComposeDraft | null>(null);
  const skipNextDraftHydrationRef = useRef(false);
  const [draftSavedAt, setDraftSavedAt] = useState<number | null>(null);
  // The footer the composer inserted (src/utils/mailFooter.ts) and for which
  // From name, so changing From swaps it while it is still as inserted.
  // null: nothing tracked (a stored draft, or a footer the user edited).
  const footerRef = useRef<{ block: string; name: string; kind: FooterKind } | null>(null);
  const footerContextRef = useRef({ value, fromName, address: "" });
  footerContextRef.current = { value, fromName, address: user?.address || "" };
  // Attachments of a forwarded message being fetched and decrypted so they
  // can be re-published, encrypted, to the new recipient.
  // Attachment references of a forwarded message that are not its sender's
  // mail attachments: shown, never fetched (isForwardableAttachment).
  const [refusedForwardAttachments, setRefusedForwardAttachments] = useState<string[]>([]);
  const [forwardAttachmentJobs, setForwardAttachmentJobs] = useState<
    ForwardAttachmentJob[]
  >([]);
  const forwardJobControllersRef = useRef(new Map<string, AbortController>());

  const { Modal, showModal } = useConfirmationModal({
    title: "Same alias on both sides",
    message:
      "To stay anonymous, do not use the same alias as the person you are messaging. Send anyway?",
    confirmLabel: "Send anyway",
    cancelLabel: "Go back",
  });
  const { Modal: DiscardModal, showModal: showDiscardModal } =
    useConfirmationModal({
      title: "Discard this message?",
      message:
        "What you wrote, and the draft saved on this device, will be deleted.",
      confirmLabel: "Discard",
      cancelLabel: "Keep editing",
      destructive: true,
    });

  const fromOptions = useMemo(() => {
    const options = dedupeStrings([user?.name || "", ...ownedNames]);
    const primaryName = normalizeValue(user?.name || "");
    return options.sort((a, b) => {
      const aNormalized = normalizeValue(a);
      const bNormalized = normalizeValue(b);
      if (aNormalized === primaryName && bNormalized !== primaryName) return -1;
      if (bNormalized === primaryName && aNormalized !== primaryName) return 1;
      return a.localeCompare(b, undefined, { sensitivity: "base" });
    });
  }, [ownedNames, user?.name]);

  const joinedGroupOptions = useMemo(() => {
    return normalizeJoinedGroups(joinedGroups);
  }, [joinedGroups]);

  // "Recent" means recent: last contact in either direction, newest first.
  const recipientActivity = useMemo(() => {
    return recipientActivityByName(recentInboxMessages, openedMessagesById, [
      user?.name || "",
      ...ownedNames,
    ]);
  }, [openedMessagesById, ownedNames, recentInboxMessages, user?.name]);

  const knownRecipientNameOptions = useMemo(() => {
    return sortNamesByRecency(
      dedupeStrings(priorityRecipientNames),
      recipientActivity
    );
  }, [priorityRecipientNames, recipientActivity]);

  // Inline check of the typed name against the name cache (one GET_NAME_DATA
  // per name per session), debounced so a pause in typing costs one request.
  const [recipientCheck, setRecipientCheck] = useState<{
    name: string;
    status: "checking" | "found" | "missing";
  } | null>(null);

  useEffect(() => {
    if (!fromOptions.length) {
      setFromName("");
      return;
    }
    const selectedStillExists = fromOptions.some(option => {
      return normalizeValue(option) === normalizeValue(fromName);
    });
    if (!selectedStillExists) {
      setFromName(fromOptions[0]);
    }
  }, [fromName, fromOptions]);

  const knownNameTargetOptions = useMemo(() => {
    return knownRecipientNameOptions.map(nameOption => {
      return {
        id: `name-known:${nameOption.toLowerCase()}`,
        label: nameOption,
        normalizedLabel: normalizeValue(nameOption),
        targetType: "name" as const,
        source: "known-name" as const,
      };
    });
  }, [knownRecipientNameOptions]);

  const joinedGroupTargetOptions = useMemo(() => {
    return joinedGroupOptions.map(group => {
      return {
        id: `group:${String(group.id).trim()}`,
        label: group.name,
        normalizedLabel: normalizeValue(group.name),
        targetType: "group" as const,
        source: "joined-group" as const,
        groupId: String(group.id).trim(),
      };
    });
  }, [joinedGroupOptions]);

  const normalizedDestination = useMemo(() => {
    return normalizeValue(destinationName);
  }, [destinationName]);

  useEffect(() => {
    const query = normalizedDestination;
    if (!query || query.length < 2) {
      setDirectoryNameOptions([]);
      setIsDirectorySearchLoading(false);
      return;
    }

    let cancelled = false;
    const timeout = window.setTimeout(async () => {
      setIsDirectorySearchLoading(true);
      try {
        // Cached for the session (nameCache): reopening the composer or
        // typing a name again costs no request.
        const names = await searchDirectoryNames(query, 30);
        if (cancelled) return;
        setDirectoryNameOptions(names);
      } catch {
        if (!cancelled) {
          setDirectoryNameOptions([]);
        }
      } finally {
        if (!cancelled) {
          setIsDirectorySearchLoading(false);
        }
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [normalizedDestination]);

  const targetOptions = useMemo(() => {
    const query = normalizedDestination;
    const optionMap = new Map<string, ComposeTargetOption>();

    const appendOption = (option: ComposeTargetOption) => {
      if (query && !option.normalizedLabel.includes(query)) return;
      const dedupeKey = `${option.targetType}:${option.normalizedLabel}`;
      if (optionMap.has(dedupeKey)) return;
      optionMap.set(dedupeKey, option);
    };

    knownNameTargetOptions.forEach(appendOption);
    joinedGroupTargetOptions.forEach(appendOption);
    directoryNameOptions.forEach(nameOption => {
      appendOption({
        id: `name-directory:${nameOption.toLowerCase()}`,
        label: nameOption,
        normalizedLabel: normalizeValue(nameOption),
        targetType: "name",
        source: "directory-name",
      });
    });

    return Array.from(optionMap.values());
  }, [
    directoryNameOptions,
    joinedGroupTargetOptions,
    knownNameTargetOptions,
    normalizedDestination,
  ]);

  const resolveComposeTarget = useCallback((): ResolvedComposeTarget | null => {
    const normalizedInput = normalizeValue(destinationName);
    if (!normalizedInput) return null;

    if (
      selectedTargetOption &&
      normalizeValue(selectedTargetOption.label) === normalizedInput
    ) {
      if (selectedTargetOption.targetType === "group") {
        return {
          type: "group",
          label: selectedTargetOption.label,
          groupId: selectedTargetOption.groupId,
        };
      }

      return {
        type: "name",
        label: selectedTargetOption.label,
      };
    }

    const matchingJoinedGroup = joinedGroupOptions.find(group => {
      return normalizeValue(group.name) === normalizedInput;
    });
    if (matchingJoinedGroup) {
      return {
        type: "group",
        label: matchingJoinedGroup.name,
        groupId: String(matchingJoinedGroup.id),
      };
    }

    return {
      type: "name",
      label: destinationName.trim(),
    };
  }, [destinationName, joinedGroupOptions, selectedTargetOption]);

  const resolvedTarget = useMemo(
    () => resolveComposeTarget(),
    [resolveComposeTarget]
  );
  const isGroupTarget = resolvedTarget?.type === "group";
  // A typed or picked name hiding invisible characters is struck in the
  // field itself, as NameText does elsewhere (never a group).
  const strikeToInput = !isGroupTarget && hasInvisibleCharacters(destinationName);
  const strikeAliasInput = hasInvisibleCharacters(aliasValue);
  const allowAliasAndBcc = !isGroupTarget;

  useEffect(() => {
    const candidate =
      resolvedTarget?.type === "name" ? resolvedTarget.label.trim() : "";
    if (!candidate) {
      setRecipientCheck(null);
      return;
    }
    const known = peekName(candidate);
    if (known) {
      setRecipientCheck({
        name: candidate,
        status: known.status === "found" ? "found" : "missing",
      });
      return;
    }

    let cancelled = false;
    setRecipientCheck({ name: candidate, status: "checking" });
    const timeout = window.setTimeout(async () => {
      try {
        const lookup = await lookupName(candidate);
        if (cancelled) return;
        setRecipientCheck({
          name: candidate,
          status: lookup.status === "found" ? "found" : "missing",
        });
      } catch {
        if (!cancelled) setRecipientCheck(null);
      }
    }, 450);
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [resolvedTarget]);
  const activeDraftKey = useMemo(() => {
    const senderName = fromName.trim();
    if (!user?.address || !senderName || resolvedTarget?.type !== "name")
      return null;
    const targetName = resolvedTarget.label.trim();
    if (!targetName) return null;
    // A reply keeps its own draft, Reply all another one; a new mail to the
    // same name keeps the old key.
    const replyToId = typeof replyTo?.id === "string" ? replyTo.id : "";
    return composeDraftKey(senderName, targetName, replyToId, replyAll);
  }, [fromName, replyAll, replyTo?.id, resolvedTarget, user?.address]);

  useEffect(() => {
    if (allowAliasAndBcc) return;
    setShowAlias(false);
    setShowBCC(false);
    setAliasValue("");
    setBccNames([]);
    setShowCC(false);
    setCcNames([]);
  }, [allowAliasAndBcc]);

  useEffect(() => {
    if (!allowAliasAndBcc || !requireSenderAlias) return;
    setShowAlias(true);
    const nextDefaultReplyAlias = defaultReplyAlias.trim();
    if (!nextDefaultReplyAlias) return;
    setAliasValue(nextDefaultReplyAlias);
  }, [allowAliasAndBcc, defaultReplyAlias, requireSenderAlias]);

  const clearStoredDraft = useCallback(
    (draftKey?: string | null) => {
      const address = user?.address || "";
      if (!address) return;
      deleteComposeDraft(address, draftKey);
      if (draftKey && openedDraftKeyRef.current === draftKey) {
        openedDraftKeyRef.current = null;
      }
      setDraftSavedAt(null);
    },
    [user?.address]
  );

  const cancelForwardAttachmentJobs = useCallback(() => {
    forwardJobControllersRef.current.forEach(controller => controller.abort());
    forwardJobControllersRef.current.clear();
    setForwardAttachmentJobs([]);
  }, []);

  const startForwardAttachmentJob = useCallback(
    (reference: AttachmentReference) => {
      const key = `forward:${reference.identifier}`;
      forwardJobControllersRef.current.get(key)?.abort();
      const controller = new AbortController();
      forwardJobControllersRef.current.set(key, controller);
      setForwardAttachmentJobs(prev => [
        ...prev.filter(job => job.key !== key),
        { key, reference, status: "loading" },
      ]);

      fetchAttachmentFile(reference, {
        signal: controller.signal,
        onProgress: progress => {
          if (controller.signal.aborted) return;
          setForwardAttachmentJobs(prev =>
            prev.map(job => (job.key === key ? { ...job, progress } : job))
          );
        },
      })
        .then(file => {
          if (controller.signal.aborted) return;
          forwardJobControllersRef.current.delete(key);
          setForwardAttachmentJobs(prev => prev.filter(job => job.key !== key));
          setAttachments(prev => [
            ...prev.filter(item => item?.forwardKey !== key),
            {
              file,
              mimetype: file.type || null,
              extension: extensionOfFile(file),
              forwardKey: key,
            },
          ]);
        })
        .catch(error => {
          if (controller.signal.aborted) return;
          forwardJobControllersRef.current.delete(key);
          const message =
            typeof error?.message === "string" && error.message
              ? error.message
              : "The attachment could not be fetched";
          setForwardAttachmentJobs(prev =>
            prev.map(job =>
              job.key === key ? { ...job, status: "error", error: message } : job
            )
          );
        });
    },
    []
  );

  const removeForwardAttachmentJob = useCallback((key: string) => {
    forwardJobControllersRef.current.get(key)?.abort();
    forwardJobControllersRef.current.delete(key);
    setForwardAttachmentJobs(prev => prev.filter(job => job.key !== key));
  }, []);

  useEffect(() => {
    const controllers = forwardJobControllersRef.current;
    return () => {
      controllers.forEach(controller => controller.abort());
      controllers.clear();
    };
  }, []);

  const resetComposerDraft = useCallback(() => {
    cancelForwardAttachmentJobs();
    setAttachments([]);
    setSubject("");
    setDestinationName("");
    setSelectedTargetOption(null);
    setDirectoryNameOptions([]);
    setBccNames([]);
    setCcNames([]);
    setShowCC(false);
    setCcPending("");
    setBccPending("");
    setShowAlias(false);
    setShowBCC(false);
    setValue("");
    setAliasValue("");
    setReplyPreviewMode("preview");
    setThreadPublishResult(null);
    setPendingPublishType("mail");
    initialValueRef.current = "";
    initialSubjectRef.current = "";
    bodyBaselineFrozenRef.current = false;
    hydratedDraftRef.current = false;
    initialCcRef.current = [];
    pendingDraftRef.current = null;
    skipNextDraftHydrationRef.current = false;
    footerRef.current = null;
    setDraftSavedAt(null);
    setComposeError(null);
  }, [cancelForwardAttachmentJobs]);

  const discardComposerDraft = useCallback(() => {
    clearStoredDraft(activeDraftKey || lastLoadedDraftKeyRef.current);
    clearStoredDraft(openedDraftKeyRef.current);
    lastLoadedDraftKeyRef.current = null;
    resetComposerDraft();
    setReplyTo(null);
    setForwardInfo(null);
    if (inlineMode) {
      onRequestClose?.();
      return;
    }
    setIsOpen(false);
  }, [
    activeDraftKey,
    clearStoredDraft,
    inlineMode,
    onRequestClose,
    resetComposerDraft,
    setForwardInfo,
    setReplyTo,
  ]);

  const openModal = () => {
    if (inlineMode) return;
    setIsOpen(true);
    setReplyTo(null);
    setForwardInfo(null);
  };

  const closeModal = useCallback(() => {
    resetComposerDraft();
    setReplyTo(null);
    setForwardInfo(null);
    if (!inlineMode) {
      setIsOpen(false);
      return;
    }
    onRequestClose?.();
  }, [
    inlineMode,
    onRequestClose,
    resetComposerDraft,
    setForwardInfo,
    setReplyTo,
  ]);

  useEffect(() => {
    if (isFromTo && name) {
      setIsFromToName(name);
    }
  }, [isFromTo, name]);

  useEffect(() => {
    if (!isFromToName) return;
    setDestinationName(isFromToName);
    setSelectedTargetOption({
      id: `name-route:${isFromToName.toLowerCase()}`,
      label: isFromToName,
      normalizedLabel: normalizeValue(isFromToName),
      targetType: "name",
      source: "directory-name",
    });
    setIsOpen(true);
    setIsFromToName(null);
  }, [isFromToName]);

  useEffect(() => {
    if (!composePrefill) return;

    resetComposerDraft();
    lastLoadedDraftKeyRef.current = null;
    openedDraftKeyRef.current = null;
    setIsOpen(true);
    setForwardInfo(null);

    // Opening a stored draft: restore its fields here. Mail.tsx sets replyTo
    // for a reply draft in the same render, so the reply initialiser must not
    // overwrite the draft's subject and body (pendingDraftRef), and the
    // key-based hydration below must not re-apply another draft.
    const storedDraft =
      composePrefill.draftKey && user?.address
        ? readComposeDrafts(user.address)[composePrefill.draftKey]
        : undefined;
    if (storedDraft) {
      openedDraftKeyRef.current = composePrefill.draftKey || null;
      pendingDraftRef.current = storedDraft;
      skipNextDraftHydrationRef.current = true;
      isHydratingDraftRef.current = true;
      bodyBaselineFrozenRef.current = true;
      hydratedDraftRef.current = true;
      const fields = draftFieldsOf(storedDraft);
      setSubject(fields.subject);
      setValue(fields.value);
      setAliasValue(fields.aliasValue);
      setShowAlias(fields.showAlias);
      setShowBCC(fields.showBCC);
      setBccNames(fields.bccNames);
      setShowCC(fields.showCC);
      setCcNames(fields.ccNames);
      setDraftSavedAt(storedDraft.updatedAt || null);
      window.setTimeout(() => {
        pendingDraftRef.current = null;
        isHydratingDraftRef.current = false;
      }, 0);
    } else {
      setReplyTo(null);
    }

    if (composePrefill.fromName) {
      const matchingFrom = fromOptions.find(option => {
        return (
          normalizeValue(option) ===
          normalizeValue(composePrefill.fromName || "")
        );
      });
      setFromName(matchingFrom || composePrefill.fromName);
    }

    const prefillSubject = composePrefill.subject;
    if (typeof prefillSubject === "string" && !storedDraft) {
      setSubject(prefillSubject);
      initialSubjectRef.current = prefillSubject;
    }

    const toValue = (composePrefill.toValue || "").trim();
    setDestinationName(toValue);
    if (!toValue) {
      setSelectedTargetOption(null);
      return;
    }

    if (composePrefill.toType === "group") {
      const prefillGroupId = String(composePrefill.groupId || "").trim();
      const groupMatch = joinedGroupOptions.find(group => {
        const currentGroupId = String(group.id || "").trim();
        if (prefillGroupId && currentGroupId === prefillGroupId) return true;
        return normalizeValue(group.name) === normalizeValue(toValue);
      });

      if (groupMatch) {
        setSelectedTargetOption({
          id: `group:${String(groupMatch.id).trim()}`,
          label: groupMatch.name,
          normalizedLabel: normalizeValue(groupMatch.name),
          targetType: "group",
          source: "joined-group",
          groupId: String(groupMatch.id).trim(),
        });
        return;
      }
    }

    setSelectedTargetOption({
      id: `name-prefill:${toValue.toLowerCase()}`,
      label: toValue,
      normalizedLabel: normalizeValue(toValue),
      targetType: "name",
      source: "known-name",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    composePrefill,
    fromOptions,
    joinedGroupOptions,
    resetComposerDraft,
    setForwardInfo,
    setReplyTo,
  ]);

  useEffect(() => {
    if (replyTo) {
      setIsOpen(true);
      const recipient = replyTo?.user || "";
      setDestinationName(recipient);
      setSelectedTargetOption(
        recipient
          ? {
              id: `name-reply:${recipient.toLowerCase()}`,
              label: recipient,
              normalizedLabel: normalizeValue(recipient),
              targetType: "name",
              source: "known-name",
            }
          : null
      );
      setReplyPreviewMode("preview");
      const nextSubject = withSubjectPrefix(replyTo?.subject, "Re");
      initialSubjectRef.current = nextSubject;
      if (pendingDraftRef.current) {
        // A stored reply draft is being opened: keep its subject and body.
        initialValueRef.current = "";
        footerRef.current = null;
        return;
      }
      setSubject(nextSubject);
      bodyBaselineFrozenRef.current = false;
      hydratedDraftRef.current = false;
      // Start the editor with the quoted original (Quill 1 markup, so the
      // original app renders it too). A stored draft for this reply, if any,
      // replaces it when the draft key resolves.
      const { fromName: footerName, address: footerAddress } =
        footerContextRef.current;
      const footerBlock = footerBlockFor(
        readMailFooter(footerAddress),
        footerName,
        "reply"
      );
      footerRef.current = { block: footerBlock, name: footerName, kind: "reply" };
      const quoteHtml = buildReplyQuoteHtml({
        sender: replyTo?.user,
        sentAt: formatFullTimestamp(replyTo?.createdAt),
        lines: messageBodyLines(replyTo, extractTextFromSlate),
        footerBlock,
      });
      setValue(quoteHtml);
      initialValueRef.current = quoteHtml;
    }
  }, [replyTo]);

  // Reply all: everyone from the original's to/cc (minus our own names and
  // the sender) goes into Cc: a separate encrypted copy each, listed in `cc`.
  useEffect(() => {
    if (!replyTo || !replyAll) return;
    const { others } = replyAllRecipients(replyTo, [
      user?.name || "",
      ...ownedNames,
    ]);
    if (!others.length) return;

    let cancelled = false;
    setShowCC(true);
    void (async () => {
      const resolved = await Promise.all(
        others.map(async nameToAdd => {
          try {
            return await resolveName(nameToAdd);
          } catch {
            return null;
          }
        })
      );
      // A stored draft of this Reply all keeps its own Cc list.
      if (cancelled || hydratedDraftRef.current) return;
      const missing = others.filter((_, index) => !resolved[index]);
      const chips: NameChip[] = resolved
        .filter((item): item is NonNullable<typeof item> => Boolean(item))
        .map(item => ({
          name: item.name,
          publicKey: item.publicKey,
          address: item.address,
        }));
      setCcNames(prev => {
        const known = new Set(prev.map(chip => normalizeValue(chip.name)));
        const next = [
          ...prev,
          ...chips.filter(chip => !known.has(normalizeValue(chip.name))),
        ];
        initialCcRef.current = next.map(chip => chip.name);
        return next;
      });
      if (missing.length) {
        dispatch(
          setNotification({
            msg: `Could not add to Reply all (name not found or no public key): ${missing.join(
              ", "
            )}`,
            alertType: "error",
          })
        );
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [replyAll, replyTo?.id]);

  useEffect(() => {
    setRefusedForwardAttachments([]);
    if (!forwardInfo) return;
    setIsOpen(true);
    lastLoadedDraftKeyRef.current = null;

    const info: ForwardInfo =
      typeof forwardInfo === "string" ? { html: forwardInfo } : forwardInfo;
    const source = info.message;
    if (!source || typeof source !== "object") {
      // An older caller sent ready-made HTML: use it as is.
      const html = info.html || "";
      footerRef.current = null;
      setValue(html);
      initialValueRef.current = html;
      bodyBaselineFrozenRef.current = false;
      return;
    }

    const nextSubject = withSubjectPrefix(source.subject, "Fwd");
    setSubject(nextSubject);
    initialSubjectRef.current = nextSubject;
    const { fromName: footerName, address: footerAddress } =
      footerContextRef.current;
    const footerBlock = footerBlockFor(
      readMailFooter(footerAddress),
      footerName,
      "forward"
    );
    footerRef.current = { block: footerBlock, name: footerName, kind: "forward" };
    const html = buildForwardHtml(
      {
        from: source.user,
        sentAt: formatFullTimestamp(source.createdAt),
        subject: typeof source.subject === "string" ? source.subject : "",
        to: info.to || source.recipient || user?.name || "",
      },
      messageBodyLines(source, extractTextFromSlate),
      footerBlock
    );
    setValue(html);
    initialValueRef.current = html;
    bodyBaselineFrozenRef.current = false;

    // Re-attach the original files: fetched and decrypted here, re-published
    // encrypted to the new recipient on Send.
    cancelForwardAttachmentJobs();
    setAttachments(prev => prev.filter(item => !item?.forwardKey));
    const references = attachmentReferencesOf(source);
    const forwardable = references.filter(reference => isForwardableAttachment(reference, source.user));
    setRefusedForwardAttachments(
      references
        .filter(reference => !forwardable.includes(reference))
        .map(reference => reference.originalFilename || reference.filename || reference.identifier)
    );
    forwardable.forEach(startForwardAttachmentJob);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forwardInfo]);

  // A new message starts with a line to type on, then the footer.
  useEffect(() => {
    if (!isOpen || replyTo || forwardInfo) return;
    if (value !== "" && value !== "<p><br></p>") return;
    if (footerRef.current || pendingDraftRef.current || hydratedDraftRef.current)
      return;
    const footerBlock = footerBlockFor(
      readMailFooter(user?.address),
      fromName,
      "new"
    );
    footerRef.current = { block: footerBlock, name: fromName, kind: "new" };
    if (!footerBlock) return;
    const body = buildNewMessageBody(footerBlock);
    setValue(body);
    initialValueRef.current = body;
    bodyBaselineFrozenRef.current = false;
  }, [forwardInfo, fromName, isOpen, replyTo, user?.address, value]);

  // Changing From swaps the footer for that name's, unless it was edited.
  useEffect(() => {
    const tracked = footerRef.current;
    if (!tracked || normalizeValue(tracked.name) === normalizeValue(fromName))
      return;
    const { value: body, address } = footerContextRef.current;
    const nextBlock = footerBlockFor(readMailFooter(address), fromName, tracked.kind);
    const untouched = body === initialValueRef.current;
    const next = swapFooterInBody(body, tracked.block, nextBlock, tracked.kind, untouched);
    if (next === null) {
      footerRef.current = null;
      return;
    }
    footerRef.current = { block: nextBlock, name: fromName, kind: tracked.kind };
    if (next === body) return;
    if (untouched) {
      initialValueRef.current = next;
      bodyBaselineFrozenRef.current = false;
    } else {
      initialValueRef.current =
        swapFooterInBody(initialValueRef.current, tracked.block, nextBlock, tracked.kind, false) ??
        initialValueRef.current;
    }
    setValue(next);
  }, [fromName]);

  const replyBodyText = useMemo(() => {
    if (!replyTo) return "";
    return messageBodyLines(replyTo, extractTextFromSlate).join("\n").trim();
  }, [replyTo]);

  useEffect(() => {
    if (!activeDraftKey || !user?.address) {
      lastLoadedDraftKeyRef.current = null;
      return;
    }
    if (activeDraftKey === lastLoadedDraftKeyRef.current) return;
    lastLoadedDraftKeyRef.current = activeDraftKey;
    if (skipNextDraftHydrationRef.current) {
      // The composer was just filled from a draft opened by key.
      skipNextDraftHydrationRef.current = false;
      return;
    }

    const storedDraft = readComposeDrafts(user.address)[activeDraftKey];
    if (!storedDraft) return;

    isHydratingDraftRef.current = true;
    bodyBaselineFrozenRef.current = true;
    hydratedDraftRef.current = true;
    footerRef.current = null;
    const fields = draftFieldsOf(storedDraft);
    setSubject(fields.subject);
    setValue(fields.value);
    setAliasValue(fields.aliasValue);
    setShowAlias(fields.showAlias);
    setShowBCC(fields.showBCC);
    setBccNames(fields.bccNames);
    setShowCC(fields.showCC);
    setCcNames(fields.ccNames);
    setDraftSavedAt(storedDraft.updatedAt || null);
    window.setTimeout(() => {
      isHydratingDraftRef.current = false;
    }, 0);
  }, [activeDraftKey, user?.address]);

  // Something the user wrote (not the quote, the Re: subject or Reply all's
  // own Cc names): only that is saved as a draft or guarded on Discard.
  const composerHasContent = useCallback(
    () =>
      hasComposerContent({
        subject,
        initialSubject: initialSubjectRef.current,
        value,
        initialValue: initialValueRef.current,
        aliasValue,
        attachmentCount: attachments.length,
        bccNames,
        ccNames,
        initialCcNames: initialCcRef.current,
        textOf: stripHtmlTags,
      }),
    [aliasValue, attachments.length, bccNames, ccNames, subject, value]
  );

  useEffect(() => {
    if (!activeDraftKey || !user?.address || isHydratingDraftRef.current)
      return;

    const timeout = window.setTimeout(() => {
      const fromNameValue = fromName.trim();
      const toNameValue =
        resolvedTarget?.type === "name" ? resolvedTarget.label.trim() : "";
      if (!fromNameValue || !toNameValue) return;

      if (!composerHasContent()) {
        clearStoredDraft(activeDraftKey);
        return;
      }

      const updatedAt = Date.now();
      const draft: StoredComposeDraft = {
        draftId: createComposeDraftId(fromNameValue, toNameValue, updatedAt),
        fromName: fromNameValue,
        toName: toNameValue,
        subject,
        value,
        aliasValue,
        showAlias,
        showBCC,
        bccNames,
        updatedAt,
        kind: "mail",
      };
      if (ccNames.length) {
        draft.ccNames = ccNames;
        draft.showCC = true;
      }
      // Additive fields: attachment names only (bytes are never stored), and
      // which message a reply answers so the Drafts list can reopen it.
      if (attachments.length) {
        draft.attachments = attachments.map(item => ({
          name: item?.file?.name || "attachment",
          size: Number(item?.file?.size || 0),
          type: item?.file?.type || null,
        }));
      }
      if (replyTo?.id) {
        draft.replyTo = {
          id: replyTo.id,
          user: replyTo.user,
          subject: replyTo.subject,
          createdAt: replyTo.createdAt,
        };
        if (replyAll) draft.replyAll = true;
      }
      saveComposeDraft(user.address, activeDraftKey, draft);
      setDraftSavedAt(updatedAt);
      // Opened under another key (e.g. a reply draft whose message is no
      // longer in memory): the old entry would otherwise linger as a duplicate.
      if (openedDraftKeyRef.current && openedDraftKeyRef.current !== activeDraftKey) {
        deleteComposeDraft(user.address, openedDraftKeyRef.current);
        openedDraftKeyRef.current = null;
      }
    }, 350);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [
    activeDraftKey,
    aliasValue,
    attachments,
    bccNames,
    ccNames,
    clearStoredDraft,
    composerHasContent,
    fromName,
    replyAll,
    replyTo,
    resolvedTarget,
    showAlias,
    showBCC,
    subject,
    user?.address,
    value,
  ]);

  const replyPreviewText = useMemo(() => {
    if (!replyBodyText) return "- no message body -";
    if (replyBodyText.length <= 420) return replyBodyText;
    return `${replyBodyText.slice(0, 420)}...`;
  }, [replyBodyText]);

  const activeReplyPreviewText = useMemo(() => {
    if (replyPreviewMode === "hidden") return "";
    return replyPreviewMode === "full"
      ? replyBodyText || "- no message body -"
      : replyPreviewText;
  }, [replyBodyText, replyPreviewMode, replyPreviewText]);

  const { getRootProps, getInputProps } = useDropzone({
    maxSize,
    onDrop: async acceptedFiles => {
      const files: any[] = [];
      try {
        acceptedFiles.forEach(item => {
          const type = item?.type;
          if (!type) {
            files.push({
              file: item,
              mimetype: null,
              extension: null,
            });
            return;
          }

          const extension = extensionFromMimeType(type);
          files.push({
            file: item,
            mimetype: type,
            extension: extension || null,
          });
        });
      } catch {
        dispatch(
          setNotification({
            msg: "One of your files is corrupted",
            alertType: "error",
          })
        );
      }
      setAttachments(prev => [...prev, ...files]);
    },
    onDropRejected: () => {
      dispatch(
        setNotification({
          msg: "One of your files is over the 40mb limit",
          alertType: "error",
        })
      );
    },
  });

  const buildAttachmentPayloads = useCallback(
    async (
      publisherName: string
    ): Promise<{
      publishes: AttachmentPublishItem[];
      references: AttachmentReferenceItem[];
    }> => {
      const attachmentPublishes: AttachmentPublishItem[] = [];
      const attachmentReferences: AttachmentReferenceItem[] = [];

      for (const singleAttachment of attachments) {
        const attachment = singleAttachment.file;
        const fileBase64 = await toBase64(attachment);
        if (typeof fileBase64 !== "string" || !fileBase64) {
          throw new Error("Could not convert file to base64");
        }

        const base64String = fileBase64.split(",")[1];
        const id = uid();
        const id2 = uid();
        const identifier = `attachments_qmail_${id}_${id2}`;
        let fileExtension = attachment?.name?.split(".")?.pop();
        if (!fileExtension) {
          fileExtension = singleAttachment.extension;
        }

        const publish: AttachmentPublishItem = {
          name: publisherName,
          service: MAIL_ATTACHMENT_SERVICE_TYPE,
          filename: `${id}.${fileExtension}`,
          originalFilename: attachment?.name || "",
          identifier,
          data64: base64String,
          type: attachment?.type || null,
          size: attachment?.size || 0,
        };

        attachmentPublishes.push(publish);
        attachmentReferences.push({
          identifier: publish.identifier,
          name: publish.name,
          service: publish.service,
          filename: publish.filename,
          originalFilename: publish.originalFilename,
          type: publish.type,
          size: publish.size,
        });
      }

      return {
        publishes: attachmentPublishes,
        references: attachmentReferences,
      };
    },
    [attachments]
  );

  // Members and keys come from the shared, paged cache (no limit=0, one
  // lookup per address per session); see src/utils/groupMembersCache.ts.
  const fetchGroupPublicKeys = useCallback(
    async (groupId: string): Promise<string[]> => {
      const normalizedGroupId = groupId.trim();
      if (!normalizedGroupId) return [];
      return getGroupPublicKeys(normalizedGroupId);
    },
    []
  );

  async function publishQDNResource() {
    let errorMsg = "";

    const senderAddress = user?.address || "";
    const senderName = (fromName || "").trim();
    const target = resolveComposeTarget();
    const noExtension = attachments.filter(item => !item.extension);
    const isReply = Boolean(replyTo?.id);

    if (!senderAddress) {
      errorMsg = "Cannot send: your address isn't available";
    }
    if (!senderName) {
      errorMsg = "Cannot send a message without selecting a From name";
    }
    if (!target) {
      errorMsg = "Cannot send without selecting a recipient or group";
    }
    if (
      target?.type === "name" &&
      recipientCheck?.status === "missing" &&
      normalizeValue(recipientCheck.name) === normalizeValue(target.label)
    ) {
      errorMsg = `"${target.label}" is not a registered name`;
    }
    if (target?.type === "group" && !subject.trim()) {
      errorMsg = "Please provide a Subject (used as the thread title)";
    }

    if (allowAliasAndBcc && requireSenderAlias && !aliasValue) {
      errorMsg = recipientAlias
        ? "A reply alias is required when replying from an alias inbox"
        : "An alias is required to compose a new alias message";
    }
    if (
      allowAliasAndBcc &&
      recipientAlias &&
      normalizeValue(recipientAlias) === normalizeValue(aliasValue)
    ) {
      errorMsg = "The recipient's alias cannot be the same as yours";
    }
    if (allowAliasAndBcc && aliasValue && ccNames.length) {
      errorMsg =
        "Cc is not sent with an alias: remove the Cc names, or send without the alias";
    }
    const pendingCc = allowAliasAndBcc && showCC ? ccPending : "";
    const pendingBcc = allowAliasAndBcc && showBCC ? bccPending : "";
    if (pendingCc || pendingBcc) {
      errorMsg = `Press Enter to add "${pendingCc || pendingBcc}" to ${
        pendingCc ? "Cc" : "Bcc"
      }, or clear it`;
    }
    if (noExtension.length > 0) {
      errorMsg =
        "One of your attachments has no file extension (for example .png or .pdf)";
    }
    if (forwardAttachmentJobs.some(job => job.status === "loading")) {
      errorMsg = "Forwarded attachments are still being fetched";
    } else if (forwardAttachmentJobs.some(job => job.status === "error")) {
      errorMsg =
        "A forwarded attachment could not be fetched: retry it or remove it";
    }

    if (errorMsg) {
      dispatch(
        setNotification({
          msg: errorMsg,
          alertType: "error",
        })
      );
      throw new Error(errorMsg);
    }

    if (allowAliasAndBcc && aliasValue && !requireSenderAlias) {
      const userConfirmed = await showModal();
      if (userConfirmed === false) return;
    }

    try {
      const {
        publishes: attachmentPublishes,
        references: attachmentReferences,
      } = await buildAttachmentPayloads(senderName);
      const composedMessageBody = toPublishedMailHtml(value);

      if (!target) return;

      if (target.type === "group") {
        const groupId = String(target.groupId || "").trim();
        if (!groupId) {
          throw new Error("Cannot publish thread without a valid group");
        }

        const groupPublicKeys = await fetchGroupPublicKeys(groupId);
        if (!groupPublicKeys.length) {
          throw new Error(
            "No group members with a public key were found, so the thread cannot be encrypted. Check the group, or try again in a moment."
          );
        }

        const createdAt = Date.now();
        // A header still unpublished from an earlier Send to this group (the
        // dialog was closed while Hub might still be publishing the post):
        // reuse its identifiers, so this Send fills in the missing pieces
        // instead of starting a second thread.
        const unfinished =
          pendingThreadHeaderRef.current?.groupId === groupId
            ? pendingThreadHeaderRef.current
            : null;
        const threadToken = unfinished?.threadToken || uid();
        const threadTitle = subject.trim();
        const threadIdentifier = `qortal_qmail_thread_group${groupId}_${threadToken}`;
        const messageIdentifier =
          unfinished?.messageIdentifier ||
          `qortal_qmail_thmsg_group${groupId}_${threadToken}_${uid()}`;

        const threadObject = {
          title: threadTitle,
          groupId,
          createdAt,
          name: senderName,
        };
        const threadToBase64 = await objectToBase64(threadObject);
        const threadPublishRequest = {
          action: "PUBLISH_QDN_RESOURCE",
          name: senderName,
          service: THREAD_SERVICE_TYPE,
          data64: threadToBase64,
          identifier: threadIdentifier,
          description: threadTitle.slice(0, 200),
        };
        // Published after the message batch succeeds (see onSubmit).
        pendingThreadHeaderRef.current = {
          groupId,
          threadToken,
          messageIdentifier,
          request: threadPublishRequest,
        };

        const threadMessageObject = {
          subject: threadTitle,
          createdAt,
          version: 1,
          attachments: attachmentReferences,
          textContentV2: composedMessageBody,
          name: senderName,
          threadOwner: senderName,
        };
        const messageToBase64 = await objectToBase64(threadMessageObject);
        const messagePublishRequest = {
          action: "PUBLISH_QDN_RESOURCE",
          name: senderName,
          service: MAIL_SERVICE_TYPE,
          data64: messageToBase64,
          identifier: messageIdentifier,
        };

        setPendingPublishType("thread");
        setThreadPublishResult({
          threadData: {
            title: threadTitle,
            groupId,
            createdAt,
            name: senderName,
          },
          threadOwner: senderName,
          name: senderName,
          threadId: threadIdentifier,
          created: createdAt,
          service: "MAIL_PRIVATE",
          identifier: messageIdentifier,
        });
        setPublishes({
          action: "PUBLISH_MULTIPLE_QDN_RESOURCES",
          resources: [messagePublishRequest, ...attachmentPublishes],
          encrypt: true,
          publicKeys: groupPublicKeys,
        });
        setIsOpenMultiplePublish(true);
        return;
      }

      const recipientName = target.label;
      // Through the name cache: the inline check already looked this name up.
      const recipientLookup = await lookupName(recipientName);
      if (recipientLookup.status !== "found") {
        throw new Error("Recipient name cannot be found");
      }
      const recipientAddress = recipientLookup.address;
      const recipientPublicKey = await lookupPublicKey(recipientAddress);
      if (!recipientPublicKey) {
        throw new Error("Cannot retrieve recipient public key");
      }

      // Binding request shape (data contract §3, §4): attachments, the To
      // copy, one copy per Cc and per Bcc name under one sendId, encrypted to
      // all of them; the additive `cc` names the Cc list in every copy, and
      // the embedded reply history is stripped of its own history (Bugs #12).
      const request = await buildDirectMailPublishRequest({
        senderName,
        service: MAIL_SERVICE_TYPE,
        sendId: uid(),
        to: {
          name: recipientName,
          address: recipientAddress,
          publicKey: recipientPublicKey,
        },
        cc: allowAliasAndBcc ? ccNames : [],
        bcc: allowAliasAndBcc ? bccNames : [],
        aliasValue: allowAliasAndBcc ? aliasValue : "",
        attachmentPublishes,
        mail: {
          subject,
          createdAt: Date.now(),
          attachments: attachmentReferences,
          textContentV2: composedMessageBody,
          replyTo: isReply ? replyTo : undefined,
        },
        encode: objectToBase64,
      });

      setPendingPublishType("mail");
      setThreadPublishResult(null);
      setPublishes(request);
      setIsOpenMultiplePublish(true);
    } catch (error: any) {
      setIsOpenMultiplePublish(false);
      setPublishes(null);
      setPendingPublishType("mail");
      setThreadPublishResult(null);
      // An unfinished thread header is kept: its post may already be on QDN.

      const message =
        typeof error === "string"
          ? error
          : typeof error?.error === "string"
          ? error.error
          : error?.message || "Failed to send message";

      setComposeError({ text: message });
      dispatch(
        setNotification({
          msg: message,
          alertType: "error",
        })
      );
      throw new Error("Failed to send message");
    }
  }

  const sendMail = () => {
    setComposeError(null);
    publishQDNResource().catch(() => {
      // Already reported inline and as a toast.
    });
  };

  // Publishes the thread header kept back until the posts went through.
  // Returns false (and shows a Retry) when that publish fails.
  const finishThreadPublish = useCallback(async (): Promise<boolean> => {
    const header = pendingThreadHeaderRef.current;
    if (!header) return true;
    try {
      await qortalRequest(header.request);
      pendingThreadHeaderRef.current = null;
      return true;
    } catch (error: any) {
      const detail =
        typeof error?.message === "string" && error.message
          ? ` (${error.message})`
          : "";
      setComposeError({
        text: `Your post was published, but the thread's title record was not${detail}. Retry to publish it; until then the thread is not listed.`,
        retry: "thread-header",
      });
      return false;
    }
  }, []);

  const completeThreadPublish = useCallback(() => {
    dispatch(
      setNotification({
        msg: "Thread published",
        alertType: "success",
      })
    );
    if (threadPublishResult) {
      onThreadPublished?.(threadPublishResult);
    }
    clearStoredDraft(activeDraftKey);
    clearStoredDraft(openedDraftKeyRef.current);
    setIsOpenMultiplePublish(false);
    setPublishes(null);
    setPendingPublishType("mail");
    setThreadPublishResult(null);
    setComposeError(null);
    closeModal();
  }, [
    activeDraftKey,
    clearStoredDraft,
    closeModal,
    dispatch,
    onThreadPublished,
    threadPublishResult,
  ]);

  const retryThreadHeader = async () => {
    setComposeError(null);
    const ok = await finishThreadPublish();
    if (ok) completeThreadPublish();
  };

  // Discard asks only when there is something to lose.
  const requestDiscard = async () => {
    if (composerHasContent()) {
      const confirmed = await showDiscardModal();
      if (!confirmed) return;
    }
    setComposeError(null);
    discardComposerDraft();
  };

  const handleComposerKeyDown = (event: React.KeyboardEvent) => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      event.stopPropagation();
      if (!isOpenMultiplePublish) sendMail();
    }
  };

  const sendButtonLabel = replyTo
    ? replyAll
      ? "Reply all"
      : "Reply"
    : forwardInfo
    ? "Forward"
    : isGroupTarget
    ? "Create Thread"
    : "Send Message";

  const composerContent = (
    <>
      <InstanceListContainer
        data-pane-scroll
        sx={[{
          backgroundColor: "var(--qmail-compose-surface)",
          flex: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: "column"
        }, isMobile ? {
          padding: "0.75rem"
        } : {
          padding: "1.25rem 2rem"
        }, isMobile ? {
          gap: "0.75rem"
        } : {
          gap: "1rem"
        }]}
      >
        <Box
          sx={[{
            display: "flex",
            flexDirection: "column",
            flexShrink: 0
          }, isMobile ? {
            gap: "0.75rem"
          } : {
            gap: "0.9rem"
          }]}
        >
          <NewMessageInputRow>
            <NewMessageAliasContainer
              sx={{
                width: "100%",
                flex: 1,
                minWidth: 0,
              }}
            >
              <NewMessageInputLabelP id="qmail-compose-from-label" sx={{ userSelect: "none" }}>
                From:
              </NewMessageInputLabelP>
              <TextField
                select
                value={fromName}
                onChange={event => {
                  setFromName(event.target.value);
                }}
                variant="standard"
                fullWidth
                sx={{
                  "& .MuiInputBase-root": {
                    color: "var(--new-message-text)",
                    fontSize: "1rem",
                  },
                  "& .MuiSelect-select": {
                    padding: 0,
                  },
                }}
                slotProps={{
                  input: {
                    disableUnderline: true,
                  },

                  select: {
                    disableUnderline: true,
                    labelId: "qmail-compose-from-label",
                    // The picture only for a name that has one: no letter, no gap.
                    renderValue: selected => {
                      const selectedName = String(selected ?? "");
                      return (
                        <Box component="span" sx={{ display: "flex", alignItems: "center", minWidth: 0 }}>
                          <NameAvatar
                            key={selectedName}
                            name={selectedName}
                            size={22}
                            known={userAvatarHash?.[selectedName]}
                            fallback="none"
                            gap={8}
                          />
                          <Box component="span" sx={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>
                            <NameText name={selectedName} />
                          </Box>
                        </Box>
                      );
                    },
                    MenuProps: {
                      slotProps: {
                        paper: {
                          sx: {
                            backgroundColor: "var(--qmail-shell-popover-bg)",
                            border: "1px solid var(--qmail-shell-border)",
                            color: "var(--qmail-compose-text)",
                          },
                        },
                      },
                    },
                  }
                }}>
                {fromOptions.map(nameOption => {
                  return (
                    <MenuItem key={nameOption} value={nameOption} sx={{ minHeight: 44, gap: "10px" }}>
                      {/* An empty slot for a name without a picture, so the names line up. */}
                      <NameAvatar
                        name={nameOption}
                        size={24}
                        known={userAvatarHash?.[nameOption]}
                        fallback="space"
                      />
                      <NameText name={nameOption} />
                    </MenuItem>
                  );
                })}
              </TextField>
            </NewMessageAliasContainer>
          </NewMessageInputRow>

          <NewMessageInputRow>
            <NewMessageAliasContainer
              sx={{
                flex: 1,
                minWidth: 0,
              }}
            >
              <NewMessageInputLabelP sx={{ userSelect: "none" }}>
                To:
              </NewMessageInputLabelP>
              <Autocomplete
                fullWidth
                freeSolo
                sx={{
                  flex: 1,
                  minWidth: 0,
                  "& .MuiAutocomplete-inputRoot": {
                    minWidth: 0,
                  },
                  // 44 px clear and open buttons (docs/DESIGN.md → Touch).
                  "& .MuiAutocomplete-clearIndicator, & .MuiAutocomplete-popupIndicator": {
                    width: 44,
                    height: 44,
                  },
                }}
                loading={isDirectorySearchLoading}
                options={targetOptions}
                filterOptions={options => options}
                value={selectedTargetOption}
                inputValue={destinationName}
                isOptionEqualToValue={(option, value) => {
                  const optionId = typeof option === "string" ? option : option.id;
                  const valueId = typeof value === "string" ? value : value.id;
                  return optionId === valueId;
                }}
                getOptionLabel={option => {
                  if (typeof option === "string") return option;
                  return option.label;
                }}
                onInputChange={(_, newInputValue, reason) => {
                  setDestinationName(newInputValue);
                  if (reason !== "input") return;
                  if (!newInputValue.trim()) {
                    setSelectedTargetOption(null);
                    return;
                  }
                  setSelectedTargetOption(prev => {
                    if (!prev) return null;
                    if (
                      normalizeValue(prev.label) ===
                      normalizeValue(newInputValue)
                    ) {
                      return prev;
                    }
                    return null;
                  });
                }}
                onChange={(_, newValue) => {
                  if (!newValue) {
                    setDestinationName("");
                    setSelectedTargetOption(null);
                    return;
                  }

                  if (typeof newValue === "string") {
                    setDestinationName(newValue);
                    setSelectedTargetOption(null);
                    return;
                  }

                  setDestinationName(newValue.label);
                  setSelectedTargetOption(newValue);
                }}
                renderInput={params => {
                  return (
                    <TextField
                      {...params}
                      variant="standard"
                      placeholder="Type a name or joined group"
                      sx={[
                        {
                          width: "100%",
                          color: "var(--new-message-text)",
                          "& .MuiInputBase-root": {
                            color: "var(--new-message-text)",
                          },
                          "& .MuiInputBase-input::placeholder": {
                            color: "var(--qmail-compose-placeholder)",
                            fontSize: "1rem",
                            opacity: 1,
                          },
                        },
                        strikeToInput && strikeInputSx,
                      ]}
                      slotProps={{
                        ...params.slotProps,

                        input: {
                          ...params.slotProps.input,
                          disableUnderline: true,
                        },
                        htmlInput: {
                          ...params.slotProps.htmlInput,
                          title: strikeToInput ? HIDDEN_CHARACTERS_TITLE : undefined,
                        },
                      }}
                    />
                  );
                }}
                renderOption={(props, option) => {
                  // MUI 9 puts `key` in props; spreading it warns (Bugs #22).
                  const { key: _optionKey, ...optionProps } = props as any;
                  const typeLabel =
                    option.targetType === "group" ? "Group" : "Name";
                  const sourceLabel =
                    option.source === "known-name"
                      ? "Recent"
                      : option.source === "joined-group"
                      ? "Joined"
                      : "Directory";

                  return (
                    <Box
                      component="li"
                      {...optionProps}
                      key={option.id}
                      sx={{ minHeight: 44 }}
                    >
                      <Box
                        sx={{
                          width: "100%",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: "12px",
                          minWidth: 0,
                        }}
                      >
                        <Box
                          sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: "10px",
                            minWidth: 0,
                          }}
                        >
                          {option.targetType === "group" ? (
                            <ForumOutlinedIcon
                              sx={{
                                fontSize: 22,
                                color: "var(--qmail-compose-muted)",
                              }}
                            />
                          ) : (
                            <AvatarWrapper
                              height="28px"
                              user={option.label}
                              fallback={option.label}
                            />
                          )}
                          <Typography
                            noWrap
                            sx={{
                              color: "var(--qmail-compose-text)",
                              fontSize: "0.95rem",
                              minWidth: 0,
                            }}
                          >
                            {option.targetType === "group" ? (
                              option.label
                            ) : (
                              <NameText name={option.label} />
                            )}
                          </Typography>
                        </Box>
                        <Typography
                          sx={{
                            color: "var(--qmail-compose-muted)",
                            fontSize: "0.875rem",
                            flexShrink: 0,
                          }}
                        >
                          {typeLabel} · {sourceLabel}
                        </Typography>
                      </Box>
                    </Box>
                  );
                }}
              />
            </NewMessageAliasContainer>
            {allowAliasAndBcc && (
              <NewMessageAliasContainer
                sx={{
                  flexShrink: 0,
                }}
              >
                {!showAlias && !requireSenderAlias && (
                  <Tooltip title={COMPOSE_TOGGLE_HELP.alias} {...composeToggleTooltipProps}>
                    <Button
                      variant="text"
                      size="small"
                      onClick={() => setShowAlias(true)}
                      sx={aliasToggleSx}
                    >
                      Send to alias
                    </Button>
                  </Tooltip>
                )}
                {!showCC && (
                  <Tooltip title={COMPOSE_TOGGLE_HELP.cc} {...composeToggleTooltipProps}>
                    <Button
                      variant="text"
                      size="small"
                      onClick={() => setShowCC(true)}
                      sx={aliasToggleSx}
                    >
                      Cc
                    </Button>
                  </Tooltip>
                )}
                {!showBCC && (
                  <Tooltip title={COMPOSE_TOGGLE_HELP.bcc} {...composeToggleTooltipProps}>
                    <Button
                      variant="text"
                      size="small"
                      onClick={() => setShowBCC(true)}
                      sx={aliasToggleSx}
                    >
                      Bcc
                    </Button>
                  </Tooltip>
                )}
              </NewMessageAliasContainer>
            )}
          </NewMessageInputRow>

          {(isDirectorySearchLoading || isGroupTarget || recipientCheck) && (
            <Box
              role="status"
              aria-live="polite"
              sx={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                flexWrap: "wrap",
              }}
            >
              {(isDirectorySearchLoading ||
                recipientCheck?.status === "checking") && (
                <CircularProgress size={14} />
              )}
              {!isGroupTarget && recipientCheck?.status === "found" && (
                <CheckCircleOutlineIcon
                  sx={{ fontSize: 18, color: "var(--qmail-compose-muted)" }}
                />
              )}
              {!isGroupTarget && recipientCheck?.status === "missing" && (
                <ErrorOutlineIcon
                  sx={{ fontSize: 18, color: "var(--qmail-danger-text)" }}
                />
              )}
              <Typography
                sx={{
                  fontSize: "0.875rem",
                  color:
                    !isGroupTarget && recipientCheck?.status === "missing"
                      ? "var(--qmail-danger-text)"
                      : "var(--qmail-compose-muted)",
                }}
              >
                {isGroupTarget
                  ? "Group selected: this will publish a new thread. Subject is used as thread title."
                  : recipientCheck?.status === "missing"
                  ? <>&quot;<NameText name={recipientCheck.name} />&quot; is not a registered name</>
                  : recipientCheck?.status === "found"
                  ? <><NameText name={recipientCheck.name} /> is a registered name</>
                  : recipientCheck?.status === "checking"
                  ? "Checking the name…"
                  : "Type to search joined groups and registered names."}
              </Typography>
            </Box>
          )}

          {allowAliasAndBcc && (requireSenderAlias || showAlias) && (
            <NewMessageInputRow>
              <NewMessageAliasContainer
                sx={{
                  width: "100%",
                  flex: 1,
                  minWidth: 0,
                }}
              >
                <NewMessageInputLabelP>
                  {requireSenderAlias ? "Reply alias:" : "Send to alias:"}
                </NewMessageInputLabelP>
                <Input
                  id="qmail-compose-alias"
                  value={aliasValue}
                  onChange={e => {
                    setAliasValue(e.target.value);
                  }}
                  placeholder={
                    requireSenderAlias
                      ? "An alias of yours (not the inbox's)"
                      : "The recipient's alias inbox"
                  }
                  disableUnderline
                  autoComplete="off"
                  autoCorrect="off"
                  inputProps={{
                    "aria-describedby": "qmail-compose-alias-help",
                    title: strikeAliasInput ? HIDDEN_CHARACTERS_TITLE : undefined,
                  }}
                  sx={[
                    {
                      width: "100%",
                      color: "var(--new-message-text)",
                      "& .MuiInput-input::placeholder": {
                        color: "var(--qmail-compose-placeholder) !important",
                        fontSize: "1.25rem",
                        fontStyle: "normal",
                        fontWeight: 400,
                        lineHeight: "120%",
                        letterSpacing: "0.15px",
                        opacity: 1,
                      },
                    },
                    strikeAliasInput && strikeInputSx,
                  ]}
                />
              </NewMessageAliasContainer>
            </NewMessageInputRow>
          )}
          {allowAliasAndBcc && (requireSenderAlias || showAlias) && (
            <Typography
              id="qmail-compose-alias-help"
              sx={{
                fontSize: "0.875rem",
                color: "var(--qmail-compose-muted)",
                mt: "-0.4rem",
              }}
            >
              {requireSenderAlias
                ? "Replies from an alias inbox are sent under an alias of your own, so the other side keeps writing to the alias. It must differ from the inbox's alias."
                : "The message is delivered to the alias inbox named here instead of the recipient's name inbox; it is still encrypted to the recipient, and you stay the sender. Cc and Bcc copies are not sent with an alias."}
            </Typography>
          )}

          {allowAliasAndBcc && showCC && (
            <NewMessageInputRow>
              <NewMessageAliasContainer
                sx={{
                  width: "100%",
                  flex: 1,
                  minWidth: 0,
                }}
              >
                <NewMessageInputLabelP>Cc:</NewMessageInputLabelP>
                <ChipInputComponent
                  chips={ccNames}
                  setChips={setCcNames}
                  inputLabel="Cc name"
                  excludeNames={[
                    resolvedTarget?.type === "name" ? resolvedTarget.label : "",
                    ...bccNames.map(chip => chip.name),
                  ]}
                  onPendingChange={setCcPending}
                  describedBy="qmail-compose-cc-help"
                />
              </NewMessageAliasContainer>
            </NewMessageInputRow>
          )}
          {allowAliasAndBcc && showCC && (
            <Typography
              id="qmail-compose-cc-help"
              sx={{
                fontSize: "0.875rem",
                color: "var(--qmail-compose-muted)",
                mt: "-0.4rem",
              }}
            >
              Cc names are visible to every recipient.
              {replyAll && replyTo
                ? " Reply all put the other people on the original here; remove anyone who should not get a copy."
                : ""}
            </Typography>
          )}
          {allowAliasAndBcc && showBCC && (
            <NewMessageInputRow>
              <NewMessageAliasContainer
                sx={{
                  width: "100%",
                  flex: 1,
                  minWidth: 0,
                }}
              >
                <NewMessageInputLabelP>Bcc:</NewMessageInputLabelP>
                <ChipInputComponent
                  chips={bccNames}
                  setChips={setBccNames}
                  inputLabel="Bcc name"
                  excludeNames={[
                    resolvedTarget?.type === "name" ? resolvedTarget.label : "",
                    ...ccNames.map(chip => chip.name),
                  ]}
                  onPendingChange={setBccPending}
                  describedBy="qmail-compose-bcc-help"
                />
              </NewMessageAliasContainer>
            </NewMessageInputRow>
          )}
          {allowAliasAndBcc && showBCC && (
            <Typography
              id="qmail-compose-bcc-help"
              sx={{
                fontSize: "0.875rem",
                color: "var(--qmail-compose-muted)",
                mt: "-0.4rem",
              }}
            >
              Bcc names are not listed in the mail, but each Bcc copy is a public QDN record labelled with its recipient's name.
              {aliasValue ? " With an alias, no Bcc copies are sent." : ""}
            </Typography>
          )}

          {/* Mail order: From, To, alias, Cc, Bcc, then Subject. */}
          <NewMessageInputRow sx={{ width: "100%" }}>
            <Input
              id="standard-adornment-name"
              value={subject}
              onChange={e => {
                setSubject(e.target.value);
              }}
              placeholder="Subject"
              disableUnderline
              autoComplete="off"
              autoCorrect="off"
              sx={{
                width: "100%",
                color: "var(--new-message-text)",
                "& .MuiInput-input::placeholder": {
                  color: "var(--qmail-compose-placeholder) !important",
                  fontSize: "1.25rem",
                  fontStyle: "normal",
                  fontWeight: 400,
                  lineHeight: "120%",
                  letterSpacing: "0.15px",
                  opacity: 1,
                },
              }}
            />
          </NewMessageInputRow>

          <AttachmentContainer
            {...getRootProps()}
            sx={{
              width: "fit-content",
            }}
          >
            <input {...getInputProps()} />
            <NewMessageAttachmentImg src={AttachmentSVG} alt="Attach files" />
          </AttachmentContainer>

          {attachments.map(({ file, extension, forwardKey }, index) => {
            return (
              <Box
                key={`${file?.name || "attachment"}-${index}`}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  minWidth: 0,
                }}
              >
                <Typography
                  sx={{
                    fontSize: "1rem",
                    minWidth: 0,
                    overflowWrap: "anywhere",
                    color: !extension
                      ? "var(--qmail-danger-text)"
                      : "var(--qmail-compose-text)",
                  }}
                >
                  {file?.name} ({formatBytes(file?.size || 0)})
                  {forwardKey ? " · forwarded" : ""}
                </Typography>
                <IconButton
                  aria-label={`Remove attachment ${file?.name || ""}`}
                  onClick={() =>
                    setAttachments(prev =>
                      prev.filter((item, itemIndex) => itemIndex !== index)
                    )
                  }
                  size="small"
                  sx={{
                    minWidth: 44,
                    minHeight: 44,
                    color: "var(--qmail-compose-muted)",
                  }}
                >
                  <CloseIcon fontSize="small" />
                </IconButton>
                {!extension && (
                  <Typography
                    sx={{
                      fontSize: "0.875rem",
                      fontWeight: "bold",
                      color: "var(--qmail-danger-text)",
                    }}
                  >
                    This file has no extension
                  </Typography>
                )}
              </Box>
            );
          })}

          {refusedForwardAttachments.map((label, index) => (
            <Typography
              key={`refused-${index}`}
              sx={{ fontSize: "1rem", overflowWrap: "anywhere", color: "var(--qmail-compose-muted)" }}
            >
              {label} · Attachment not available to forward
            </Typography>
          ))}

          {forwardAttachmentJobs.map(job => {
            const label =
              job.reference.originalFilename ||
              job.reference.filename ||
              job.reference.identifier;
            const percent = job.progress?.percentLoaded;
            const hasPercent =
              typeof percent === "number" && Number.isFinite(percent) && percent > 0;
            return (
              <Box
                key={job.key}
                role="status"
                aria-live="polite"
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "4px",
                  minWidth: 0,
                }}
              >
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    minWidth: 0,
                    flexWrap: "wrap",
                  }}
                >
                  <Typography
                    sx={{
                      fontSize: "1rem",
                      minWidth: 0,
                      overflowWrap: "anywhere",
                      color:
                        job.status === "error"
                          ? "var(--qmail-danger-text)"
                          : "var(--qmail-compose-text)",
                    }}
                  >
                    {label}
                    {" · "}
                    {job.status === "error"
                      ? job.error || "Could not fetch"
                      : `${fetchingLabel(job.progress?.status)}${
                          hasPercent ? ` ${Math.min(100, Math.round(percent))}%` : ""
                        }`}
                  </Typography>
                  {job.status === "error" && (
                    <Button
                      size="small"
                      onClick={() => startForwardAttachmentJob(job.reference)}
                      sx={{ textTransform: "none", minHeight: 44 }}
                    >
                      Retry
                    </Button>
                  )}
                  <IconButton
                    aria-label={`Remove attachment ${label}`}
                    onClick={() => removeForwardAttachmentJob(job.key)}
                    size="small"
                    sx={{
                      minWidth: 44,
                      minHeight: 44,
                      color: "var(--qmail-compose-muted)",
                    }}
                  >
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </Box>
                {job.status === "loading" && (
                  <LinearProgress
                    variant={hasPercent ? "determinate" : "indeterminate"}
                    value={hasPercent ? Math.min(100, percent) : undefined}
                    sx={{ borderRadius: 2, maxWidth: 320 }}
                  />
                )}
              </Box>
            );
          })}
        </Box>

        {/* The pane scrolls, not this column: neither it nor the reply card
            may shrink below its content, or the card collapses under the
            editor's minimum height and its buttons spill over the toolbar. */}
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            flex: "1 0 auto",
            gap: "0.75rem",
          }}
        >
          {replyTo && (
            <Box
              sx={[{
                border: "1px solid var(--qmail-shell-border)",
                background: "var(--qmail-shell-hover)",
                borderRadius: "0.9rem",
                display: "flex",
                flexDirection: "column",
                gap: "0.6rem",
                flexShrink: 0
              }, isMobile ? {
                padding: "0.8rem"
              } : {
                padding: "0.9rem 1rem"
              }]}
            >
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "0.75rem",
                  flexWrap: "wrap",
                }}
              >
                <Typography
                  sx={{
                    fontSize: "0.98rem",
                    fontWeight: 700,
                    color: "var(--qmail-compose-text)",
                  }}
                >
                  Replying to {replyTo?.user ? <NameText name={replyTo.user} /> : "Unknown sender"}
                </Typography>
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.45rem",
                    flexWrap: "wrap",
                  }}
                >
                  <Button
                    onClick={() => setReplyPreviewMode("preview")}
                    size="small"
                    variant={
                      replyPreviewMode === "preview" ? "contained" : "text"
                    }
                    sx={[{
                      minWidth: 44,
                      minHeight: 44,
                      textTransform: "none"
                    }, replyPreviewMode === "preview" ? {
                      color: "var(--qmail-action-primary-text)"
                    } : {
                      color: "var(--qmail-compose-text)"
                    }, replyPreviewMode === "preview" ? {
                      backgroundColor: "var(--qmail-action-primary-bg)"
                    } : {
                      backgroundColor: "transparent"
                    }]}
                  >
                    Preview
                  </Button>
                  <Button
                    onClick={() => setReplyPreviewMode("full")}
                    size="small"
                    variant={replyPreviewMode === "full" ? "contained" : "text"}
                    sx={[{
                      minWidth: 44,
                      minHeight: 44,
                      textTransform: "none"
                    }, replyPreviewMode === "full" ? {
                      color: "var(--qmail-action-primary-text)"
                    } : {
                      color: "var(--qmail-compose-text)"
                    }, replyPreviewMode === "full" ? {
                      backgroundColor: "var(--qmail-action-primary-bg)"
                    } : {
                      backgroundColor: "transparent"
                    }]}
                  >
                    Full
                  </Button>
                  <Button
                    onClick={() => setReplyPreviewMode("hidden")}
                    size="small"
                    sx={{
                      minWidth: 44,
                      minHeight: 44,
                      textTransform: "none",
                      color: "var(--qmail-compose-text)",
                      fontSize: "0.875rem",
                    }}
                  >
                    Hide
                  </Button>
                </Box>
              </Box>
              <Typography
                sx={{
                  fontSize: "0.875rem",
                  color: "var(--qmail-compose-muted)",
                }}
              >
                {formatFullTimestamp(replyTo?.createdAt)} •{" "}
                {replyTo?.subject || "- no subject -"}
              </Typography>
              <Typography
                sx={{
                  fontSize: "0.875rem",
                  color: "var(--qmail-compose-muted)",
                }}
              >
                The original is quoted in your reply below, and the message
                itself travels with the reply as thread history.
              </Typography>
              {replyPreviewMode !== "hidden" && (
                <Box
                  role="region"
                  aria-label="Quoted original message"
                  tabIndex={0}
                  sx={[{
                    overflowY: "auto",
                    pr: "0.25rem"
                  }, replyPreviewMode === "full" ? {
                    maxHeight: "16rem"
                  } : {
                    maxHeight: "8rem"
                  }]}
                >
                  <Typography
                    sx={{
                      fontSize: "0.92rem",
                      color: "var(--qmail-compose-text)",
                      whiteSpace: "pre-wrap",
                      overflowWrap: "anywhere",
                    }}
                  >
                    {activeReplyPreviewText}
                  </Typography>
                </Box>
              )}
            </Box>
          )}

          <Box
            sx={[{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              minWidth: 0
            }, isMobile ? {
              minHeight: "15rem"
            } : {
              minHeight: "18rem"
            }, {
              // A short frame (landscape, or the keyboard up) can't spare 15rem.
              [`@media ${SHORT_FRAME_MEDIA}`]: { minHeight: "6rem" }
            }]}
          >
            <TextEditor
              className="qmail-compose-editor"
              inlineContent={value}
              setInlineContent={(val: string, source?: string) => {
                if (source === "user") {
                  bodyBaselineFrozenRef.current = true;
                } else if (!bodyBaselineFrozenRef.current) {
                  // Quill's own rewrite of the starting content.
                  initialValueRef.current = val;
                }
                setValue(val);
              }}
              placeholder={
                replyTo ? "Write your reply here" : "Write your message here"
              }
              autoFocus={Boolean(replyTo)}
              focusToken={replyTo?.id || null}
            />
          </Box>
        </Box>
      </InstanceListContainer>
      <InstanceFooter
        sx={[{
          backgroundColor: "var(--qmail-compose-footer-surface)",
          borderTop: "1px solid var(--qmail-compose-divider)",
          alignItems: "stretch",
          height: "auto",
          gap: "0.5rem"
        }, isMobile ? {
          padding: "0.6rem 0.75rem calc(env(safe-area-inset-bottom, 0px) + 0.6rem)"
        } : {
          padding: "0.85rem 2rem"
        }]}
      >
        {composeError && (
          <Alert
            severity="error"
            onClose={() => setComposeError(null)}
            action={
              composeError.retry === "thread-header" ? (
                <Button
                  color="inherit"
                  size="small"
                  onClick={() => void retryThreadHeader()}
                  sx={{ minHeight: 36 }}
                >
                  Retry
                </Button>
              ) : undefined
            }
            sx={{ alignItems: "center", fontSize: "0.875rem" }}
          >
            {composeError.text}
          </Alert>
        )}
        <Box
          sx={{
            display: "flex",
            width: "100%",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "0.75rem",
            flexWrap: "wrap",
          }}
        >
          <Button
            variant="outlined"
            onClick={() => void requestDiscard()}
            sx={{
              textTransform: "none",
              borderColor: "var(--qmail-shell-border)",
              color: "var(--qmail-compose-text)",
              minHeight: 44,
              px: "1rem",
              borderRadius: "0.85rem",
            }}
          >
            Discard
          </Button>
          {draftSavedAt && (
            <Typography
              role="status"
              aria-live="polite"
              sx={{
                fontSize: "0.875rem",
                color: "var(--qmail-compose-muted)",
              }}
            >
              Draft saved {formatFullTimestamp(draftSavedAt).slice(11, 16)}
            </Typography>
          )}
          <Button
            variant="contained"
            onClick={sendMail}
            disabled={isOpenMultiplePublish}
            title="Ctrl+Enter (⌘+Enter on Mac) also sends"
            endIcon={
              isGroupTarget && !replyTo ? (
                <CreateThreadIcon
                  color="currentColor"
                  opacity={1}
                  height="22px"
                  width="22px"
                />
              ) : (
                <SendNewMessage
                  color="currentColor"
                  opacity={1}
                  height="22px"
                  width="22px"
                />
              )
            }
            sx={[{
              marginLeft: "auto",
              minHeight: 44,
              minWidth: 120,
              textTransform: "none",
              fontWeight: 600,
              borderRadius: "0.85rem",
              px: "1.1rem",
              color: "var(--qmail-action-primary-text)",
              backgroundColor: "var(--qmail-action-primary-bg)",
              border: "1px solid var(--qmail-action-primary-border)",
              boxShadow: "none",
              "&:hover": {
                backgroundColor: "var(--qmail-action-primary-hover)",
                boxShadow: "none",
              },
              "& svg path": { fill: "currentColor" },
            }, isMobile ? {
              flex: "1 1 auto"
            } : {
              flex: "0 0 auto"
            }]}
          >
            {sendButtonLabel}
          </Button>
        </Box>
      </InstanceFooter>
    </>
  );

  return (
    <Box
      onKeyDown={handleComposerKeyDown}
      sx={[{
        display: "flex",
        height: "100%",
        minHeight: 0,
        width: "100%"
      }, inlineMode ? {
        flexDirection: "column"
      } : {
        flexDirection: "row"
      }]}
    >
      {!inlineMode && !hideButton && (
        <ComposeContainer
          className="step-2"
          onClick={openModal}
          sx={{
            marginBottom: "10px",
            padding: "10px",
          }}
        >
          <ComposeIcon src={ComposeIconSVG} />
          <ComposeP>Compose</ComposeP>
        </ComposeContainer>
      )}
      {inlineMode ? (
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            height: "100%",
            minHeight: 0,
            width: "100%",
            background: "var(--Mail-Background)",
          }}
        >
          {composerContent}
        </Box>
      ) : (
        <ReusableModal
          open={isOpen}
          onClose={closeModal}
          customStyles={
            isMobile
              ? {
                  top: 0,
                  left: 0,
                  transform: "none",
                  width: "100%",
                  maxWidth: "100%",
                  height: "var(--qmail-app-height, 100dvh)",
                  maxHeight: "var(--qmail-app-height, 100dvh)",
                  borderRadius: 0,
                  background: "var(--Mail-Background)",
                  padding: "0px",
                  gap: "0px",
                }
              : {
                  maxHeight: "calc(var(--qmail-app-height, 100dvh) - 32px)",
                  maxWidth: "950px",
                  height: "700px",
                  borderRadius: "12px",
                  background: "var(--Mail-Background)",
                  padding: "0px",
                  gap: "0px",
                  width: "75%",
                }
          }
        >
          {composerContent}
        </ReusableModal>
      )}
      <Modal />
      <DiscardModal />
      {isOpenMultiplePublish && (
        <MultiplePublish
          isOpen={isOpenMultiplePublish}
          onError={(messageNotification, detail) => {
            const header = pendingThreadHeaderRef.current;
            const postState =
              header && pendingPublishType === "thread"
                ? detail?.states?.[header.messageIdentifier]
                : undefined;
            setIsOpenMultiplePublish(false);
            setPublishes(null);
            setPendingPublishType("mail");
            if (!messageNotification) {
              // Declined or cancelled in Hub: nothing of the batch stays.
              pendingThreadHeaderRef.current = null;
              setThreadPublishResult(null);
            } else if (postState && postState !== "failed") {
              // The post is on QDN, or Hub may still be publishing it: the
              // thread is listed only once its header is out, so offer it.
              setComposeError({
                text:
                  postState === "done"
                    ? "Your post is on QDN, but the thread's title record was not published, so the thread is not listed yet. Retry to publish it."
                    : "Your post may still reach QDN, but the thread's title record was not published, so the thread would not be listed. Retry to publish it, or Send again to retry the post in the same thread.",
                retry: "thread-header",
              });
            } else {
              setThreadPublishResult(null);
            }
            if (messageNotification) {
              dispatch(
                setNotification({
                  msg: messageNotification,
                  alertType: "error",
                })
              );
            }
          }}
          onSubmit={() => {
            if (pendingPublishType === "thread") {
              // The posts are on QDN; now the thread header that lists them.
              setIsOpenMultiplePublish(false);
              setPublishes(null);
              void finishThreadPublish().then(ok => {
                if (ok) completeThreadPublish();
              });
              return;
            }

            dispatch(
              setNotification({
                msg: "Message sent",
                alertType: "success",
              })
            );
            clearStoredDraft(activeDraftKey);
            clearStoredDraft(openedDraftKeyRef.current);
            setIsOpenMultiplePublish(false);
            setPublishes(null);
            setPendingPublishType("mail");
            setThreadPublishResult(null);
            setComposeError(null);
            closeModal();
          }}
          publishes={publishes}
        />
      )}
    </Box>
  );
};
