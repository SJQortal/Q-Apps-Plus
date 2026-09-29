import ShortUniqueId from "short-unique-id";
import { REVIEW_BASE } from "../constants";

export function generateReviewId(QFundOwner: string, QFundId: string, ownerRegistrationNumber: number, rating: number): string {
  const uid = new ShortUniqueId({ length: 10 });
  const uidGenerator = uid();
  const shortQFundOwner = QFundOwner.slice(0, 15);
  const shortQFundId = QFundId.slice(-12);
  // Change for production
  const reviewId = `${REVIEW_BASE}-${shortQFundOwner}-${ownerRegistrationNumber}-${uidGenerator}-${shortQFundId}-${Number(rating) * 10}`;
  return reviewId;
}