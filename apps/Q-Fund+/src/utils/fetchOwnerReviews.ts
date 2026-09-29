import { checkStructureOwnerReviews } from "./checkStructure";

export const fetchAndEvaluateOwnerReviews = async (data: any) => {
  const getOwnerReviews = async () => {
    const { owner, reviewId, content } = data;
    let obj: any = {
      ...content,
      isValid: false
    };

    if (!owner || !reviewId) return obj;
    // Fetch review rawdata from QDN based on resource's location (need name, service type and identifier)
    try {
      const url = `/arbitrary/DOCUMENT/${owner}/${reviewId}`;
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json"
        }
      });

      const responseData = await response.json();
      if (checkStructureOwnerReviews(responseData)) {
        obj = {
          ...responseData,
          id: reviewId,
          isValid: true
        };
      }
      return obj;
    } catch (error) {
      console.error(error);
    }
  };

  const res = await getOwnerReviews();
  return res;
};
