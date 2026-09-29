import { FC, useState, useCallback, useEffect } from "react";
import { CircularProgress, Grid, Rating, useTheme } from "@mui/material";
import {
  CardDetailsContainer,
  Divider,
  HeaderRow,
  StoreLogo,
  StoreTitle
} from "../StoreDetails/StoreDetails-styles";
import { StoreTitleCol } from "../Store/Store-styles";
import { StarSVG } from "../../../assets/svgs/StarSVG";
import {
  AddReviewButton,
  AverageReviewContainer,
  AverageReviewNumber,
  CloseIconModal,
  ReviewsFont,
  StoreReviewsContainer,
  TotalReviewsFont
} from "./StoreReviews-styles";
import { StoreReviewCard } from "./StoreReviewCard";
import { ReusableModal } from "../../../components/modals/ReusableModal";
import { AddReview } from "./AddReview/AddReview";
import { useDispatch, useSelector } from "react-redux";
import LazyLoad from "../../../components/common/LazyLoad";
import { StoreReview, upsertReviews } from "../../../state/features/storeSlice";
import { RootState } from "../../../state/store";
import {
  ORDER_BASE,
  REVIEW_BASE,
  STORE_BASE
} from "../../../constants/identifiers";

interface StoreReviewsProps {
  storeId: string;
  storeTitle: string;
  storeImage: string;
  averageStoreRating: number | null;
  setOpenStoreReviews: (open: boolean) => void;
}

export const StoreReviews: FC<StoreReviewsProps> = ({
  storeId,
  storeTitle,
  storeImage,
  averageStoreRating,
  setOpenStoreReviews
}) => {
  const theme = useTheme();
  const dispatch = useDispatch();
  const storeReviews = useSelector(
    (state: RootState) => state.store.storeReviews
  );
  const storeOwner = useSelector((state: RootState) => state.store.storeOwner);
  const user = useSelector((state: RootState) => state.auth.user);

  const [openLeaveReview, setOpenLeaveReview] = useState<boolean>(false);
  const [userHasStoreOrder, setUserHasStoreOrder] = useState<boolean>(false);
  const [hasFetched, setHasFetched] = useState<boolean>(false);

  // Determine whether user can leave a review
  const doesUserHaveOrderFunc = async () => {
    if (!user?.name) return;
    const parts = storeId.split(`${STORE_BASE}-`);
    const shortStoreId = parts[1];

    try {
      const query = `${ORDER_BASE}-${shortStoreId}`;
      const url = `/arbitrary/resources/search?service=DOCUMENT_PRIVATE&name=${user?.name}&exactmatchnames=true&query=${query}&limit=1&includemetadata=false&mode=ALL&reverse=true`;
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json"
        }
      });
      const responseData = await response.json();
      if (responseData.length > 0) {
        setUserHasStoreOrder(true);
        return;
      }
    } catch (error) {
      console.error(error);
    }
  };

  // Fetch all the store review resources from QDN
  const getStoreReviews = useCallback(async () => {
    if (!storeId) return;
    try {
      const offset = storeReviews.length;
      const parts = storeId.split(`${STORE_BASE}-`);
      const shortStoreId = parts[1];
      const query = `${REVIEW_BASE}-${shortStoreId}`;
      // Since it the url includes /resources, you know you're fetching the resources and not the raw data
      const url = `/arbitrary/resources/search?service=DOCUMENT&query=${query}&limit=10&includemetadata=true&mode=ALL&offset=${offset}&reverse=true`;
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json"
        }
      });
      const responseData = await response.json();
      // Modify resource into data that is more easily used on the front end
      const structuredReviewData = responseData.map(
        (review: any): StoreReview | null => {
          const splitIdentifier = review.identifier.split("-");
          // Return null if idenfier is not an exact match, because search is not case sensitive
          const prefixIdentifier = splitIdentifier.slice(0, splitIdentifier.length - 2).join("-");
          if (query !== prefixIdentifier) return null;
          return {
            id: review?.identifier,
            name: review?.name,
            created: review?.created,
            updated: review?.updated,
            title: review?.metadata?.title,
            description: review?.metadata?.description,
            rating: Number(splitIdentifier[splitIdentifier.length - 1]) / 10
          };
        }
        ).filter((review: StoreReview | null) => review !== null); // Filter out null entries
      setHasFetched(true);

      // Filter out duplicates by checking if the review id already exists in storeReviews in global redux store
      const copiedStoreReviews: StoreReview[] = [...storeReviews];

      structuredReviewData.forEach((review: StoreReview) => {
        const index = storeReviews.findIndex(
          (storeReview: StoreReview) => storeReview.id === review.id
        );
        if (index !== -1) {
          copiedStoreReviews[index] = review;
        } else {
          copiedStoreReviews.push(review);
        }
      });

      dispatch(upsertReviews(copiedStoreReviews));
    } catch (error) {
      console.error(error);
    }
  }, [storeReviews, storeId]);

  // Pass this function down to lazy loader
  const handleGetReviews = useCallback(async () => {
    await getStoreReviews();
  }, [getStoreReviews]);

  useEffect(() => {
    if (user?.name) {
      doesUserHaveOrderFunc();
    }
  }, [user]);
  return (
    <>
      <HeaderRow>
        <StoreLogo src={storeImage} alt={`${storeTitle}-logo`} />
        <StoreTitleCol style={{ gap: "10px" }}>
          <StoreTitle>{storeTitle}</StoreTitle>
          {userHasStoreOrder ? (
            <AddReviewButton onClick={() => setOpenLeaveReview(true)}>
              <StarSVG
                color={theme.palette.mode === "dark" ? "#000000" : "#ffffff"}
                height={"22"}
                width={"22"}
              />{" "}
              Add Review
            </AddReviewButton>
          ) : (
            <ReviewsFont>
              You must have an order with this shop before being able to leave a
              review
            </ReviewsFont>
          )}
        </StoreTitleCol>
        <CloseIconModal
          onClickFunc={() => setOpenStoreReviews(false)}
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
          {averageStoreRating && (
            <Grid item xs={12} sm={2} justifyContent={"center"}>
              <AverageReviewContainer>
                <ReviewsFont>Average Review</ReviewsFont>
                <AverageReviewNumber>
                  {averageStoreRating || null}
                </AverageReviewNumber>
                <Rating
                  style={{ marginBottom: "8px" }}
                  precision={0.5}
                  value={averageStoreRating || 0}
                  readOnly
                />
                <TotalReviewsFont>{`${storeReviews.length} review${
                  storeReviews.length === 1 ? "" : "s"
                }`}</TotalReviewsFont>
              </AverageReviewContainer>
            </Grid>
          )}
          <Grid
            item
            xs={12}
            sm={averageStoreRating ? 10 : 12}
            style={{ position: "relative" }}
          >
            <StoreReviewsContainer>
              {storeReviews.length === 0 && hasFetched ? (
                <ReviewsFont>No reviews yet</ReviewsFont>
              ) : (
                storeReviews
                  .filter((review: StoreReview) => {
                    return review.name !== storeOwner;
                  })
                  .map((review: StoreReview) => {
                    return <StoreReviewCard review={review} />;
                  })
              )}
            </StoreReviewsContainer>
            <LazyLoad onLoadMore={handleGetReviews}></LazyLoad>
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
          overflowY: "scroll"
        }}
        open={openLeaveReview}
      >
        <AddReview
          storeId={storeId}
          storeTitle={storeTitle}
          setOpenLeaveReview={setOpenLeaveReview}
        />
      </ReusableModal>
    </>
  );
};
