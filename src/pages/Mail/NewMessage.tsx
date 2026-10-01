import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ReusableModal } from "../../components/modals/ReusableModal";
import {
  Autocomplete,
  Box,
  Button,
  CircularProgress,
  IconButton,
  Input,
  LinearProgress,
  MenuItem,
  TextField,
  Typography,
  useMediaQuery,
} from "@mui/material";
import ShortUniqueId from "short-unique-id";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../../state/store";
import { useDropzone } from "react-dropzone";
import CloseIcon from "@mui/icons-material/Close";
import { setNotification } from "../../state/features/notificationsSlice";
import { useParams } from "react-router-dom";
import mime from "mime";
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
import { toQuill1Html } from "../../components/common/TextEditor/quillHtml";
import {
  AliasLabelP,
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
  NewMessageSendButton,
  NewMessageSendP,
} from "./Mail-styles";
import ComposeIconSVG from "../../assets/svgs/ComposeIcon.svg";
import AttachmentSVG from "../../assets/svgs/NewMessageAttachment.svg";
import { SendNewMessage } from "../../assets/svgs/SendNewMessage";
import { formatBytes } from "../../utils/displaySize";
import { formatFullTimestamp } from "../../utils/time";
import { extractTextFromSlate } from "../../utils/extractTextFromSlate";
import { CreateThreadIcon } from "../../assets/svgs/CreateThreadIcon";
import {
  aliasMailIdentifier,
  buildDirectMailObject,
  buildForwardHtml,
  buildReplyQuoteHtml,
  directMailIdentifier,
  messageBodyLines,
  replyAllRecipients,
  withSubjectPrefix,
} from "../../utils/mailCompose";
import { resolveName } from "../../utils/nameCache";
import {
  fetchAttachmentFile,
  type AttachmentFetchProgress,
  type AttachmentReference,
} from "../../utils/attachmentBytes";
import { fetchingLabel } from "../../layout/states";

const uid = new ShortUniqueId();
const maxSize = 40 * 1024 * 1024; // 40 MB in bytes

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

const extensionOfFile = (file: File): string | null => {
  const fromName = file.name.includes(".") ? file.name.split(".").pop() || "" : "";
  if (fromName) return fromName;
  return file.type ? mime.getExtension(file.type) || null : null;
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
  composePrefill?: ComposePrefill | null;
  onThreadPublished?: (result: ThreadPublishResult) => void;
}

interface StoredComposeDraft {
  draftId: string;
  fromName: string;
  toName: string;
  subject: string;
  value: string;
  aliasValue: string;
  showAlias: boolean;
  showBCC: boolean;
  bccNames: NameChip[];
  updatedAt: number;
}

const normalizeValue = (value: string): string => value.trim().toLowerCase();

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

const getComposeDraftsStorageKey = (address: string): string => {
  return `qmail_compose_drafts_${address}`;
};

const readComposeDraftsFromStorage = (
  address: string
): Record<string, StoredComposeDraft> => {
  try {
    const raw = localStorage.getItem(getComposeDraftsStorageKey(address));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }

    const sanitized: Record<string, StoredComposeDraft> = {};
    Object.entries(parsed).forEach(([key, value]) => {
      if (!key || !value || typeof value !== "object" || Array.isArray(value))
        return;
      const draft = value as Partial<StoredComposeDraft>;
      const fromName =
        typeof draft.fromName === "string" ? draft.fromName.trim() : "";
      const toName =
        typeof draft.toName === "string" ? draft.toName.trim() : "";
      if (!fromName || !toName) return;

      sanitized[key] = {
        draftId:
          typeof draft.draftId === "string" && draft.draftId.trim()
            ? draft.draftId.trim()
            : `${fromName}-${toName}-Draft-${Date.now()}`,
        fromName,
        toName,
        subject: typeof draft.subject === "string" ? draft.subject : "",
        value: typeof draft.value === "string" ? draft.value : "",
        aliasValue:
          typeof draft.aliasValue === "string" ? draft.aliasValue : "",
        showAlias: Boolean(draft.showAlias),
        showBCC: Boolean(draft.showBCC),
        bccNames: Array.isArray(draft.bccNames) ? draft.bccNames : [],
        updatedAt: Number(draft.updatedAt || 0),
      };
    });

    return sanitized;
  } catch {
    return {};
  }
};

