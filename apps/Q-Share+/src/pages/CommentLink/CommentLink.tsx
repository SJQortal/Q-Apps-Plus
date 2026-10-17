import { useEffect, useState } from "react";
import { Box, CircularProgress, Typography } from "@mui/material";
import { useNavigate, useParams } from "react-router-dom";
import { EmptyState } from "../../components/common/EmptyState";
import { QSHARE_FILE_BASE } from "../../constants/Identifiers";
import { useNotificationAccount } from "../../hooks/useNotificationChecks";
import { loadActivity, parseCommentIdentifier } from "../../utils/notifications/activity";
import { searchQdn } from "../../utils/qdnSearch";
import { decodeParam, sharePath } from "../../utils/qortalLinks";

/**
 * The share a Q-Share comment belongs to. The comment's identifier holds only
 * the last 12 characters of the share's identifier: first among the account's
 * own shares, then one search for shares whose identifier ends that way
 * (newest first, as the original app would show the comment under each).
 */
export async function findCommentShare(
  commentIdentifier: string,
  ownNames: string[]
): Promise<{ name: string; identifier: string } | null> {
  const parsed = parseCommentIdentifier(commentIdentifier);
  if (!parsed) return null;
  if (ownNames.length) {
    const own = (await loadActivity(ownNames)).shares.get(parsed.key);
    if (own) return { name: own.name, identifier: own.identifier };
  }
  const rows = await searchQdn({ service: "DOCUMENT", identifier: parsed.key, limit: 20 });
  const match = rows.find((row) => row.identifier.startsWith(QSHARE_FILE_BASE) && row.identifier.endsWith(parsed.key));
  return match ? { name: match.name, identifier: match.identifier } : null;
}

/**
 * `/comment/:name/:identifier`: where a notification about a reply leads when
 * the share isn't known yet (a reply to your comment on someone else's share).
 * Finds the share and moves on to its comments.
 */
const CommentLink = () => {
  const params = useParams();
  const navigate = useNavigate();
  const account = useNotificationAccount();
  const identifier = decodeParam(params.identifier);
  // The identifier whose share couldn't be found (another link resets it).
  const [missingFor, setMissingFor] = useState<string | null>(null);
  const missing = missingFor === identifier;
  const ownKey = account?.names.join("\n") ?? "";

  useEffect(() => {
    let active = true;
    findCommentShare(identifier, ownKey ? ownKey.split("\n") : [])
      .then((share) => {
        if (!active) return;
        if (share) navigate(`${sharePath(share.name, share.identifier)}#comments`, { replace: true });
        else setMissingFor(identifier);
      })
      .catch(() => active && setMissingFor(identifier));
    return () => {
      active = false;
    };
  }, [identifier, ownKey, navigate]);

  if (missing) {
    return (
      <Box sx={{ maxWidth: 560, mx: "auto", px: 2, py: 6 }}>
        <EmptyState
          title="Share not found"
          description="This comment's share isn't on your node right now, or it was removed."
          actionLabel="Back to all shares"
          onAction={() => navigate("/")}
        />
      </Box>
    );
  }
  return (
    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 1.5, py: 8 }}>
      <CircularProgress size={22} aria-hidden />
      <Typography role="status" color="text.secondary">
        Finding the share…
      </Typography>
    </Box>
  );
};

export default CommentLink;
