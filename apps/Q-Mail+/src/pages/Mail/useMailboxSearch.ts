import { useEffect, useMemo, useRef, useState } from "react";
import { useDispatch } from "react-redux";
import { addToHashMapMail } from "../../state/features/mailSlice";
import { fetchAndEvaluateMail } from "../../utils/fetchMail";
import { extractTextFromSlate } from "../../utils/extractTextFromSlate";
import {
  getSentRecipientDisplayLabel,
  parseSentRecipientFromIdentifier,
} from "./mailIdentifier";

type MailboxType = "inbox" | "sent";

interface UseMailboxSearchArgs {
  messages: any[];
  query: string;
  mailboxType: MailboxType;
  username?: string;
  hashMapMailMessages: Record<string, any>;
  enabled?: boolean;
}

interface SearchCacheEntry {
  text: string;
  isComplete: boolean;
}

export interface MailboxSearchStatus {
  active: boolean;
  complete: boolean;
  scanned: number;
  total: number;
  matches: number;
}

const SEARCH_CONCURRENCY = 3;

const toMessageId = (message: any): string => {
  return String(message?.id || message?.identifier || "");
};

const normalizeSearchText = (value: string): string => {
  return value.toLowerCase().trim();
};

const getTerms = (query: string): string[] => {
  return normalizeSearchText(query)
    .split(/\s+/)
    .map(item => item.trim())
    .filter(Boolean);
};

const includesAllTerms = (haystack: string, terms: string[]): boolean => {
  if (!terms.length) return true;
  return terms.every(term => haystack.includes(term));
};

const extractBodyText = (decryptedMessage: any): string => {
  const body = decryptedMessage?.textContentV2;
  if (typeof body === "string") {
    return body;
  }
  if (Array.isArray(body)) {
    return extractTextFromSlate(body);
  }
  return "";
};

const getOtherPartyText = (message: any, mailboxType: MailboxType): string => {
  if (mailboxType === "inbox") {
    return typeof message?.user === "string" ? message.user : "";
  }

  const identifier = toMessageId(message);
  const { recipientName, recipientAddress } =
    parseSentRecipientFromIdentifier(identifier);
  const recipientLabel = getSentRecipientDisplayLabel(identifier);
  const senderName = typeof message?.user === "string" ? message.user : "";

  return [
    recipientLabel,
    recipientName || "",
    recipientAddress ? `address ${recipientAddress}` : "",
    senderName,
  ]
    .join(" ")
    .trim();
};

const buildSearchText = (
  message: any,
  mailboxType: MailboxType,
  decryptedMessage?: any
): string => {
  const subject =
    typeof decryptedMessage?.subject === "string"
      ? decryptedMessage.subject
      : "";
  const body = decryptedMessage ? extractBodyText(decryptedMessage) : "";
  const title = typeof message?.title === "string" ? message.title : "";
  const description =
    typeof message?.description === "string" ? message.description : "";

  const combined = [
    getOtherPartyText(message, mailboxType),
    subject,
    body,
    title,
    description,
  ]
    .join(" ")
    .trim();

  return normalizeSearchText(combined);
};

const getDecryptCandidates = (
  message: any,
  mailboxType: MailboxType
): string[] => {
  const candidates: string[] = [];

  if (mailboxType === "sent") {
    const identifier = toMessageId(message);
    const { recipientName } = parseSentRecipientFromIdentifier(identifier);
    if (recipientName) {
      candidates.push(recipientName);
    }
  }

  if (typeof message?.user === "string" && message.user.trim()) {
    candidates.push(message.user.trim());
  }

  return Array.from(new Set(candidates.filter(Boolean)));
};

