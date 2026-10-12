export interface ParsedSentRecipient {
  recipientName: string | null;
  recipientAddress: string | null;
}

/**
 * Sent-mail identifiers, exactly as the original Q-Mail writes them:
 *
 *   `_mail_qortal_qmail_<name.slice(0,20)>_<address.slice(-6)>_mail_<id>`
 *   `_mail_qortal_qmail_<alias>_mail_<id>`
 *   (legacy: the same without the leading `_mail_`)
 *
 * Registered names and aliases may contain `_` (and spaces, `+`, `'`, `.`,
 * `|`, even `_mail_`), so the parser anchors on what cannot: the trailing
 * `_mail_<id>` (`id` is a ShortUniqueId, alphanumeric) and the 6-character
 * address suffix (Qortal addresses are base58, alphanumeric). Everything
 * between `qortal_qmail_` and that suffix is the name. A middle part whose
 * name would be longer than 20 characters cannot be name + suffix (the
 * original truncates names to 20), so it is an alias.
 */
const SENT_IDENTIFIER_TAIL_REGEX = /qortal_qmail_(.+)_mail_[^_]*$/;
const NAME_WITH_ADDRESS_SUFFIX_REGEX = /^(.+)_([A-Za-z0-9]{6})$/;
const MAX_IDENTIFIER_NAME_LENGTH = 20;
/** The pre-#19 parser, kept as a fallback for identifiers without a clean `_mail_<id>` tail. */
const LEGACY_SENT_IDENTIFIER_REGEX = /qortal_qmail_([^_]+)(?:_([^_]+))?_mail_/;
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
  const value = typeof identifier === "string" ? identifier : "";
  const tail = value.match(SENT_IDENTIFIER_TAIL_REGEX);
  if (tail) {
    const middle = tail[1];
    const withSuffix = middle.match(NAME_WITH_ADDRESS_SUFFIX_REGEX);
    if (withSuffix && withSuffix[1].length <= MAX_IDENTIFIER_NAME_LENGTH) {
      return { recipientName: withSuffix[1], recipientAddress: withSuffix[2] };
    }
    return { recipientName: middle || null, recipientAddress: null };
  }

  const legacy = value.match(LEGACY_SENT_IDENTIFIER_REGEX);
  if (!legacy) {
    return {
      recipientName: null,
      recipientAddress: null,
    };
  }

  return {
    recipientName: legacy[1] || null,
    recipientAddress: legacy[2] || null,
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
