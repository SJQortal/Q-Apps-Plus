import {
  Category,
  getCategoriesFromObject,
} from "../../components/common/CategoryList/CategoryList.tsx";
import { allCategoryData } from "../../constants/Categories/Categories.ts";
import {
  getIconsFromObject,
  getnamesFromObject,
} from "../../constants/Categories/CategoryFunctions.ts";
import { getAvatarFromName } from "../../utils/qortalRequests.ts";
export const getIconsAndLabels = async issueData => {
  if (issueData) {
    const tempIcons = getIconsFromObject(issueData);
    const tempIconLabels = getnamesFromObject(issueData);

    const QappName = issueData?.QappName;
    if (QappName) {
      const QappIcon = await getAvatarFromName(QappName);
      tempIcons.push(QappIcon);
      tempIconLabels.push(QappName);
    }
    return [tempIcons, tempIconLabels];
  }
};

export const categoryNamesToString = (
  categoryNames: string[],
  QappName: string
) => {
  const filteredCategoryNames = categoryNames.filter(name => name);
  let categoryDisplay = "";
  const separator = " > ";

  filteredCategoryNames.map((name, index) => {
    if (QappName && index === 1) {
      categoryDisplay += QappName + separator;
    }
    categoryDisplay += name;

    if (index !== filteredCategoryNames.length - 1)
      categoryDisplay += separator;
  });
  return categoryDisplay;
};

export const getCategoryNames = issueData => {
  const categoryList = getCategoriesFromObject(issueData);
  return categoryList.map((categoryID, index) => {
    let categoryName: Category;
    if (index === 0) {
      categoryName = allCategoryData.category.find(
        item => item?.id === +categoryList[0]
      );
    } else {
      const subCategories = allCategoryData.subCategories[index - 1];
      const selectedSubCategory = subCategories[categoryList[index - 1]];
      if (selectedSubCategory) {
        categoryName = selectedSubCategory.find(
          item => item?.id === +categoryList[index]
        );
      }
    }
    return categoryName?.name;
  });
};
