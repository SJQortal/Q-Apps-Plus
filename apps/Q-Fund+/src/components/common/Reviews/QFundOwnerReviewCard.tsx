import { useState, FC, useEffect } from "react";
import { Rating } from "@mui/material";
import {
  ReviewContainer,
  ReviewDateFont,
  ReviewDescriptionFont,
  ReviewHeader,
  ReviewTitleFont,
  ReviewTitleRow,
  ReviewUsernameFont,
} from "./QFundOwnerReviews-styles";
import moment from "moment";
import { useFetchOwnerReviews } from "../../../hooks/useFetchOwnerReviews";
import { useSelector } from "react-redux";
import { RootState } from "../../../state/store";
import { OwnerReview } from "../../../state/features/globalSlice";

interface QFundOwnerReviewCardProps {
  review: OwnerReview;
}

export const QFundOwnerReviewCard: FC<QFundOwnerReviewCardProps> = ({
  review,
}) => {
  const [showCompleteReview, setShowCompleteReview] = useState<boolean>(false);
  const [fullStoreTitle, setFullStoreTitle] = useState<string>("");
  const [fullStoreDescription, setFullStoreDescription] = useState<string>("");

  const hashMapOwnerReviews = useSelector(
    (state: RootState) => state.global.hashMapOwnerReviews
  );

  const { created, name, title, rating, description, id, updated } = review;

  const { getReview, checkAndUpdateResource } = useFetchOwnerReviews();

  const handleFetchReviewRawData = async () => {
    try {
      if (name && id) {
        // avoid fetching the same review twice on QDN if it's already in the hashmap
        const res = checkAndUpdateResource({
          id,
          updated,
        });
        // if the review is not in the hashmap, fetch it from QDN
        if (res) {
          getReview(name, id, review);
        }
      }
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    Object.keys(hashMapOwnerReviews).find(key => {
      if (key === review.id) {
        setShowCompleteReview(true);
        setFullStoreTitle(hashMapOwnerReviews[key].title);
        setFullStoreDescription(hashMapOwnerReviews[key].description);
      }
    });
  }, [hashMapOwnerReviews]);

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
