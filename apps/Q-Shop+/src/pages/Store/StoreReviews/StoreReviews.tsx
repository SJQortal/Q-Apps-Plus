/**
 * A shop's reviews: the summary (average, count, how the stars spread), who
 * may write one, and the list, 20 at a time, newest first, one per reviewer,
 * without the owner's own. "Verified buyer" comes from one order search per
 * page of names. Everything reads the same cached search as the shop header.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Box, Button, IconButton, LinearProgress, Rating, Skeleton, Typography } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import RateReviewOutlinedIcon from "@mui/icons-material/RateReviewOutlined";
import { useSelector } from "react-redux";
import type { RootState } from "../../../state/store";
import { EmptyState } from "../../../components/common/EmptyState";
import { shortStoreIdOf } from "../../../qdn/identifiers";
import { fetchVerifiedBuyers, hasOrderAtShop, REVIEWS_PAGE, REVIEW_SEARCH_CAP, roundToHalf, type ReviewSummary } from "../reviewsData";
import { useShopReviews } from "../useShopData";
import { StoreReviewCard } from "./StoreReviewCard";
import { AddReview } from "./AddReview/AddReview";

export interface StoreReviewsProps {
  storeId: string;
  storeTitle: string;
  storeImage?: string;
  /** The shop's owner: their own reviews don't count. */
  storeOwner?: string;
  /** Shown until the panel's own summary has loaded. */
  averageStoreRating?: number | null;
  /** Adds a close button, for hosts that don't have their own. */
  onClose?: () => void;
}

