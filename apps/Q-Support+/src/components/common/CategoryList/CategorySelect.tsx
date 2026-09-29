import {
  FormControl,
  InputLabel,
  MenuItem,
  OutlinedInput,
  Select,
  SxProps,
  Theme,
} from "@mui/material";

import React, { useEffect, useImperativeHandle, useState } from "react";
import { CategoryContainer } from "./CategoryList-styles.tsx";
import { log } from "../../../constants/Misc.ts";

export interface Category {
  id: number;
  name: string;
  icon?: string;
  label?: string;
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
  categoryData: Category[];
  initialCategory?: string;
  afterChange?: (category: string) => void;
  showEmptyItem?: boolean;
}

export type CategorySelectRef = {
  getSelectedCategory: () => string;
  setSelectedCategory: (arr: string) => void;
  clearCategory: () => void;
  getCategoryFetchString: (categories?: string) => string;
};

export const CategorySelect = React.forwardRef<
  CategorySelectRef,
  CategoryListProps
>(
  (
    {
      sx,
      categoryData,
      initialCategory,
      afterChange,
      showEmptyItem = true,
    }: CategoryListProps,
    ref
  ) => {
    const [selectedCategory, setSelectedCategory] = useState<string>(
      initialCategory || ""
    );
    useEffect(() => {
      if (initialCategory) setSelectedCategory(initialCategory);
    }, [initialCategory]);

    const updateCategory = (category: string) => {
      if (log) console.log("updateCategory ID: ", category);
      setSelectedCategory(category);
      if (afterChange) afterChange(category);
    };
    const categoryToObject = (category: string) => {
      let categoryObject = {};
      categoryObject["category"] = category;
      if (log) console.log("categoryObject is: ", categoryObject);
      return categoryObject;
    };

    const clearCategory = () => {
      updateCategory("");
    };

    useImperativeHandle(ref, () => ({
      getSelectedCategory: () => {
        return selectedCategory;
      },
      setSelectedCategory: category => {
        if (log) console.log("setSelectedCategory: ", category);
        updateCategory(category);
      },
      clearCategory,
      getCategoryFetchString: (category?: string) =>
        getCategoryFetchString(category || selectedCategory),
      categoriesToObject: (category?: string) =>
        categoryToObject(category || selectedCategory),
    }));

    const categorySelectSX = {
      // // Target the input field
      // ".MuiSelect-select": {
      //   fontSize: "16px", // Change font size for the selected value
      //   padding: "10px 5px 15px 15px;",
      // },
      // // Target the dropdown icon
      // ".MuiSelect-icon": {
      //   fontSize: "20px", // Adjust if needed
      // },
      // // Target the dropdown menu
      // "& .MuiMenu-paper": {
      //   ".MuiMenuItem-root": {
      //     fontSize: "14px", // Change font size for the menu items
      //   },
      // },
    };

    const emptyMenuItem = (
      <MenuItem
        key={""}
        value={""}
        // sx={{
        //   "& .MuiButtonBase-root-MuiMenuItem-root": {
        //     minHeight: "50px",
        //   },
        sx={{
          "@media (min-width: 600px)": { minHeight: "46.5px" },
        }}
      />
    );

    const fillMenu = () => {
      const menuItems = [];
      if (showEmptyItem) menuItems.push(emptyMenuItem);

      categoryData.map(option =>
        menuItems.push(
          <MenuItem key={option.id} value={option.id}>
            {option.name}
          </MenuItem>
        )
      );
      return menuItems;
    };
    return (
      <CategoryContainer sx={{ width: "100%", ...sx }}>
        <FormControl fullWidth sx={{ marginBottom: 1 }}>
          <InputLabel
            sx={{
              fontSize: "24px",
            }}
            id="Category-1"
          >
            {categoryData[0]?.label || "Category"}
          </InputLabel>
          <Select
            labelId="Category 1"
            input={<OutlinedInput label="Category 1" />}
            value={selectedCategory || ""}
            onChange={e => {
              updateCategory(e.target.value);
            }}
          >
            {fillMenu()}
          </Select>
        </FormControl>
      </CategoryContainer>
    );
  }
);

export const getCategoryFetchString = (category: string) => {
  return `cat:${category}`;
};

export const getCategoryFromObject = (editFileProperties: any) => {
  const categoryList: string[] = [];
  if (editFileProperties.category)
    categoryList.push(editFileProperties.category);
  return categoryList;
};
