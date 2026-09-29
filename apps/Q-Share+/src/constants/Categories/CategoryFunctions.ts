import {
  Category,
  getCategoriesFromObject,
} from "../../components/common/CategoryList/CategoryList.tsx";
import { allCategoryData, iconCategories } from "./1stCategories.ts";

export const sortCategory = (a: Category, b: Category) => {
  if (a.name === "Other") return 1;
  else if (b.name === "Other") return -1;
  else return a.name.localeCompare(b.name);
};
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

export const getAllCategoriesWithIcons = () => {
  const categoriesWithIcons: Category[] = [];

  allCategoryData.category.map(category => {
    if (category.icon) categoriesWithIcons.push(category);
  });
  const subCategoriesList = allCategoryData.subCategories;

  for (const subCategories of subCategoriesList) {
    for (const subCategoryID in subCategories) {
      const categoryWithIcon = subCategories[subCategoryID].map(categoryObj => {
        if (categoryObj.icon) categoriesWithIcons.push(categoryObj);
      });
    }
  }
  return categoriesWithIcons;
};

export const getIconsFromObject = (fileObj: any) => {
  const categories = getCategoriesFromObject(fileObj);
  const icons = categories
    .map(categoryID => {
      return iconCategories.find(category => category.id === +categoryID)?.icon;
    })
    .reverse();

  return icons.find(icon => icon !== undefined);
};
