import { FC, useState, useCallback, useEffect, useMemo } from "react";
import { CircularProgress, Grid, Rating, useTheme } from "@mui/material";
import {
  CardDetailsContainer,
  Divider,
  HeaderRow,
  OwnerAvatar,
  OwnerName,
  OwnerNameCol,
  OwnerReviewsContainer,
} from "./QFundOwnerReviews-styles";
import { StarSVG } from "../../../assets/svgs/StarSVG";
import {
  AddReviewButton,
  AverageReviewContainer,
  AverageReviewNumber,
  CloseIconModal,
  ReviewsFont,
  TotalReviewsFont,
} from "./QFundOwnerReviews-styles";
import { QFundOwnerReviewCard } from "./QFundOwnerReviewCard";
import { ReusableModal } from "../../modals/ReusableModal";
import { useDispatch, useSelector } from "react-redux";
import LazyLoad from "../../../components/common/LazyLoad";
import { RootState } from "../../../state/store";
import { AddReview } from "./AddReview/AddReview";
import { REVIEW_BASE } from "../../../constants";
import {
  OwnerReview,
  upsertReviews,
} from "../../../state/features/globalSlice";
import { AccountCircleSVG } from "../../../assets/svgs/AccountCircleSVG";

// Fetch 100 reviews from the crowdfund owner
// Average reviews from the crowdfund owner

interface QFundOwnerReviewsProps {
  QFundId: string;
  QFundOwner: string;
  QFundOwnerAvatar: string;
  QFundOwnerRegisteredNumber: number | null;
  averageOwnerRating: number | null;
  setOpenQFundOwnerReviews: (open: boolean) => void;
}

