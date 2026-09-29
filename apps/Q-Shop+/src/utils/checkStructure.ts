// check the structure of products
export const checkStructure = (content: any) => {
  let isValid = true;
  if (!content?.title) isValid = false;
  if (!content?.created) isValid = false;
  if (!content?.description) isValid = false;
  if (!content?.type) isValid = false;
  if (!Array.isArray(content?.images)) isValid = false;
  if (!Array.isArray(content?.price)) isValid = false;

  return isValid;
};

export const checkStructureOrders = (content: any) => {
  let isValid = true;
  if (!content?.delivery) isValid = false;
  if (!content?.created) isValid = false;
  if (!content?.details) isValid = false;
  if (!content?.payment) isValid = false;
  if (!Array.isArray(content?.communicationMethod)) isValid = false;

  return isValid;
};

export const checkStructureMailMessages = (content: any) => {
  let isValid = true;
  if (!content?.title) isValid = false;
  if (!content?.description) isValid = false;
  if (!content?.createdAt) isValid = false;
  if (!content?.version) isValid = false;
  if (!Array.isArray(content?.attachments)) isValid = false;
  if (!Array.isArray(content?.textContent)) isValid = false;
  if (typeof content?.generalData !== "object") isValid = false;

  return isValid;
};

// check the structure of stores
export const checkStructureStore = (content: any) => {
  let isValid = true;
  if (!content?.title) isValid = false;
  if (!content?.created) isValid = false;
  if (!content?.description) isValid = false;
  if (!content?.shipsTo) isValid = false;
  if (!content?.shortStoreId) isValid = false;
  return isValid;
};

export const checkStructureStoreReviews = (content: any) => {
  let isValid = true;
  if (!content?.title) isValid = false;
  if (!content?.created) isValid = false;
  if (!content?.description) isValid = false;
  if (!content?.rating) isValid = false;

  return isValid;
};
