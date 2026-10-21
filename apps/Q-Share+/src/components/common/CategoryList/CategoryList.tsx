import {
  Box,
  FormControl,
  InputLabel,
  MenuItem,
  OutlinedInput,
  Select,
  SelectChangeEvent,
  SxProps,
  Theme,
} from "@mui/material";

import React, { useEffect, useId, useImperativeHandle, useState } from "react";
import { CategoryContainer } from "./CategoryList-styles.tsx";
import { allCategoryData } from "../../../constants/Categories/1stCategories.ts";
import type { CategoriesObject } from "../../../utils/publishPayload";

export interface Category {
  id: number;
  name: string;
  icon?: string;
}

export interface Categories {
  [key: number]: Category[];
}
export interface CategoryData {
  category: Category[];
  subCategories: Categories[];
}

interface CategoryListProps {
  sx?: SxProps<Theme>;
  categoryData: CategoryData;
  initialCategories?: string[];
  columns?: number;
  /** Small inputs and tight spacing, for the filter rail. */
  dense?: boolean;
}

export type CategoryListRef = {
  getSelectedCategories: () => string[];
  setSelectedCategories: (arr: string[]) => void;
  clearCategories: () => void;
  getCategoriesFetchString: () => string;
  categoriesToObject: () => CategoriesObject;
};

/** Visible labels per level; the ids and stored values stay numeric. */
const LEVEL_LABELS = ["Category", "Subcategory", "Sub-subcategory"];
const levelLabel = (level: number) => LEVEL_LABELS[level] ?? `Level ${level + 1}`;

export const CategoryList = React.forwardRef<CategoryListRef, CategoryListProps>(
  ({ sx, categoryData, initialCategories, columns = 1, dense = false }: CategoryListProps, ref) => {
    const categoriesLength = categoryData.subCategories.length + 1;
    const idPrefix = useId();

    const emptyCategories: string[] = [];
    for (let i = 0; i < categoriesLength; i++) emptyCategories.push("");

    const [selectedCategories, setSelectedCategories] = useState<string[]>(initialCategories || emptyCategories);

    // A parent that loads the share to edit after mounting hands the ids in late.
    const initialKey = initialCategories ? initialCategories.join("|") : null;
    useEffect(() => {
      if (initialKey !== null) setSelectedCategories(initialKey.split("|"));
    }, [initialKey]);

    const categoriesToObject = () => {
      const categoriesObject = {};
      selectedCategories.forEach((category, index) => {
        if (index === 0) categoriesObject["category"] = category;
        else if (index === 1) categoriesObject["subcategory"] = category;
        else categoriesObject[`subcategory${index}`] = category;
      });
      return categoriesObject;
    };

    const clearCategories = () => {
      setSelectedCategories(emptyCategories);
    };

    useImperativeHandle(ref, () => ({
      getSelectedCategories: () => {
        return selectedCategories;
      },
      setSelectedCategories: (categories) => {
        setSelectedCategories(categories);
      },
      clearCategories,
      getCategoriesFetchString: () => getCategoriesFetchString(selectedCategories),
      categoriesToObject,
    }));

    const selectCategory = (optionId: string, index: number) => {
      const isMainCategory = index === 0;
      const subCategoryIndex = index - 1;

      const selectedOption = isMainCategory
        ? categoryData.category.find((option) => option.id === +optionId)
        : categoryData.subCategories[subCategoryIndex][selectedCategories[subCategoryIndex]].find(
            (option) => option.id === +optionId
          );
      if (!selectedOption) return;

      const newSelectedCategories: string[] = selectedCategories.map((category, categoryIndex) => {
        if (index > categoryIndex) return category;
        else if (index === categoryIndex) return selectedOption.id.toString();
        else return "";
      });
      setSelectedCategories(newSelectedCategories);
    };

    const selectCategoryEvent = (event: SelectChangeEvent, index: number) => {
      const optionId = event.target.value;
      selectCategory(optionId, index);
    };

    const fillMenu = (category: Categories, index: number) => {
      const subCategoryIndex = selectedCategories[index];

      const menuToFill = category[subCategoryIndex];
      if (menuToFill)
        return menuToFill.map((option) => (
          <MenuItem key={option.id} value={option.id}>
            {option.name}
          </MenuItem>
        ));
    };

    const hasSubCategory = (category: Categories, index: number) => {
      const subCategoryIndex = selectedCategories[index];
      const subCategory = category[subCategoryIndex];
      return subCategory && subCategoryIndex;
    };

    const size = dense ? "small" : "medium";
    const mainLabelId = `${idPrefix}-level-0`;

    return (
      <CategoryContainer sx={{ width: "100%", ...sx }}>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "1fr",
              sm: columns > 1 ? "repeat(auto-fit, minmax(180px, 1fr))" : "1fr",
            },
            width: "100%",
            gap: dense ? "12px" : "16px",
            alignItems: "center",
          }}
        >
          <FormControl fullWidth size={size}>
            <InputLabel id={mainLabelId}>{levelLabel(0)}</InputLabel>
            <Select
              labelId={mainLabelId}
              input={<OutlinedInput label={levelLabel(0)} />}
              value={selectedCategories[0] || ""}
              onChange={(e) => {
                selectCategoryEvent(e, 0);
              }}
            >
              {categoryData.category.map((option) => (
                <MenuItem key={option.id} value={option.id}>
                  {option.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {categoryData.subCategories.map((category, index) => {
            if (!hasSubCategory(category, index)) return null;
            const labelId = `${idPrefix}-level-${index + 1}`;
            return (
              <FormControl fullWidth size={size} key={selectedCategories[index] + index}>
                <InputLabel id={labelId}>{levelLabel(index + 1)}</InputLabel>
                <Select
                  labelId={labelId}
                  input={<OutlinedInput label={levelLabel(index + 1)} />}
                  value={selectedCategories[index + 1] || ""}
                  onChange={(e) => {
                    selectCategoryEvent(e, index + 1);
                  }}
                  sx={{ width: "100%" }}
                >
                  {fillMenu(category, index)}
                </Select>
              </FormControl>
            );
          })}
        </Box>
      </CategoryContainer>
    );
  }
);

export const getCategoriesFetchString = (categories: string[]) => {
  let fetchString = "";
  categories.forEach((category, index) => {
    if (category) {
      if (index === 0) fetchString += `cat:${category}`;
      else if (index === 1) fetchString += `;sub:${category}`;
      else fetchString += `;sub${index}:${category}`;
    }
  });
  return fetchString;
};

export const getCategoriesFromObject = (editFileProperties: any) => {
  const categoryList: string[] = [];
  const categoryCount = allCategoryData.subCategories.length + 1;

  for (let i = 0; i < categoryCount; i++) {
    if (i === 0 && editFileProperties.category) categoryList.push(editFileProperties.category);
    else if (i === 1 && editFileProperties.subcategory) categoryList.push(editFileProperties.subcategory);
    else categoryList.push(editFileProperties[`subcategory${i}`] || "");
  }
  return categoryList;
};