export const QFundOwnerReviews: FC<QFundOwnerReviewsProps> = ({
  QFundId,
  QFundOwner,
  QFundOwnerAvatar,
  QFundOwnerRegisteredNumber,
  averageOwnerRating,
  setOpenQFundOwnerReviews,
}) => {
  const theme = useTheme();
  const dispatch = useDispatch();

  const ownerReviews = useSelector(
    (state: RootState) => state.global.ownerReviews
  );

  const [openLeaveReview, setOpenLeaveReview] = useState<boolean>(false);
  const [loadingReviews, setLoadingReviews] = useState<boolean>(false);
  const [reviewIdentifier, setReviewIdentifier] = useState<string>("");

  // Fetch all the owner's reviews (regardless of the Q-Fund) resources from QDN
  const getQFundOwnerReviews = useCallback(async () => {
    if (!QFundId || !QFundOwner) return;
    try {
      setLoadingReviews(true);
      let ownerRegistrationNumber;
      if (QFundOwnerRegisteredNumber) {
        ownerRegistrationNumber = QFundOwnerRegisteredNumber;
      } else {
        throw new Error("No registered number found for QFund owner name");
      }

      const offset = ownerReviews.length;
      const shortQFundOwner = QFundOwner.slice(0, 15);
      // Those first three constants will remain the same no matter which crowdfund the owner made
      const query = `${REVIEW_BASE}-${shortQFundOwner}-${ownerRegistrationNumber}`;
      // Set the review identifier in the local state so we can filter only the reviews that are for the current Q-Fund
      setReviewIdentifier(query);
      // Since it the url includes /resources, you know you're fetching the resources and not the raw data
      const url = `/arbitrary/resources/search?service=DOCUMENT&query=${query}&limit=10&includemetadata=true&mode=LATEST&offset=${offset}&reverse=true`;
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });
      const responseData = await response.json();
      // Modify resource into data that is more easily used on the front end
      const structuredReviewData = responseData.map(
        (review: any): OwnerReview => {
          const splitIdentifier = review.identifier.split("-");
          return {
            id: review?.identifier,
            name: review?.name,
            created: review?.created,
            updated: review?.updated,
            title: review?.metadata?.title,
            description: review?.metadata?.description,
            rating: Number(splitIdentifier[splitIdentifier.length - 1]) / 10,
          };
        }
      );

      // Filter out duplicates by checking if the review id already exists in ownerReviews in global redux store
      const copiedOwnerReviews: OwnerReview[] = [...ownerReviews];

      structuredReviewData.forEach((review: OwnerReview) => {
        const index = ownerReviews.findIndex(
          (ownerReview: OwnerReview) => ownerReview.id === review.id
        );
        if (index !== -1) {
          copiedOwnerReviews[index] = review;
        } else {
          copiedOwnerReviews.push(review);
        }
      });

      dispatch(upsertReviews(copiedOwnerReviews));
    } catch (error) {
      console.error(error);
    } finally {
      setLoadingReviews(false);
    }
  }, [ownerReviews, QFundId, QFundOwner]);

  // Pass this function down to lazy loader
  const handleGetReviews = useCallback(async () => {
    await getQFundOwnerReviews();
  }, [getQFundOwnerReviews]);

  return (
    <>
      <HeaderRow>
        {QFundOwnerAvatar ? (
          <OwnerAvatar src={QFundOwnerAvatar} alt={`${QFundOwner}-logo`} />
        ) : (
          <AccountCircleSVG
            color={theme.palette.text.primary}
            width="90"
            height="90"
          />
        )}
        <OwnerNameCol style={{ gap: "10px" }}>
          <OwnerName>{QFundOwner}</OwnerName>
          <AddReviewButton onClick={() => setOpenLeaveReview(true)}>
            <StarSVG
              color={theme.palette.mode === "dark" ? "#000000" : "#ffffff"}
              height={"22"}
              width={"22"}
            />{" "}
            Add Review
          </AddReviewButton>
        </OwnerNameCol>
        <CloseIconModal
          onClickFunc={() => setOpenQFundOwnerReviews(false)}
          color={theme.palette.text.primary}
          height={"26"}
          width={"26"}
        />
      </HeaderRow>
      <Divider />
      <CardDetailsContainer>
        <Grid
          container
          direction={"row"}
          flexWrap={"nowrap"}
          rowGap={2}
          style={{ columnGap: "30px" }}
        >
          {averageOwnerRating && (
            <Grid item xs={12} sm={2} justifyContent={"center"}>
              <AverageReviewContainer>
                <ReviewsFont>Average Review</ReviewsFont>
                <AverageReviewNumber>
                  {averageOwnerRating || null}
                </AverageReviewNumber>
                <Rating
                  style={{ marginBottom: "8px" }}
                  precision={0.5}
                  value={averageOwnerRating || 0}
                  readOnly
                />
                <TotalReviewsFont>
                  {`${ownerReviews.length} review${
                    ownerReviews.length === 1 ? "" : "s"
                  }`}
                </TotalReviewsFont>
              </AverageReviewContainer>
            </Grid>
          )}
          <Grid
            item
            xs={12}
            sm={averageOwnerRating ? 10 : 12}
            style={{ position: "relative" }}
          >
            <OwnerReviewsContainer>
              {ownerReviews.length === 0 ? (
                <ReviewsFont>No reviews yet</ReviewsFont>
              ) : (
                ownerReviews
                  .filter((review: OwnerReview) => {
                    // Change and add filter here to remove owner's own reviews
                    return review.id.includes(reviewIdentifier);
                  })
                  .map((review: OwnerReview) => {
                    return <QFundOwnerReviewCard review={review} />;
                  })
              )}
            </OwnerReviewsContainer>
            <LazyLoad
              onLoadMore={handleGetReviews}
              isLoading={loadingReviews}
            ></LazyLoad>
          </Grid>
        </Grid>
      </CardDetailsContainer>
      <ReusableModal
        customStyles={{
          width: "96%",
          maxWidth: 700,
          height: "70%",
          backgroundColor:
            theme.palette.mode === "light" ? "#e8e8e8" : "#32333c",
          position: "relative",
          padding: "25px 40px",
          borderRadius: "5px",
          outline: "none",
          overflowY: "scroll",
        }}
        open={openLeaveReview}
      >
        <AddReview
          QFundId={QFundId}
          QFundOwner={QFundOwner}
          setOpenLeaveReview={setOpenLeaveReview}
        />
      </ReusableModal>
    </>
  );
};
