/**
 * Writing a shop review. Only names with an order at the shop get here (the
 * panel checks, as the original did). The publish is the original's, built
 * by qdn/payloads (pinned by AddReview.pin.test.tsx): DOCUMENT
 * `q-store-review-<shortStoreId>-<uid>-<rating×10>` with `review.json`
 * `{title, description, rating, created}`, after its LIST_QDN_RESOURCES check
 * that the identifier is free.
 *
 * What changed around it: a Hub decline is a quiet cancel; Hub gets its
 * full 30 minutes for the publish, and after a timeout QDN is checked
 * before saying it failed, so Retry never pays the fee twice (docs/QORTAL.md
 * → pitfalls 10 and 11).
 */
import { useRef, useState } from "react";
import { Alert, Box, Button, Rating, TextField, Typography } from "@mui/material";
import { useDispatch, useSelector } from "react-redux";
import ShortUniqueId from "short-unique-id";
import type { RootState } from "../../../../state/store";
import { setNotification } from "../../../../state/features/notificationsSlice";
import { addToHashMapStoreReviews, addToReviews } from "../../../../state/features/storeSlice";
import { ResponsiveDialog } from "../../../../components/common/mobile";
import { shortStoreIdOf } from "../../../../qdn/identifiers";
import { buildReviewPublish } from "../../../../qdn/payloads";
import { errorMessage, isHubDecline, isHubTimeout } from "../../../../qdn/hubErrors";
import { invalidateQdnSearches, resourceExists } from "../../../../qdn/search";
import { isReviewSearchUrl } from "../../reviewsData";

/** Hub allows a publish up to 30 minutes (docs/QORTAL.md → pitfall 10). */
const REVIEW_PUBLISH_TIMEOUT_MS = 30 * 60_000;
export const REVIEW_TITLE_MAX = 180;

const uid = new ShortUniqueId({ length: 10 });

/** The original's check: is this identifier already taken under the name? */
async function identifierTaken(check: ReturnType<typeof buildReviewPublish>["existsCheck"]): Promise<boolean> {
  try {
    const response = await qortalRequest(check);
    return response?.resources?.length > 0;
  } catch {
    return false;
  }
}

export function AddReview({
  open,
  storeId,
  storeTitle,
  onClose,
  onPublished,
}: {
  open: boolean;
  storeId: string;
  storeTitle: string;
  onClose: () => void;
  onPublished?: () => void;
}) {
  const dispatch = useDispatch();
  const user = useSelector((state: RootState) => state.auth.user);
  const [rating, setRating] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // One id per review being written, so a retry after a timeout finds the first try.
  const [reviewUid] = useState(() => uid());
  const tried = useRef(new Set<string>());

  const missing = {
    rating: !rating,
    title: !title.trim(),
    text: !text.trim(),
  };

  const finish = (built: ReturnType<typeof buildReviewPublish>) => {
    const name = user?.name ?? "";
    const { created } = built.review;
    // As the original: the list gets the metadata's short copy, the full review is kept by id.
    dispatch(
      addToReviews({
        id: built.identifier,
        name,
        created,
        updated: created,
        title: title.slice(0, 60),
        description: text.slice(0, 150),
        rating,
      })
    );
    dispatch(
      addToHashMapStoreReviews({
        id: built.identifier,
        name,
        created,
        updated: created,
        title,
        description: text,
        rating,
        isValid: true,
      })
    );
    invalidateQdnSearches(isReviewSearchUrl);
    dispatch(setNotification({ alertType: "success", msg: "Review published" }));
    onPublished?.();
    onClose();
  };

  const publish = async () => {
    if (busy) return;
    setTouched(true);
    setError(null);
    const name = user?.name;
    if (!user?.address || !name) {
      setError("Sign in with a Qortal name to review this shop.");
      return;
    }
    if (!storeId) {
      setError("This shop can't be reviewed: its id is missing.");
      return;
    }
    if (missing.rating || missing.title || missing.text) return;

    const built = buildReviewPublish({
      name,
      shortStoreId: shortStoreIdOf(storeId),
      uid: reviewUid,
      rating: Number(rating),
      title,
      description: text,
      created: Date.now(),
    });
    setBusy(true);
    try {
      if (await identifierTaken(built.existsCheck)) {
        if (tried.current.has(built.identifier)) {
          // An earlier try that timed out did land.
          finish(built);
          return;
        }
        setError("A review with this id already exists. Close this and write it again.");
        return;
      }
      tried.current.add(built.identifier);
      await qortalRequestWithTimeout(built.request, REVIEW_PUBLISH_TIMEOUT_MS);
      finish(built);
    } catch (e) {
      if (isHubDecline(e)) return;
      if (isHubTimeout(e)) {
        const landed = await resourceExists("DOCUMENT", name, built.identifier, { fresh: true }).catch(() => false);
        if (landed) {
          finish(built);
          return;
        }
        setError("Hub didn't confirm the review in time. It may still arrive: check the reviews before publishing again.");
        return;
      }
      setError(`The review couldn't be published: ${errorMessage(e, "unknown error")}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <ResponsiveDialog
      open={open}
      onClose={onClose}
      title={storeTitle ? `Review ${storeTitle}` : "Write a review"}
      maxWidth="sm"
      // While Hub publishes (up to 30 minutes): no Back or Close that would do nothing, no Escape, no backdrop.
      busy={busy}
      actions={
        <>
          <Button color="inherit" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="contained" onClick={publish} aria-disabled={busy || undefined}>
            {busy ? "Publishing…" : "Publish review"}
          </Button>
        </>
      }
    >
      <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
        <Box component="fieldset" sx={{ border: 0, p: 0, m: 0, minWidth: 0 }}>
          <Typography component="legend" variant="subtitle2" sx={{ mb: 0.5, p: 0 }}>
            Your rating
          </Typography>
          <Rating
            name="review-rating"
            precision={0.5}
            size="large"
            value={rating}
            onChange={(_event, value) => setRating(value)}
            sx={{ fontSize: 40 }}
          />
          {touched && missing.rating && (
            <Typography variant="body2" color="error" role="alert">
              Pick a rating.
            </Typography>
          )}
        </Box>
        <TextField
          label="Title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          required
          fullWidth
          error={touched && missing.title}
          helperText={touched && missing.title ? "Add a title." : `${title.length}/${REVIEW_TITLE_MAX}`}
          slotProps={{ htmlInput: { maxLength: REVIEW_TITLE_MAX } }}
        />
        <TextField
          label="Your review"
          value={text}
          onChange={(event) => setText(event.target.value)}
          required
          fullWidth
          multiline
          minRows={4}
          maxRows={12}
          error={touched && missing.text}
          helperText={touched && missing.text ? "Write your review." : "What went well, and what didn't?"}
        />
        <Typography variant="body2" color="text.secondary">
          Your review is public under your name. Publishing costs a small QORT fee; Hub asks you to confirm.
        </Typography>
        {error && (
          <Alert severity="error" role="alert">
            {error}
          </Alert>
        )}
      </Box>
    </ResponsiveDialog>
  );
}