const writeComposeDraftsToStorage = (
  address: string,
  drafts: Record<string, StoredComposeDraft>
): void => {
  try {
    localStorage.setItem(
      getComposeDraftsStorageKey(address),
      JSON.stringify(drafts)
    );
  } catch {
    // Ignore storage failures.
  }
};

const createComposeDraftId = (
  fromName: string,
  toName: string,
  updatedAt: number
): string => {
  return `${fromName}-${toName}-Draft-${updatedAt}`;
};

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
  ownedNames = [],
  joinedGroups = [],
  priorityRecipientNames = [],
  composePrefill = null,
  onThreadPublished,
}: NewMessageProps) => {
  const { name } = useParams();
  const dispatch = useDispatch();
  const { user } = useSelector((state: RootState) => state.auth);

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
  const [replyPreviewMode, setReplyPreviewMode] = useState<
    "preview" | "full" | "hidden"
  >("preview");
  const isMobile = useMediaQuery("(max-width:950px)");
  const isHydratingDraftRef = useRef(false);
  const lastLoadedDraftKeyRef = useRef<string | null>(null);
  // What the composer started with (the reply quote, the forward header, a
  // prefilled subject). Content equal to this is not "something the user
  // wrote", so it is neither saved as a draft nor guarded on Discard.
  const initialValueRef = useRef("");
  const initialSubjectRef = useRef("");
  // Attachments of a forwarded message being fetched and decrypted so they
  // can be re-published, encrypted, to the new recipient.
  const [forwardAttachmentJobs, setForwardAttachmentJobs] = useState<
    ForwardAttachmentJob[]
  >([]);
  const forwardJobControllersRef = useRef(new Map<string, AbortController>());

  const { Modal, showModal } = useConfirmationModal({
    title: "Important",
    message:
      "To keep yourself anonymous remember to not use the same alias as the person you are messaging",
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

  const knownRecipientNameOptions = useMemo(() => {
    return dedupeStrings(priorityRecipientNames);
  }, [priorityRecipientNames]);

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
        const response = await qortalRequest({
          action: "SEARCH_NAMES",
          query,
          prefix: true,
          limit: 30,
          reverse: false,
        });
        if (cancelled) return;
        if (!Array.isArray(response)) {
          setDirectoryNameOptions([]);
          return;
        }
        const names = dedupeStrings(
          response
            .map((item: any) => {
              return typeof item?.name === "string" ? item.name.trim() : "";
            })
            .filter(Boolean)
        );
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
  const allowAliasAndBcc = !isGroupTarget;
  const activeDraftKey = useMemo(() => {
    const senderName = fromName.trim();
    if (!user?.address || !senderName || resolvedTarget?.type !== "name")
      return null;
    const targetName = resolvedTarget.label.trim();
    if (!targetName) return null;
    const baseKey = `${normalizeValue(senderName)}::${normalizeValue(targetName)}`;
    // A reply keeps its own draft; a new mail to the same name keeps the old key.
    const replyToId = typeof replyTo?.id === "string" ? replyTo.id : "";
    return replyToId ? `${baseKey}::reply:${replyToId}` : baseKey;
  }, [fromName, replyTo?.id, resolvedTarget, user?.address]);

  useEffect(() => {
    if (allowAliasAndBcc) return;
    setShowAlias(false);
    setShowBCC(false);
    setAliasValue("");
    setBccNames([]);
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
      const normalizedDraftKey =
        typeof draftKey === "string" ? draftKey.trim() : "";
      if (!address || !normalizedDraftKey) return;

      const existingDrafts = readComposeDraftsFromStorage(address);
      if (!existingDrafts[normalizedDraftKey]) return;
      delete existingDrafts[normalizedDraftKey];
      writeComposeDraftsToStorage(address, existingDrafts);
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
    setShowAlias(false);
    setShowBCC(false);
    setValue("");
    setAliasValue("");
    setReplyPreviewMode("preview");
    setThreadPublishResult(null);
    setPendingPublishType("mail");
    initialValueRef.current = "";
    initialSubjectRef.current = "";
  }, [cancelForwardAttachmentJobs]);

  const discardComposerDraft = useCallback(() => {
    clearStoredDraft(activeDraftKey || lastLoadedDraftKeyRef.current);
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
    setIsOpen(true);
    setReplyTo(null);
    setForwardInfo(null);

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
    if (typeof prefillSubject === "string") {
      setSubject(prefillSubject);
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
      setSubject(nextSubject);
      initialSubjectRef.current = nextSubject;
      // Start the editor with the quoted original (Quill 1 markup, so the
      // original app renders it too). A stored draft for this reply, if any,
      // replaces it when the draft key resolves.
      const quoteHtml = buildReplyQuoteHtml({
        sender: replyTo?.user,
        sentAt: formatFullTimestamp(replyTo?.createdAt),
        lines: messageBodyLines(replyTo, extractTextFromSlate),
      });
      setValue(quoteHtml);
      initialValueRef.current = quoteHtml;
    }
  }, [replyTo]);

  // Reply all: everyone from the original's to/cc (minus our own names and
  // the sender) becomes a Bcc chip, i.e. a separate encrypted copy.
  useEffect(() => {
    if (!replyTo || !replyAll) return;
    const { others } = replyAllRecipients(replyTo, [
      user?.name || "",
      ...ownedNames,
    ]);
    if (!others.length) return;

    let cancelled = false;
    setShowBCC(true);
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
      if (cancelled) return;
      const missing = others.filter((_, index) => !resolved[index]);
      const chips: NameChip[] = resolved
        .filter((item): item is NonNullable<typeof item> => Boolean(item))
        .map(item => ({
          name: item.name,
          publicKey: item.publicKey,
          address: item.address,
        }));
      setBccNames(prev => {
        const known = new Set(prev.map(chip => normalizeValue(chip.name)));
        return [
          ...prev,
          ...chips.filter(chip => !known.has(normalizeValue(chip.name))),
        ];
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
    if (!forwardInfo) return;
    setIsOpen(true);
    lastLoadedDraftKeyRef.current = null;

    const info: ForwardInfo =
      typeof forwardInfo === "string" ? { html: forwardInfo } : forwardInfo;
    const source = info.message;
    if (!source || typeof source !== "object") {
      // An older caller sent ready-made HTML: use it as is.
      const html = info.html || "";
      setValue(html);
      initialValueRef.current = html;
      return;
    }

    const nextSubject = withSubjectPrefix(source.subject, "Fwd");
    setSubject(nextSubject);
    initialSubjectRef.current = nextSubject;
    const html = buildForwardHtml(
      {
        from: source.user,
        sentAt: formatFullTimestamp(source.createdAt),
        subject: typeof source.subject === "string" ? source.subject : "",
        to: info.to || source.recipient || user?.name || "",
      },
      messageBodyLines(source, extractTextFromSlate)
    );
    setValue(html);
    initialValueRef.current = html;

    // Re-attach the original files: fetched and decrypted here, re-published
    // encrypted to the new recipient on Send.
    cancelForwardAttachmentJobs();
    setAttachments(prev => prev.filter(item => !item?.forwardKey));
    attachmentReferencesOf(source).forEach(startForwardAttachmentJob);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forwardInfo]);

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

    const storedDraft = readComposeDraftsFromStorage(user.address)[
      activeDraftKey
    ];
    lastLoadedDraftKeyRef.current = activeDraftKey;
    if (!storedDraft) return;

    isHydratingDraftRef.current = true;
    setSubject(storedDraft.subject || "");
    setValue(storedDraft.value || "");
    setAliasValue(storedDraft.aliasValue || "");
    setShowAlias(Boolean(storedDraft.showAlias || storedDraft.aliasValue));
    setShowBCC(Boolean(storedDraft.showBCC && storedDraft.bccNames?.length));
    setBccNames(
      Array.isArray(storedDraft.bccNames) ? storedDraft.bccNames : []
    );
    window.setTimeout(() => {
      isHydratingDraftRef.current = false;
    }, 0);
  }, [activeDraftKey, user?.address]);

  useEffect(() => {
    if (!activeDraftKey || !user?.address || isHydratingDraftRef.current)
      return;

    const timeout = window.setTimeout(() => {
      const fromNameValue = fromName.trim();
      const toNameValue =
        resolvedTarget?.type === "name" ? resolvedTarget.label.trim() : "";
      if (!fromNameValue || !toNameValue) return;

      const subjectChanged =
        subject.trim() && subject !== initialSubjectRef.current;
      const bodyChanged =
        value !== initialValueRef.current && stripHtmlTags(value).trim();
      const hasDraftContent = Boolean(
        subjectChanged || bodyChanged || aliasValue.trim() || bccNames.length
      );

      if (!hasDraftContent) {
        clearStoredDraft(activeDraftKey);
        return;
      }

      const updatedAt = Date.now();
      const existingDrafts = readComposeDraftsFromStorage(user.address);
      existingDrafts[activeDraftKey] = {
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
      };
      writeComposeDraftsToStorage(user.address, existingDrafts);
    }, 350);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [
    activeDraftKey,
    aliasValue,
    bccNames,
    clearStoredDraft,
    fromName,
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

          const extension = mime.getExtension(type);
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

  const fetchGroupPublicKeys = useCallback(
    async (groupId: string): Promise<string[]> => {
      const normalizedGroupId = groupId.trim();
      if (!normalizedGroupId) return [];

      const response = await fetch(
        `/groups/members/${encodeURIComponent(normalizedGroupId)}?limit=0`
      );
      const responseData = await response.json();
      const membersArray = Array.isArray(responseData?.members)
        ? responseData.members
        : [];

      const addresses = dedupeStrings(
        membersArray
          .map((item: any) => {
            return typeof item?.member === "string" ? item.member.trim() : "";
          })
          .filter(Boolean)
      );
      if (!addresses.length) return [];

      const accountData = await Promise.all(
        addresses.map(async address => {
          try {
            const account = await qortalRequest({
              action: "GET_ACCOUNT_DATA",
              address,
            });
            return typeof account?.publicKey === "string"
              ? account.publicKey
              : "";
          } catch {
            return "";
          }
        })
      );

      return dedupeStrings(accountData.filter(Boolean));
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
    if (noExtension.length > 0) {
      errorMsg =
        "One of your attachments does not have an extension (example: .png, .pdf, ect...)";
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
      const composedMessageBody = toQuill1Html(value);

      if (!target) return;

      if (target.type === "group") {
        const groupId = String(target.groupId || "").trim();
        if (!groupId) {
          throw new Error("Cannot publish thread without a valid group");
        }

        const groupPublicKeys = await fetchGroupPublicKeys(groupId);
        if (!groupPublicKeys.length) {
          throw new Error("No group members were found for encryption");
        }

        const createdAt = Date.now();
        const threadToken = uid();
        const threadTitle = subject.trim();
        const threadIdentifier = `qortal_qmail_thread_group${groupId}_${threadToken}`;
        const messageIdentifier = `qortal_qmail_thmsg_group${groupId}_${threadToken}_${uid()}`;

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
        await qortalRequest(threadPublishRequest);

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
      const recipientNameData = await qortalRequest({
        action: "GET_NAME_DATA",
        name: recipientName,
      });
      const recipientAddress =
        typeof recipientNameData?.owner === "string"
          ? recipientNameData.owner
          : "";
      if (!recipientAddress) {
        throw new Error("Recipient name cannot be found");
      }

      const recipientAccount = await qortalRequest({
        action: "GET_ACCOUNT_DATA",
        address: recipientAddress,
      });
      const recipientPublicKey =
        typeof recipientAccount?.publicKey === "string"
          ? recipientAccount.publicKey
          : "";
      if (!recipientPublicKey) {
        throw new Error("Cannot retrieve recipient public key");
      }

      const bccPublicKeys = bccNames.map(item => item.publicKey);
      const sendId = uid();
      const createdAt = Date.now();
      // Binding JSON shape (data contract §3a) plus the additive to/cc fields;
      // the embedded reply history is stripped of its own history (Bugs #12).
      const mailObject: any = buildDirectMailObject({
        subject,
        createdAt,
        attachments: attachmentReferences,
        textContentV2: composedMessageBody,
        recipient: recipientName,
        replyTo: isReply ? replyTo : undefined,
        service: MAIL_SERVICE_TYPE,
      });

      const mailPostToBase64 = await objectToBase64(mailObject);
      let identifier = directMailIdentifier(
        recipientName,
        recipientAddress,
        sendId
      );

      if (aliasValue) {
        identifier = aliasMailIdentifier(aliasValue, sendId);
      }

      const primaryMailPublish = {
        action: "PUBLISH_QDN_RESOURCE",
        name: senderName,
        service: MAIL_SERVICE_TYPE,
        data64: mailPostToBase64,
        identifier,
      };
      const mailPublishes = [primaryMailPublish];

      if (!aliasValue) {
        for (const element of bccNames) {
          const copyMailObject = structuredClone(mailObject);
          copyMailObject.recipient = element.name;
          const bccMailToBase64 = await objectToBase64(copyMailObject);
          const bccIdentifier = directMailIdentifier(
            element.name,
            element.address,
            sendId
          );

          mailPublishes.push({
            action: "PUBLISH_QDN_RESOURCE",
            name: senderName,
            service: MAIL_SERVICE_TYPE,
            data64: bccMailToBase64,
            identifier: bccIdentifier,
          });
        }
      }

      setPendingPublishType("mail");
      setThreadPublishResult(null);
      setPublishes({
        action: "PUBLISH_MULTIPLE_QDN_RESOURCES",
        resources: [...attachmentPublishes, ...mailPublishes],
        encrypt: true,
        publicKeys: [recipientPublicKey, ...bccPublicKeys],
      });
      setIsOpenMultiplePublish(true);
    } catch (error: any) {
      setIsOpenMultiplePublish(false);
      setPublishes(null);
      setPendingPublishType("mail");
      setThreadPublishResult(null);

      const message =
        typeof error === "string"
          ? error
          : typeof error?.error === "string"
          ? error.error
          : error?.message || "Failed to send message";

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
    void publishQDNResource();
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
              <NewMessageInputLabelP sx={{ userSelect: "none" }}>
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
                    <MenuItem key={nameOption} value={nameOption}>
                      {nameOption}
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
                      sx={{
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
                      }}
                      slotProps={{
                        ...params.slotProps,

                        input: {
                          ...params.slotProps.input,
                          disableUnderline: true,
                        }
                      }}
                    />
                  );
                }}
                renderOption={(props, option) => {
                  const typeLabel =
                    option.targetType === "group" ? "Group" : "Name";
                  const sourceLabel =
                    option.source === "known-name"
                      ? "Recent"
                      : option.source === "joined-group"
                      ? "Joined"
                      : "Directory";

                  return (
                    <Box component="li" {...props} key={option.id}>
                      <Box
                        sx={{
                          width: "100%",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: "12px",
                        }}
                      >
                        <Typography
                          sx={{
                            color: "var(--qmail-compose-text)",
                            fontSize: "0.95rem",
                          }}
                        >
                          {option.label}
                        </Typography>
                        <Typography
                          sx={{
                            color: "var(--qmail-compose-muted)",
                            fontSize: "0.75rem",
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
                <AliasLabelP onClick={() => setShowAlias(true)}>
                  Add Alias
                </AliasLabelP>
                <AliasLabelP onClick={() => setShowBCC(true)}>Bcc</AliasLabelP>
              </NewMessageAliasContainer>
            )}
          </NewMessageInputRow>

          {(isDirectorySearchLoading || isGroupTarget) && (
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                flexWrap: "wrap",
              }}
            >
              {isDirectorySearchLoading && <CircularProgress size={14} />}
              <Typography
                sx={{
                  fontSize: "0.78rem",
                  color: "var(--qmail-compose-muted)",
                }}
              >
                {isGroupTarget
                  ? "Group selected: this will publish a new thread. Subject is used as thread title."
                  : "Type to search joined groups and registered names."}
              </Typography>
            </Box>
          )}

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
                "&:focus": {
                  outline: "none",
                },
              }}
            />
          </NewMessageInputRow>

          {allowAliasAndBcc && (requireSenderAlias || showAlias) && (
            <NewMessageInputRow>
              <NewMessageAliasContainer
                sx={{
                  width: "100%",
                  flex: 1,
                  minWidth: 0,
                }}
              >
                <NewMessageInputLabelP>Alias:</NewMessageInputLabelP>
                <Input
                  id="standard-adornment-name"
                  value={aliasValue}
                  onChange={e => {
                    setAliasValue(e.target.value);
                  }}
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
                    "&:focus": {
                      outline: "none",
                    },
                  }}
                />
              </NewMessageAliasContainer>
            </NewMessageInputRow>
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
                <ChipInputComponent chips={bccNames} setChips={setBccNames} />
              </NewMessageAliasContainer>
            </NewMessageInputRow>
          )}
          {allowAliasAndBcc && replyAll && replyTo && (
            <Typography
              sx={{
                fontSize: "0.875rem",
                color: "var(--qmail-compose-muted)",
              }}
            >
              Reply all: the other people on the original get their own copy
              (listed under Bcc). Remove anyone who should not receive it.
            </Typography>
          )}

          <AttachmentContainer
            {...getRootProps()}
            sx={{
              width: "fit-content",
            }}
          >
            <input {...getInputProps()} />
            <NewMessageAttachmentImg src={AttachmentSVG} />
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

        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
            minHeight: 0,
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
                minHeight: 0
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
                  Replying to {replyTo?.user || "Unknown sender"}
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
                      minWidth: "unset",
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
                      minWidth: "unset",
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
                      minWidth: "unset",
                      textTransform: "none",
                      color: "var(--qmail-compose-text)",
                      fontSize: "0.8rem",
                    }}
                  >
                    Hide
                  </Button>
                </Box>
              </Box>
              <Typography
                sx={{
                  fontSize: "0.8rem",
                  color: "var(--qmail-compose-muted)",
                }}
              >
                {formatFullTimestamp(replyTo?.createdAt)} •{" "}
                {replyTo?.subject || "- no subject -"}
              </Typography>
              <Typography
                sx={{
                  fontSize: "0.8rem",
                  color: "var(--qmail-compose-muted)",
                }}
              >
                The original is quoted in your reply below, and the message
                itself travels with the reply as thread history.
              </Typography>
              {replyPreviewMode !== "hidden" && (
                <Box
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
            }]}
          >
            <TextEditor
              className="qmail-compose-editor"
              inlineContent={value}
              setInlineContent={(val: any) => {
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
          alignItems: "stretch",
          height: "auto"
        }, isMobile ? {
          padding: "0.85rem 0.9rem calc(env(safe-area-inset-bottom, 0px) + 0.85rem)"
        } : {
          padding: "1rem 2rem"
        }, isMobile ? {
          position: "sticky"
        } : {
          position: "static"
        }, isMobile ? {
          bottom: 0
        } : {
          bottom: "auto"
        }, isMobile ? {
          zIndex: 2
        } : {
          zIndex: "auto"
        }]}
      >
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
            onClick={discardComposerDraft}
            sx={{
              textTransform: "none",
              borderColor: "var(--qmail-shell-border)",
              color: "var(--qmail-compose-text)",
              minHeight: "2.9rem",
              px: "1rem",
              borderRadius: "0.85rem",
            }}
          >
            Discard
          </Button>
          <NewMessageSendButton
            sx={[{
              marginLeft: "auto"
            }, isMobile ? {
              padding: "10px 14px"
            } : {
              padding: "8px 16px 8px 12px"
            }]}
            onClick={sendMail}
          >
            <NewMessageSendP>{sendButtonLabel}</NewMessageSendP>
            {isGroupTarget && !replyTo ? (
              <CreateThreadIcon
                color="currentColor"
                opacity={1}
                height="25px"
                width="25px"
              />
            ) : (
              <SendNewMessage
                color="currentColor"
                opacity={1}
                height="25px"
                width="25px"
              />
            )}
          </NewMessageSendButton>
        </Box>
      </InstanceFooter>
    </>
  );

  return (
    <Box
      sx={[{
        display: "flex",
        height: "100%",
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
          customStyles={{
            maxHeight: "95vh",
            maxWidth: "950px",
            height: isMobile ? "95vh" : "700px",
            borderRadius: "12px 12px 0px 0px",
            background: "var(--Mail-Background)",
            padding: "0px",
            gap: "0px",
            width: isMobile ? "95%" : "75%",
          }}
        >
          {composerContent}
        </ReusableModal>
      )}
      <Modal />
      {isOpenMultiplePublish && (
        <MultiplePublish
          isOpen={isOpenMultiplePublish}
          onError={messageNotification => {
            setIsOpenMultiplePublish(false);
            setPublishes(null);
            setPendingPublishType("mail");
            setThreadPublishResult(null);
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
            const successMessage =
              pendingPublishType === "thread"
                ? "Thread published"
                : "Message sent";
            dispatch(
              setNotification({
                msg: successMessage,
                alertType: "success",
              })
            );

            if (pendingPublishType === "thread" && threadPublishResult) {
              onThreadPublished?.(threadPublishResult);
            }

            clearStoredDraft(activeDraftKey);
            setIsOpenMultiplePublish(false);
            setPublishes(null);
            setPendingPublishType("mail");
            setThreadPublishResult(null);
            closeModal();
          }}
          publishes={publishes}
        />
      )}
    </Box>
  );
};
