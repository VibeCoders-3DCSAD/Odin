export interface CategoryGroup {
  id: string;
  slug: string;
  label: string;
  short_label: string | null;
  description: string;
  sort_order: number;
  is_active: boolean;
  metadata: Record<string, unknown>;
  categories?: Category[];
}

export interface Category {
  id: string;
  category_group_id: string;
  user_id: string | null;
  slug: string;
  label: string;
  short_label: string | null;
  description: string;
  is_system: boolean;
  is_filipino_context: boolean;
  sort_order: number;
  is_active: boolean;
  metadata: Record<string, unknown>;
  subcategories?: Subcategory[];
}

export interface Subcategory {
  id: string;
  category_id: string | null;
  user_id: string | null;
  slug: string;
  kind: "income" | "expense" | "transfer_adjustment";
  label: string;
  short_label: string | null;
  description: string;
  is_system: boolean;
  is_filipino_context: boolean;
  is_protected_default: boolean;
  is_protected: boolean;
  sort_order: number;
  is_active: boolean;
  metadata: Record<string, unknown>;
}
