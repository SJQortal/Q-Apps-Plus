import {
  Category,
  getCategoriesFromObject,
} from "../../components/common/CategoryList/CategoryList.tsx";
import { allCategoryData, iconCategories } from "./1stCategories.ts";

import { collectCategoriesWithIcons, sortCategory } from "./categoryUtils.ts";

export { sortCategory };
type Direction = "forward" | "backward";
const findCategory = (categoryID: number) => {
  return allCategoryData.category.find(category => {
    return category.id === categoryID;
  });
};
const findSubCategory = (
  categoryID: number,
  direction: Direction = "forward"
) => {
  const subCategoriesList = allCategoryData.subCategories;
  if (direction === "backward") subCategoriesList.reverse();

  for (const subCategories of subCategoriesList) {
    for (const subCategoryID in subCategories) {
      const returnValue = subCategories[subCategoryID].find(categoryObj => {
        return categoryObj.id === categoryID;
      });
      if (returnValue) return returnValue;
    }
  }
};
export const findCategoryData = (
  categoryID: number,
  direction: Direction = "forward"
) => {
  return direction === "forward"
    ? findCategory(categoryID) || findSubCategory(categoryID, "forward")
    : findSubCategory(categoryID, "backward") || findCategory(categoryID);
};
export const findAllCategoryData = (
  categories: string[],
  direction: Direction = "forward"
) => {
  let foundIcons: Category[] = [];
  if (direction === "backward") categories.reverse();

  categories.map(category => {
    if (category) {
      const icon = findCategoryData(+category, "backward");
      if (icon) foundIcons.push(icon);
    }
  });
  return foundIcons;
};

export const getCategoriesWithIcons = (categories: Category[]) => {
  return categories.filter(category => {
    return category.icon;
  });
};

export const getAllCategoriesWithIcons = () => collectCategoriesWithIcons(allCategoryData);

export const getIconsFromObject = (fileObj: any) => {
  const categories = getCategoriesFromObject(fileObj);
  const icons = categories
    .map(categoryID => {
      return iconCategories.find(category => category.id === +categoryID)?.icon;
    })
    .reverse();

  return icons.find(icon => icon !== undefined);
};
