import type {
  CategoryGroup as RepoCategoryGroup,
  Category as RepoCategory,
  Subcategory as RepoSubcategory,
} from "../../local-db/repositories/taxonomy";

export type CategoryGroup = RepoCategoryGroup & { categories?: Category[] };
export type Category = RepoCategory & { subcategories?: RepoSubcategory[] };
export type Subcategory = RepoSubcategory;
