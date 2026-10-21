import type { Category, CategoryData } from "../../components/common/CategoryList/CategoryList.tsx";

/** "Other" sorts last, everything else alphabetically. */
export const sortCategory = (a: Category, b: Category) => {
  if (a.name === "Other") return 1;
  else if (b.name === "Other") return -1;
  else return a.name.localeCompare(b.name);
};

/** Every category, at any level, that has an icon. Pure so the data module can call it at load. */
export const collectCategoriesWithIcons = (data: CategoryData): Category[] => {
  const withIcons: Category[] = data.category.filter((c) => c.icon);
  for (const subCategories of data.subCategories) {
    for (const key in subCategories) {
      for (const c of subCategories[key]) if (c.icon) withIcons.push(c);
    }
  }
  return withIcons;
};
