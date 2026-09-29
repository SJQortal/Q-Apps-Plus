export const checkStructure = (content: any) => {
  const isValid = true

  return isValid
}

export const checkStructureOwnerReviews = (content: any) => {
  let isValid = true;
  if (!content?.title) isValid = false;
  if (!content?.created) isValid = false;
  if (!content?.description) isValid = false;
  if (!content?.rating) isValid = false;

  return isValid;
};



