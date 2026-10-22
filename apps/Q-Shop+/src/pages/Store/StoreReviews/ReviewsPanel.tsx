/**
 * A shop's reviews as a panel, for the shop page's reviews dialog and the
 * seller's Reviews tab. The props are the ones the seller page passes.
 */
import { StoreReviews } from "./StoreReviews";

export function ReviewsPanel(props: {
  storeId: string;
  storeTitle: string;
  storeImage: string;
  averageStoreRating?: number | null;
  onClose?: () => void;
  /** The shop's owner, whose own reviews don't count (else the viewed or current shop's). */
  storeOwner?: string;
}) {
  return (
    <StoreReviews
      storeId={props.storeId}
      storeTitle={props.storeTitle}
      storeImage={props.storeImage}
      storeOwner={props.storeOwner}
      averageStoreRating={props.averageStoreRating ?? null}
      onClose={props.onClose}
    />
  );
}
