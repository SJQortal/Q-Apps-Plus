import { FC, useState, useMemo } from "react";
import {
  AddReviewContainer,
  AddReviewDescription,
  AddReviewHeader,
} from "./AddReview-styles";
import { Rating } from "@mui/material";
import { CustomInputField } from "../../../Crowdfund/Crowdfund-styles";
import {
  CreateButton,
  CloseButton,
  CloseButtonRow,
  Divider,
  OwnerName,
} from "../QFundOwnerReviews-styles";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../../../../state/store";
import ShortUniqueId from "short-unique-id";
import { setNotification } from "../../../../state/features/notificationsSlice";
import { objectToBase64 } from "../../../../utils/toBase64";
import {
  addToHashMapOwnerReviews,
  addToReviews,
} from "../../../../state/features/globalSlice";
import { generateReviewId } from "../../../../utils/generateReviewId";

/* Reviews notes
  Prevent them from adding a review to their own store
  Filter their own review
  Make sure user has at least one store order before being able to leave a review
  Get first 100 reviews for the average (without metadata)
*/

interface AddReviewProps {
  QFundId: string;
  QFundOwner: string;
  setOpenLeaveReview: (open: boolean) => void;
}

export const AddReview: FC<AddReviewProps> = ({
  QFundId,
  QFundOwner,
  setOpenLeaveReview,
}) => {
  const dispatch = useDispatch();
  const username = useSelector((state: RootState) => state.auth?.user?.name);

  const [rating, setRating] = useState<number | null>(null);
  const [reviewTitle, setReviewTitle] = useState<string>("");
  const [reviewDescription, setReviewDescription] = useState<string>("");

  // Verify if review identifier already exists
  const verifyIfReviewIdExists = async (
    username: string,
    identifier: string
  ) => {
    try {
      const response = await qortalRequest({
        action: "LIST_QDN_RESOURCES",
        service: "DOCUMENT",
        name: username,
        identifier: identifier,
        includeMetadata: true,
        limit: 1,
      });
      if (response?.resources?.length > 0) {
        return true;
      }
      return false;
    } catch (err) {
      console.log(err);
      return false;
    }
  };

  // Add review to QDN
  const addReviewFunc = async () => {
    let ownerName = "";
    let reviewId = "";
    let errorMsg = "";
    let userName = "";
    let ownerRegistrationNumber;

    if (QFundOwner) {
      ownerName = QFundOwner;
    }

    if (username) {
      userName = username;
    }

    // Get person's name registration number

    try {
      const QFundOwnerRegistration = await qortalRequest({
        action: "GET_NAME_DATA",
        name: ownerName,
      });
      if (Object.keys(QFundOwnerRegistration).length > 0) {
        ownerRegistrationNumber = QFundOwnerRegistration.registered;
      }
    } catch (error) {
      console.error(error);
    }

    // Validation
    if (!ownerName) {
      errorMsg =
        "Cannot send a message without a access to the Q-Fund Owner's name!";
    }

    if (!userName) {
      errorMsg = "Cannot add a review without having a name!";
    }

    if (!QFundId) {
      errorMsg = "Cannot add a review without having a Q-Fund ID!";
    }

    if (!ownerRegistrationNumber) {
      errorMsg =
        "Cannot add a review without having a Q-Fund Owner's registration number!";
    }

    if (!rating || !reviewTitle || !reviewDescription) {
      errorMsg =
        "Cannot add a review without a rating, title, and description!";
    }

    if (errorMsg) {
      dispatch(
        setNotification({
          msg: errorMsg,
          alertType: "error",
        })
      );
      throw new Error(errorMsg);
    }

    if (QFundOwner && QFundId && ownerRegistrationNumber && rating) {
      // Create identifier for the review
      reviewId = generateReviewId(
        QFundOwner,
        QFundId,
        ownerRegistrationNumber,
        rating
      );
    }

    // Check if review identifier already exists
    const doesExist = await verifyIfReviewIdExists(userName, reviewId);
    if (doesExist) {
      throw new Error(
        "The review identifier already exists! Try changing your review's title"
      );
    }

    // Resource raw data
    const reviewObj = {
      title: reviewTitle,
      description: reviewDescription,
      rating: rating,
      created: Date.now(),
    };

    const reviewToBase64 = await objectToBase64(reviewObj);
    try {
      // Publish Review to QDN
      const resourceResponse = await qortalRequest({
        action: "PUBLISH_QDN_RESOURCE",
        name: userName,
        service: "DOCUMENT",
        identifier: reviewId,
        data64: reviewToBase64,
        filename: "review.json",
        // Resource metadata down here
        title: reviewTitle.slice(0, 60),
        description: reviewDescription.slice(0, 150),
      });
      setOpenLeaveReview(false);
      dispatch(
        addToReviews({
          id: reviewId,
          name: userName,
          created: Date.now(),
          updated: Date.now(),
          title: reviewTitle.slice(0, 60),
          description: reviewDescription.slice(0, 150),
          rating: rating,
        })
      );
      dispatch(
        addToHashMapOwnerReviews({
          id: reviewId,
          name: userName,
          created: Date.now(),
          updated: Date.now(),
          title: reviewTitle,
          description: reviewDescription,
          rating: rating,
          isValid: true,
        })
      );
      dispatch(
        setNotification({
          alertType: "success",
          msg: "Added Review Successfully!",
        })
      );
    } catch (error: any) {
      let notificationObj: any = null;
      if (typeof error === "string") {
        notificationObj = {
          msg: error || "Failed to create review",
          alertType: "error",
        };
      } else if (typeof error?.error === "string") {
        notificationObj = {
          msg: error?.error || "Failed to create review",
          alertType: "error",
        };
      } else {
        notificationObj = {
          msg: error?.message || "Failed to create review",
          alertType: "error",
        };
      }
      if (!notificationObj) return;
      dispatch(setNotification(notificationObj));
      if (error instanceof Error) {
        throw new Error(error.message);
      } else {
        throw new Error("An unknown error occurred");
      }
    }
  };

  return (
    <AddReviewContainer>
      <AddReviewHeader>
        <OwnerName>{`Leave a review for ${QFundOwner}`}</OwnerName>
      </AddReviewHeader>
      <Divider />
      <AddReviewContainer style={{ padding: 0 }}>
        <AddReviewContainer style={{ padding: 0, gap: "15px" }}>
          <Rating
            onChange={(
              e: React.ChangeEvent<object>,
              newValue: number | null
            ) => {
              setRating(newValue);
            }}
            precision={0.5}
            value={rating}
            style={{ fontSize: "55px", paddingTop: "5px" }}
          />
          <CustomInputField
            name="title"
            label="Q-Fund Owner Review Title"
            variant="filled"
            value={reviewTitle}
            onChange={e => setReviewTitle(e.target.value as string)}
            inputProps={{ maxLength: 180 }}
            required
            style={{ width: "100%" }}
          />
          <AddReviewDescription
            aria-label="review-description"
            draggable={false}
            minRows={3}
            maxRows={10}
            placeholder="Write a Q-Fund owner review..."
            value={reviewDescription}
            onChange={e => setReviewDescription(e.target.value as string)}
            required
          />
        </AddReviewContainer>
        <CloseButtonRow style={{ gap: "10px" }}>
          <CloseButton
            variant="outlined"
            color="error"
            onClick={() => {
              setOpenLeaveReview(false);
            }}
          >
            Close
          </CloseButton>
          <CreateButton variant="contained" onClick={addReviewFunc}>
            Add Review
          </CreateButton>
        </CloseButtonRow>
      </AddReviewContainer>
    </AddReviewContainer>
  );
};
