import { useState, FC, useEffect } from "react";
import { Rating } from "@mui/material";
import {
  ReviewContainer,
  ReviewDateFont,
  ReviewDescriptionFont,
  ReviewHeader,
  ReviewTitleFont,
  ReviewTitleRow,
  ReviewUsernameFont
} from "./StoreReviews-styles";
import moment from "moment";
import { StoreReview } from "../../../state/features/storeSlice";
import { useFetchStoreReviews } from "../../../hooks/useFetchStoreReviews";
import { useSelector } from "react-redux";
import { RootState } from "../../../state/store";

interface StoreReviewCardProps {
  review: StoreReview;
}

export const StoreReviewCard: FC<StoreReviewCardProps> = ({ review }) => {
  const [showCompleteReview, setShowCompleteReview] = useState<boolean>(false);
  const [fullStoreTitle, setFullStoreTitle] = useState<string>("");
  const [fullStoreDescription, setFullStoreDescription] = useState<string>("");

  const hashMapStoreReviews = useSelector(
    (state: RootState) => state.store.hashMapStoreReviews
  );

  const { created, name, title, rating, description } = review;

  const { getReview, checkAndUpdateResource } = useFetchStoreReviews();

  const handleFetchReviewRawData = async () => {
    try {
      if (review.name && review.id) {
        const res = checkAndUpdateResource({
          id: review?.id,
          updated: review?.updated
        });
        if (res) {
          getReview(review?.name, review?.id, review);
        }
      }
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    Object.keys(hashMapStoreReviews).find((key) => {
      if (key === review.id) {
        setShowCompleteReview(true);
        setFullStoreTitle(hashMapStoreReviews[key].title);
        setFullStoreDescription(hashMapStoreReviews[key].description);
      }
    });
  }, [hashMapStoreReviews]);

  return (
    <ReviewContainer
      onClick={() => {
        setShowCompleteReview(true);
        handleFetchReviewRawData();
      }}
      showCompleteReview={showCompleteReview ? true : false}
    >
      <ReviewHeader>
        <ReviewUsernameFont>{name}</ReviewUsernameFont>
        <ReviewTitleRow>
          <ReviewTitleFont>{fullStoreTitle || title}</ReviewTitleFont>
          <Rating precision={0.5} value={rating} readOnly />
        </ReviewTitleRow>
        <ReviewDateFont>{moment(created).format("llll")}</ReviewDateFont>
      </ReviewHeader>
      <ReviewDescriptionFont>
        {fullStoreDescription || description}
      </ReviewDescriptionFont>
    </ReviewContainer>
  );
};
