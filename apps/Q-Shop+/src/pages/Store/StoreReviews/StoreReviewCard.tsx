/**
 * One review: who wrote it (and whether they have an order at the shop), the
 * stars from the identifier, the date, and the title and text from the
 * search metadata, which keeps at most 60 and 150 characters. "Read more"
 * fetches the full review then, once. Text is shown as plain text.
 *
 * "Ordered here" says exactly what is checked: an order resource for this
 * shop exists under the reviewer's name. It isn't "Verified buyer": anyone
 * can publish an order identifier for one publish fee, without paying the
 * seller, and nothing here can see the payment or the seller's status note.
 */
import { useState } from "react";
import { Box, Button, Chip, Rating, Typography } from "@mui/material";
import ShoppingBagOutlinedIcon from "@mui/icons-material/ShoppingBagOutlined";
import { NameAvatar } from "../../../components/common/NameAvatar";
import { useFetchStoreReviews } from "../../../hooks/useFetchStoreReviews";
import { RetryCancelled, withPeerRetries } from "../peerRetry";
import type { ShopReview } from "../reviewsData";

/** The metadata copies are cut at 60 and 150 characters; near those, there may be more. */
export function mayBeCut(review: Pick<ShopReview, "title" | "description">): boolean {
  return review.title.length >= 57 || review.description.length >= 145;
}

export function formatReviewDate(time: number | undefined): string {
  if (!time) return "";
  return new Date(time).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

type FullState = "idle" | "loading" | "fetching" | "failed";

export function StoreReviewCard({ review, orderedHere }: { review: ShopReview; orderedHere: boolean }) {
  const { getReview, hashMapStoreReviews } = useFetchStoreReviews();
  const full = hashMapStoreReviews[review.id];
  const [state, setState] = useState<FullState>("idle");
  const title = full?.title || review.title;
  const text = full?.description || review.description;
  const date = formatReviewDate(review.created);

  const readMore = async () => {
    if (state === "loading" || state === "fetching") return;
    setState("loading");
    // A body that isn't a review won't change; only a missing one is worth waiting for.
    let notAReview = false;
    try {
      await withPeerRetries(
        async () => {
          const found = await getReview(review.name, review.id);
          if (!found) {
            notAReview = true;
            throw new Error("Not a review");
          }
          return found;
        },
        { onRetry: () => setState("fetching"), shouldRetry: () => !notAReview }
      );
      setState("idle");
    } catch (error) {
      if (!(error instanceof RetryCancelled)) setState("failed");
    }
  };

  return (
    <Box component="article" sx={{ py: 2, "& + &": { borderTop: 1, borderColor: "divider" } }}>
      <Box sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 1 }}>
        <NameAvatar name={review.name} size={32} />
        <Typography sx={{ fontWeight: 600, overflowWrap: "anywhere" }}>{review.name}</Typography>
        {orderedHere && <Chip size="small" variant="outlined" icon={<ShoppingBagOutlinedIcon />} label="Ordered here" />}
      </Box>
      <Box sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 1, mt: 1 }}>
        <Rating value={review.rating} precision={0.5} readOnly size="small" />
        {date && (
          <Typography variant="body2" color="text.secondary" component="span">
            {date}
          </Typography>
        )}
      </Box>
      {title && (
        <Typography component="h3" sx={{ fontWeight: 700, mt: 1, overflowWrap: "anywhere" }}>
          {title}
        </Typography>
      )}
      {text && (
        <Typography sx={{ mt: 0.5, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
          {text}
          {!full && mayBeCut(review) ? "…" : ""}
        </Typography>
      )}
      {!full && mayBeCut(review) && (
        <Box sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 1, mt: 0.5 }}>
          <Button
            size="small"
            color="inherit"
            onClick={readMore}
            aria-disabled={state === "loading" || state === "fetching" || undefined}
            sx={{ minHeight: 44, ml: -1 }}
          >
            {state === "loading" ? "Loading…" : state === "fetching" ? "Fetching from peers…" : "Read more"}
          </Button>
          {state === "failed" && (
            <Typography variant="body2" color="text.secondary" role="status">
              Not available on your node right now.
            </Typography>
          )}
        </Box>
      )}
    </Box>
  );
}
