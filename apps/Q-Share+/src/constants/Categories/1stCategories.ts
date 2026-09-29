import audioIcon from "../../assets/icons/audio.webp";
import bookIcon from "../../assets/icons/book.webp";
import documentIcon from "../../assets/icons/document.webp";
import gamingIcon from "../../assets/icons/gaming.webp";
import imageIcon from "../../assets/icons/image.webp";
import softwareIcon from "../../assets/icons/software.webp";
import unknownIcon from "../../assets/icons/unknown.webp";
import videoIcon from "../../assets/icons/video.webp";

import {
  audioSubCategories,
  bookSubCategories,
  documentSubCategories,
  imageSubCategories,
  softwareSubCategories,
  videoSubCategories,
} from "./2ndCategories.ts";
import { musicSubCategories } from "./3rdCategories.ts";
import {
  Categories,
  Category,
  CategoryData,
} from "../../components/common/CategoryList/CategoryList.tsx";
import {
  getAllCategoriesWithIcons,
  sortCategory,
} from "./CategoryFunctions.ts";

export const firstCategories: Category[] = [
  { id: 1, name: "Software", icon: softwareIcon },
  { id: 2, name: "Gaming", icon: gamingIcon },
  { id: 3, name: "Audio", icon: audioIcon },
  { id: 4, name: "Video", icon: videoIcon },
  { id: 5, name: "Image", icon: imageIcon },
  { id: 6, name: "Document", icon: documentIcon },
  { id: 7, name: "Book", icon: bookIcon },
  { id: 99, name: "Other", icon: unknownIcon },
].sort(sortCategory);
export const secondCategories: Categories = {
  1: softwareSubCategories.sort(sortCategory),
  3: audioSubCategories.sort(sortCategory),
  4: videoSubCategories.sort(sortCategory),
  5: imageSubCategories.sort(sortCategory),
  6: documentSubCategories.sort(sortCategory),
  7: bookSubCategories.sort(sortCategory),
};

export const thirdCategories: Categories = {
  301: musicSubCategories,
};

export const allCategoryData: CategoryData = {
  category: firstCategories,
  subCategories: [secondCategories, thirdCategories],
};

export const iconCategories = getAllCategoriesWithIcons();