function Summary({ summary, fallback }: { summary: ReviewSummary; fallback?: number | null }) {
  const average = summary.average ?? fallback ?? null;
  const most = Math.max(1, ...summary.distribution);
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "1fr", sm: "160px minmax(0, 1fr)" },
        gap: { xs: 2, sm: 3 },
        alignItems: "center",
      }}
    >
      <Box sx={{ textAlign: { xs: "left", sm: "center" }, display: "flex", flexDirection: { xs: "row", sm: "column" }, alignItems: "center", gap: { xs: 1.5, sm: 0.5 } }}>
        <Typography component="p" sx={{ fontSize: 44, fontWeight: 700, lineHeight: 1 }}>
          {average === null ? "–" : average.toFixed(1)}
        </Typography>
        <Box>
          <Rating
            value={average === null ? 0 : roundToHalf(average)}
            precision={0.5}
            readOnly
            aria-label={average === null ? "No ratings yet" : `Average ${average.toFixed(1)} out of 5`}
          />
          <Typography variant="body2" color="text.secondary">
            {summary.count} review{summary.count === 1 ? "" : "s"}
          </Typography>
        </Box>
      </Box>
      <Box component="ul" aria-label="How the ratings spread" sx={{ listStyle: "none", m: 0, p: 0, display: "flex", flexDirection: "column", gap: 0.75 }}>
        {[5, 4, 3, 2, 1].map((stars) => {
          const count = summary.distribution[stars - 1];
          return (
            <Box component="li" key={stars} sx={{ display: "grid", gridTemplateColumns: "56px minmax(0, 1fr) 32px", alignItems: "center", gap: 1 }}>
              <Typography variant="body2" color="text.secondary">
                {stars} star{stars === 1 ? "" : "s"}
              </Typography>
              <LinearProgress
                variant="determinate"
                value={(count / most) * 100}
                aria-label={`${stars} star${stars === 1 ? "" : "s"}: ${count} review${count === 1 ? "" : "s"}`}
                sx={{ height: 8, borderRadius: 4 }}
              />
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: "right" }}>
                {count}
              </Typography>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

type ReviewRight = { name: string; state: "checking" | "yes" | "no" | "error" };

export function StoreReviews({ storeId, storeTitle, storeOwner, averageStoreRating, onClose }: StoreReviewsProps) {
  const user = useSelector((state: RootState) => state.auth.user);
  const viewedOwner = useSelector((state: RootState) => (state.store.storeId === storeId ? state.store.storeOwner : null));
  const currentStore = useSelector((state: RootState) => state.global.currentStore);
  const listedOwner = useSelector((state: RootState) => state.store.hashMapStores[storeId]?.owner);
  const owner = storeOwner || viewedOwner || (currentStore?.id === storeId ? currentStore.owner || user?.name : null) || listedOwner || null;
  const shortStoreId = shortStoreIdOf(storeId);
  const { status, reviews, summary, capped, reload } = useShopReviews(storeId, owner);
  const [pages, setPages] = useState(1);
  const [writing, setWriting] = useState(false);
  const [right, setRight] = useState<ReviewRight | null>(null);
  const [rightNonce, setRightNonce] = useState(0);
  const [verified, setVerified] = useState<Set<string>>(() => new Set());
  const asked = useRef(new Set<string>());
  const mounted = useRef(true);

  const name = user?.name ?? "";
  const isOwner = !!name && name === owner;
  const shown = reviews.slice(0, pages * REVIEWS_PAGE);
  const mine = !!name && reviews.some((review) => review.name === name);

  // May the signed-in name review? The original's rule: an order at the shop.
  useEffect(() => {
    if (!name || isOwner || !shortStoreId) return;
    let alive = true;
    hasOrderAtShop(shortStoreId, name, { fresh: rightNonce > 0 }).then(
      (yes) => {
        if (alive) setRight({ name, state: yes ? "yes" : "no" });
      },
      () => {
        if (alive) setRight({ name, state: "error" });
      }
    );
    return () => {
      alive = false;
    };
  }, [isOwner, name, rightNonce, shortStoreId]);
  const canReview = right?.name === name ? right.state : "checking";

  // "Verified buyer": one search per page of reviewer names not asked about yet.
  // Keyed by the names (not the array, which is new every render), and an
  // answer is kept for as long as the panel is open, even after a re-render.
  const pageNamesKey = [...new Set(shown.map((review) => review.name))].join("\n");
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    const todo = pageNamesKey ? pageNamesKey.split("\n").filter((n) => !asked.current.has(n)) : [];
    if (todo.length === 0 || !shortStoreId) return;
    todo.forEach((n) => asked.current.add(n));
    for (let i = 0; i < todo.length; i += REVIEWS_PAGE) {
      const batch = todo.slice(i, i + REVIEWS_PAGE);
      fetchVerifiedBuyers(shortStoreId, batch).then(
        (found) => {
          if (mounted.current && found.size) setVerified((prev) => new Set([...prev, ...found]));
        },
        () => batch.forEach((n) => asked.current.delete(n))
      );
    }
  }, [pageNamesKey, shortStoreId]);

  let writeArea: ReactNode = null;
  if (!name) {
    writeArea = (
      <Typography variant="body2" color="text.secondary">
        Sign in to review this shop.
      </Typography>
    );
  } else if (!isOwner) {
    if (canReview === "checking") {
      writeArea = <Skeleton variant="rounded" width={160} height={44} />;
    } else if (canReview === "yes") {
      writeArea = (
        <Box sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 1.5 }}>
          <Button variant="contained" startIcon={<RateReviewOutlinedIcon />} onClick={() => setWriting(true)} sx={{ minHeight: 44 }}>
            {mine ? "Write a new review" : "Write a review"}
          </Button>
          {mine && (
            <Typography variant="body2" color="text.secondary">
              Your latest review replaces your earlier one.
            </Typography>
          )}
        </Box>
      );
    } else if (canReview === "no") {
      writeArea = (
        <Typography variant="body2" color="text.secondary">
          Only buyers with an order from this shop can review it.
        </Typography>
      );
    } else {
      writeArea = (
        <Box sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Couldn't check your orders with this shop.
          </Typography>
          <Button variant="outlined" onClick={() => setRightNonce((n) => n + 1)} sx={{ minHeight: 44 }}>
            Retry
          </Button>
        </Box>
      );
    }
  }

  let list: ReactNode;
  if (status === "loading") {
    list = (
      <Box aria-hidden>
        {[0, 1, 2].map((i) => (
          <Box key={i} sx={{ py: 2 }}>
            <Skeleton width="40%" />
            <Skeleton width="25%" />
            <Skeleton width="90%" />
          </Box>
        ))}
      </Box>
    );
  } else if (status === "error") {
    list = (
      <EmptyState title="Couldn't load the reviews" description="Your node didn't answer the search." actionLabel="Retry" onAction={reload} />
    );
  } else if (reviews.length === 0) {
    list = (
      <EmptyState
        icon={<RateReviewOutlinedIcon />}
        title="No reviews yet"
        description={canReview === "yes" && !isOwner ? "Be the first to review this shop." : undefined}
        actionLabel={canReview === "yes" && !isOwner ? "Write a review" : undefined}
        onAction={canReview === "yes" && !isOwner ? () => setWriting(true) : undefined}
      />
    );
  } else {
    list = (
      <>
        <Box>
          {shown.map((review) => (
            <StoreReviewCard key={review.id} review={review} verified={verified.has(review.name)} />
          ))}
        </Box>
        {shown.length < reviews.length && (
          <Box sx={{ display: "flex", justifyContent: "center", mt: 2 }}>
            <Button variant="outlined" onClick={() => setPages((p) => p + 1)} sx={{ minHeight: 44, minWidth: 160 }}>
              Show more reviews
            </Button>
          </Box>
        )}
        {capped && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            Showing reviews from the latest {REVIEW_SEARCH_CAP} published.
          </Typography>
        )}
      </>
    );
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
      {onClose && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Typography component="h2" sx={{ flex: 1, fontWeight: 700, fontSize: 18, overflowWrap: "anywhere" }}>
            Reviews{storeTitle ? ` · ${storeTitle}` : ""}
          </Typography>
          <IconButton aria-label="Close reviews" onClick={onClose} sx={{ width: 44, height: 44 }}>
            <CloseIcon />
          </IconButton>
        </Box>
      )}
      {status === "loading" ? (
        <Skeleton variant="rounded" height={120} />
      ) : (
        <Summary summary={summary} fallback={averageStoreRating} />
      )}
      {writeArea}
      <Box component="section" aria-label="Reviews" sx={{ borderTop: 1, borderColor: "divider" }}>
        {list}
      </Box>
      {writing && (
        <AddReview open storeId={storeId} storeTitle={storeTitle} onClose={() => setWriting(false)} onPublished={() => setPages(1)} />
      )}
    </Box>
  );
}
