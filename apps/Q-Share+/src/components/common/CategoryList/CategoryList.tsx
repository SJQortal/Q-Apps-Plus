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

import React, { forwardRef, useImperativeHandle, useState } from "react";
import { CategoryContainer } from "./CategoryList-styles.tsx";
import { allCategoryData } from "../../../constants/Categories/1stCategories.ts";

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

type ListDirection = "column" | "row";
interface CategoryListProps {
  sx?: SxProps<Theme>;
  categoryData: CategoryData;
  initialCategories?: string[];
  columns?: number;
}

export type CategoryListRef = {
  getSelectedCategories: () => string[];
  setSelectedCategories: (arr: string[]) => void;
  clearCategories: () => void;
  getCategoriesFetchString: () => string;
  categoriesToObject: () => object;
};

export const CategoryList = React.forwardRef<
  CategoryListRef,
  CategoryListProps
>(
  (
    { sx, categoryData, initialCategories, columns = 1 }: CategoryListProps,
    ref
  ) => {
    const categoriesLength = categoryData.subCategories.length + 1;

    let emptyCategories: string[] = [];
    for (let i = 0; i < categoriesLength; i++) emptyCategories.push("");

    const [selectedCategories, setSelectedCategories] = useState<string[]>(
      initialCategories || emptyCategories
    );

    const categoriesToObject = () => {
      let categoriesObject = {};
      selectedCategories.map((category, index) => {
        if (index === 0) categoriesObject["category"] = category;
        else if (index === 1) categoriesObject["subcategory"] = category;
        else categoriesObject[`subcategory${index}`] = category;
      });
      console.log("categoriesObject is: ", categoriesObject);
      return categoriesObject;
    };

    const clearCategories = () => {
      setSelectedCategories(emptyCategories);
    };

    useImperativeHandle(ref, () => ({
      getSelectedCategories: () => {
        return selectedCategories;
      },
      setSelectedCategories: categories => {
        console.log("setSelectedCategories: ", categories);
        //categories.map((category, index) => selectCategory(category, index));
        setSelectedCategories(categories);
      },
      clearCategories,
      getCategoriesFetchString: () =>
        getCategoriesFetchString(selectedCategories),
      categoriesToObject,
    }));

    const selectCategory = (optionId: string, index: number) => {
      const isMainCategory = index === 0;
      const subCategoryIndex = index - 1;

      const selectedOption = isMainCategory
        ? categoryData.category.find(option => option.id === +optionId)
        : categoryData.subCategories[subCategoryIndex][
            selectedCategories[subCategoryIndex]
          ].find(option => option.id === +optionId);

      const newSelectedCategories: string[] = selectedCategories.map(
        (category, categoryIndex) => {
          if (index > categoryIndex) return category;
          else if (index === categoryIndex) return selectedOption.id.toString();
          else return "";
        }
      );
      setSelectedCategories(newSelectedCategories);
    };

    const selectCategoryEvent = (event: SelectChangeEvent, index: number) => {
      const optionId = event.target.value;
      selectCategory(optionId, index);
    };

    const categorySelectSX = {
      // Target the input field
      ".MuiSelect-select": {
        fontSize: "16px", // Change font size for the selected value
        padding: "10px 5px 15px 15px;",
      },
      // Target the dropdown icon
      ".MuiSelect-icon": {
        fontSize: "20px", // Adjust if needed
      },
      // Target the dropdown menu
      "& .MuiMenu-paper": {
        ".MuiMenuItem-root": {
          fontSize: "14px", // Change font size for the menu items
        },
      },
    };

    const fillMenu = (category: Categories, index: number) => {
      const subCategoryIndex = selectedCategories[index];
      console.log("selected categories: ", selectedCategories);
      console.log("index is: ", index);
      console.log("subCategoryIndex is: ", subCategoryIndex);
      console.log("category is: ", category);
      console.log(
        "subCategoryIndex within category: ",
        selectedCategories[subCategoryIndex]
      );
      console.log("categoryData: ", categoryData);

      const menuToFill = category[subCategoryIndex];
      if (menuToFill)
        return menuToFill.map(option => (
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

    return (
      <CategoryContainer sx={{ width: "100%", ...sx }}>
        <FormControl sx={{ width: "100%" }}>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "repeat(" + columns + ", 1fr)",
              width: "100%",
              gap: "20px",
              alignItems: "center",
              marginTop: "30px",
            }}
          >
            <FormControl fullWidth sx={{ marginBottom: 1 }}>
              <InputLabel
                sx={{
                  fontSize: "16px",
                }}
                id="Category-1"
              >
                Category
              </InputLabel>
              <Select
                labelId="Category 1"
                input={<OutlinedInput label="Category 1" />}
                value={selectedCategories[0] || ""}
                onChange={e => {
                  selectCategoryEvent(e, 0);
                }}
                sx={categorySelectSX}
              >
                {categoryData.category.map(option => (
                  <MenuItem key={option.id} value={option.id}>
                    {option.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {categoryData.subCategories.map(
              (category, index) =>
                hasSubCategory(category, index) && (
                  <FormControl
                    fullWidth
                    sx={{
                      marginBottom: 1,
                    }}
                    key={selectedCategories[index] + index}
                  >
                    <InputLabel
                      sx={{
                        fontSize: "16px",
                      }}
                      id={`Category-${index + 2}`}
                    >
                      {`Category-${index + 2}`}
                    </InputLabel>
                    <Select
                      labelId={`Category ${index + 2}`}
                      input={<OutlinedInput label={`Category ${index + 2}`} />}
                      value={selectedCategories[index + 1] || ""}
                      onChange={e => {
                        selectCategoryEvent(e, index + 1);
                      }}
                      sx={{
                        width: "100%",
                        // Target the input field
                        ".MuiSelect-select": {
                          fontSize: "16px", // Change font size for the selected value
                          padding: "10px 5px 15px 15px;",
                        },
                        // Target the dropdown icon
                        ".MuiSelect-icon": {
                          fontSize: "20px", // Adjust if needed
                        },
                        // Target the dropdown menu
                        "& .MuiMenu-paper": {
                          ".MuiMenuItem-root": {
                            fontSize: "14px", // Change font size for the menu items
                          },
                        },
                      }}
                    >
                      {fillMenu(category, index)}
                    </Select>
                  </FormControl>
                )
            )}
          </Box>
        </FormControl>
      </CategoryContainer>
    );
  }
);

export const getCategoriesFetchString = (categories: string[]) => {
  let fetchString = "";
  categories.map((category, index) => {
    if (category) {
      if (index === 0) fetchString += `cat:${category}`;
      else if (index === 1) fetchString += `;sub:${category}`;
      else fetchString += `;sub${index}:${category}`;
    }
  });
  console.log("categoriesAsDescription: ", fetchString);
  return fetchString;
};

export const getCategoriesFromObject = (editFileProperties: any) => {
  const categoryList: string[] = [];
  const categoryCount = allCategoryData.subCategories.length + 1;

  for (let i = 0; i < categoryCount; i++) {
    if (i === 0 && editFileProperties.category)
      categoryList.push(editFileProperties.category);
    else if (i === 1 && editFileProperties.subcategory)
      categoryList.push(editFileProperties.subcategory);
    else categoryList.push(editFileProperties[`subcategory${i}`] || "");
  }
  return categoryList;
};