export const useMailboxSearch = ({
  messages,
  query,
  mailboxType,
  username,
  hashMapMailMessages,
  enabled = true,
}: UseMailboxSearchArgs) => {
  const dispatch = useDispatch();
  const runIdRef = useRef(0);
  const cacheRef = useRef<Map<string, SearchCacheEntry>>(new Map());
  const hashMapRef = useRef(hashMapMailMessages);
  const [results, setResults] = useState<any[]>(messages);
  const [status, setStatus] = useState<MailboxSearchStatus>({
    active: false,
    complete: true,
    scanned: 0,
    total: messages.length,
    matches: messages.length,
  });

  useEffect(() => {
    hashMapRef.current = hashMapMailMessages;
  }, [hashMapMailMessages]);

  const terms = useMemo(() => {
    return getTerms(query);
  }, [query]);

  useEffect(() => {
    const total = messages.length;
    const runId = ++runIdRef.current;

    if (!enabled || !terms.length) {
      setResults(messages);
      setStatus({
        active: false,
        complete: true,
        scanned: total,
        total,
        matches: total,
      });
      return () => {
        if (runIdRef.current === runId) {
          runIdRef.current += 1;
        }
      };
    }

    const matchedIds = new Set<string>();
    const pendingMessages: any[] = [];
    let scanned = 0;

    const applyState = (isComplete: boolean) => {
      const nextMessages = messages.filter(message => {
        const id = toMessageId(message);
        return matchedIds.has(id);
      });

      setResults(nextMessages);
      setStatus({
        active: !isComplete,
        complete: isComplete,
        scanned,
        total,
        matches: matchedIds.size,
      });
    };

    messages.forEach(message => {
      const messageId = toMessageId(message);
      if (!messageId) return;

      const cached = cacheRef.current.get(messageId);
      const knownDecrypted = hashMapRef.current[messageId];
      const hasKnownDecrypted =
        knownDecrypted?.isValid && !knownDecrypted?.unableToDecrypt;

      let text = cached?.text || buildSearchText(message, mailboxType);
      let isComplete = Boolean(cached?.isComplete);

      if (!isComplete && hasKnownDecrypted) {
        text = buildSearchText(message, mailboxType, knownDecrypted);
        isComplete = true;
      }

      cacheRef.current.set(messageId, {
        text,
        isComplete,
      });

      if (includesAllTerms(text, terms)) {
        matchedIds.add(messageId);
      }

      if (isComplete) {
        scanned += 1;
      } else {
        pendingMessages.push(message);
      }
    });

    applyState(pendingMessages.length === 0);

    if (!pendingMessages.length) {
      return () => {
        if (runIdRef.current === runId) {
          runIdRef.current += 1;
        }
      };
    }

    const resolveMessage = async (message: any): Promise<SearchCacheEntry> => {
      const messageId = toMessageId(message);
      const knownDecrypted = hashMapRef.current[messageId];
      const hasKnownDecrypted =
        knownDecrypted?.isValid && !knownDecrypted?.unableToDecrypt;

      if (hasKnownDecrypted) {
        const text = buildSearchText(message, mailboxType, knownDecrypted);
        return {
          text,
          isComplete: true,
        };
      }

      const decryptCandidates = getDecryptCandidates(message, mailboxType);
      let decryptedPayload: any = null;

      for (const otherUser of decryptCandidates) {
        try {
          const result = await fetchAndEvaluateMail(
            {
              user: message?.user,
              messageIdentifier: messageId,
              content: message,
              otherUser,
            },
            undefined,
            username
          );

          if (result?.id) {
            dispatch(addToHashMapMail(result));
          }

          if (result?.isValid && !result?.unableToDecrypt) {
            decryptedPayload = result;
            break;
          }
        } catch (error) {
          // Continue with fallback match text if decryption fails for this candidate.
        }
      }

      return {
        text: buildSearchText(message, mailboxType, decryptedPayload || undefined),
        isComplete: true,
      };
    };

    let queueIndex = 0;
    const workerCount = Math.min(SEARCH_CONCURRENCY, pendingMessages.length);

    const worker = async () => {
      while (true) {
        if (runIdRef.current !== runId) return;

        const nextIndex = queueIndex;
        queueIndex += 1;

        if (nextIndex >= pendingMessages.length) {
          return;
        }

        const message = pendingMessages[nextIndex];
        const messageId = toMessageId(message);
        if (!messageId) continue;

        const resolved = await resolveMessage(message);

        if (runIdRef.current !== runId) return;

        cacheRef.current.set(messageId, resolved);
        scanned += 1;

        if (includesAllTerms(resolved.text, terms)) {
          matchedIds.add(messageId);
        }

        applyState(scanned >= total);
      }
    };

    void Promise.all(Array.from({ length: workerCount }, () => worker())).then(
      () => {
        if (runIdRef.current !== runId) return;
        applyState(true);
      }
    );

    return () => {
      if (runIdRef.current === runId) {
        runIdRef.current += 1;
      }
    };
  }, [dispatch, enabled, mailboxType, messages, terms, username]);

  return {
    results,
    status,
  };
};
