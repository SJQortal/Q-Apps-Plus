export interface ParsedSentRecipient {
  recipientName: string | null;
  recipientAddress: string | null;
}

const SENT_IDENTIFIER_REGEX = /qortal_qmail_([^_]+)(?:_([^_]+))?_mail_/;
const SENT_IDENTIFIER_PREFIX = "_mail_qortal_qmail_";
const LEGACY_SENT_IDENTIFIER_PREFIX = "qortal_qmail_";
const THREAD_IDENTIFIER_PREFIX = "qortal_qmail_thread_";
const THREAD_MESSAGE_IDENTIFIER_PREFIX = "qortal_qmail_thmsg_";

export const isSentMailIdentifier = (identifier: string): boolean => {
  const normalizedIdentifier = identifier.trim().toLowerCase();
  if (!normalizedIdentifier.includes("_mail_")) {
    return false;
  }

  if (normalizedIdentifier.startsWith(SENT_IDENTIFIER_PREFIX)) {
    return true;
  }

  if (!normalizedIdentifier.startsWith(LEGACY_SENT_IDENTIFIER_PREFIX)) {
    return false;
  }

  return (
    !normalizedIdentifier.startsWith(THREAD_IDENTIFIER_PREFIX) &&
    !normalizedIdentifier.startsWith(THREAD_MESSAGE_IDENTIFIER_PREFIX)
  );
};

export const parseSentRecipientFromIdentifier = (
  identifier: string
): ParsedSentRecipient => {
  const match = identifier.match(SENT_IDENTIFIER_REGEX);
  if (!match) {
    return {
      recipientName: null,
      recipientAddress: null,
    };
  }

  return {
    recipientName: match[1] || null,
    recipientAddress: match[2] || null,
  };
};

export const getSentRecipientGroupKey = (identifier: string): string => {
  const { recipientName, recipientAddress } =
    parseSentRecipientFromIdentifier(identifier);

  const normalizedName = (recipientName || "").toLowerCase();
  const normalizedAddress = (recipientAddress || "").toLowerCase();

  if (normalizedName && normalizedAddress) {
    return `recipient:${normalizedName}:${normalizedAddress}`;
  }

  if (normalizedName) {
    return `alias:${normalizedName}`;
  }

  if (normalizedAddress) {
    return `recipient-address:${normalizedAddress}`;
  }

  return `unknown:${identifier}`;
};

export const getSentRecipientDisplayLabel = (identifier: string): string => {
  const { recipientName, recipientAddress } =
    parseSentRecipientFromIdentifier(identifier);

  if (recipientName) {
    return recipientName;
  }

  if (recipientAddress) {
    return `Address ...${recipientAddress}`;
  }

  return "Unknown recipient";
};
