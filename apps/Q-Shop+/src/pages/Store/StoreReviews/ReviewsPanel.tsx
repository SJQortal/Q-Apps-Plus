/**
 * A shop's reviews as a panel, for the seller's Reviews tab and the shop
 * page. Round 2 rewrites it; this first version wraps the original dialog body.
 */
import { StoreReviews } from "./StoreReviews";

export function ReviewsPanel(props: {
  storeId: string;
  storeTitle: string;
  storeImage: string;
  averageStoreRating?: number | null;
  onClose?: () => void;
}) {
  return (
    <StoreReviews
      storeId={props.storeId}
      storeTitle={props.storeTitle}
      storeImage={props.storeImage}
      averageStoreRating={props.averageStoreRating ?? null}
      setOpenStoreReviews={() => props.onClose?.()}
    />
  );
}
