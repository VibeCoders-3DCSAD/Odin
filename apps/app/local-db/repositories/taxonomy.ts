import * as SQLite from "expo-sqlite";
import { initDatabase } from "../client";
import { enqueueOperation, LocalDbError } from "../helpers";
import type { SyncOperation } from "../types";

type CategoryGroupRow = {
  id: string;
  user_id: string;
  slug: string;
  label: string;
  short_label: string | null;
  description: string;
  sort_order: number;
  is_active: number;
  metadata: string;
  version: number;
  deleted: number;
  created_at: string;
  updated_at: string;
  last_synced_at: string | null;
};

type CategoryRow = {
  id: string;
  user_id: string;
  category_group_id: string;
  slug: string;
  label: string;
  short_label: string | null;
  description: string;
  is_system: number;
  is_filipino_context: number;
  sort_order: number;
  is_active: number;
  metadata: string;
  version: number;
  deleted: number;
  created_at: string;
  updated_at: string;
  last_synced_at: string | null;
};

type SubcategoryRow = {
  id: string;
  user_id: string;
  category_id: string | null;
  slug: string;
  kind: "income" | "expense" | "transfer_adjustment";
  label: string;
  short_label: string | null;
  description: string;
  is_system: number;
  is_filipino_context: number;
  is_protected: number;
  sort_order: number;
  is_active: number;
  metadata: string;
  version: number;
  deleted: number;
  created_at: string;
  updated_at: string;
  last_synced_at: string | null;
};

export type CategoryGroup = {
  id: string;
  slug: string;
  label: string;
  short_label: string | null;
  description: string;
  sort_order: number;
  is_active: boolean;
};

export type Category = {
  id: string;
  category_group_id: string;
  slug: string;
  label: string;
  short_label: string | null;
  description: string;
  is_system: boolean;
  is_filipino_context: boolean;
  sort_order: number;
  is_active: boolean;
};

export type Subcategory = {
  id: string;
  category_id: string | null;
  slug: string;
  kind: "income" | "expense" | "transfer_adjustment";
  label: string;
  short_label: string | null;
  description: string;
  is_system: boolean;
  is_filipino_context: boolean;
  is_protected: boolean;
  sort_order: number;
  is_active: boolean;
};

export type CreateCategoryInput = {
  category_group_id: string;
  slug: string;
  label: string;
  description: string;
  short_label?: string | null;
  is_filipino_context?: boolean;
  sort_order?: number;
};

export type UpdateCategoryInput = {
  label?: string;
  short_label?: string | null;
  description?: string;
  is_filipino_context?: boolean;
  sort_order?: number;
  is_active?: boolean;
};

export type CreateSubcategoryInput = {
  kind: "income" | "expense" | "transfer_adjustment";
  slug: string;
  label: string;
  description: string;
  category_id?: string | null;
  short_label?: string | null;
  is_filipino_context?: boolean;
  is_protected?: boolean;
  sort_order?: number;
};

export type UpdateSubcategoryInput = {
  label?: string;
  short_label?: string | null;
  description?: string;
  is_filipino_context?: boolean;
  is_protected?: boolean;
  is_active?: boolean;
};

function mapCategoryGroup(row: CategoryGroupRow): CategoryGroup {
  return {
    id: row.id,
    slug: row.slug,
    label: row.label,
    short_label: row.short_label,
    description: row.description,
    sort_order: row.sort_order,
    is_active: row.is_active === 1,
  };
}

function mapCategory(row: CategoryRow): Category {
  return {
    id: row.id,
    category_group_id: row.category_group_id,
    slug: row.slug,
    label: row.label,
    short_label: row.short_label,
    description: row.description,
    is_system: row.is_system === 1,
    is_filipino_context: row.is_filipino_context === 1,
    sort_order: row.sort_order,
    is_active: row.is_active === 1,
  };
}

function mapSubcategory(row: SubcategoryRow): Subcategory {
  return {
    id: row.id,
    category_id: row.category_id,
    slug: row.slug,
    kind: row.kind,
    label: row.label,
    short_label: row.short_label,
    description: row.description,
    is_system: row.is_system === 1,
    is_filipino_context: row.is_filipino_context === 1,
    is_protected: row.is_protected === 1,
    sort_order: row.sort_order,
    is_active: row.is_active === 1,
  };
}

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) dbPromise = initDatabase();
  return dbPromise;
}

function boolToInt(v: boolean | undefined | null): number {
  return v ? 1 : 0;
}

function now(): string {
  return new Date().toISOString();
}

export async function listCategoryGroups(userId: string): Promise<CategoryGroup[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<CategoryGroupRow>(
    "SELECT * FROM category_groups WHERE user_id = ? AND deleted = 0 AND is_active = 1 ORDER BY sort_order",
    userId,
  );
  return rows.map(mapCategoryGroup);
}

export async function listCategories(
  userId: string,
  categoryGroupId?: string,
): Promise<Category[]> {
  const db = await getDb();
  if (categoryGroupId) {
    const rows = await db.getAllAsync<CategoryRow>(
      "SELECT * FROM categories WHERE user_id = ? AND deleted = 0 AND is_active = 1 AND category_group_id = ? ORDER BY sort_order",
      userId,
      categoryGroupId,
    );
    return rows.map(mapCategory);
  }
  const rows = await db.getAllAsync<CategoryRow>(
    "SELECT * FROM categories WHERE user_id = ? AND deleted = 0 AND is_active = 1 ORDER BY sort_order",
    userId,
  );
  return rows.map(mapCategory);
}

export async function getCategory(userId: string, id: string): Promise<Category | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<CategoryRow>(
    "SELECT * FROM categories WHERE user_id = ? AND id = ? AND deleted = 0",
    userId,
    id,
  );
  return row ? mapCategory(row) : null;
}

export async function listSubcategories(
  userId: string,
  categoryId?: string,
  kind?: "income" | "expense" | "transfer_adjustment",
): Promise<Subcategory[]> {
  const db = await getDb();
  let sql = "SELECT * FROM subcategories WHERE user_id = ? AND deleted = 0 AND is_active = 1";
  const params: SQLite.SQLiteBindValue[] = [userId];

  if (categoryId) {
    sql += " AND category_id = ?";
    params.push(categoryId);
  }
  if (kind) {
    sql += " AND kind = ?";
    params.push(kind);
  }
  sql += " ORDER BY sort_order";

  const rows = await db.getAllAsync<SubcategoryRow>(sql, ...params);
  return rows.map(mapSubcategory);
}

export async function getSubcategory(userId: string, id: string): Promise<Subcategory | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<SubcategoryRow>(
    "SELECT * FROM subcategories WHERE user_id = ? AND id = ? AND deleted = 0",
    userId,
    id,
  );
  return row ? mapSubcategory(row) : null;
}

export async function createCategory(
  userId: string,
  deviceId: string,
  input: CreateCategoryInput,
): Promise<{ category: Category; operation: SyncOperation }> {
  if (!input.category_group_id || !input.slug || !input.label || !input.description) {
    throw new LocalDbError("VALIDATION_ERROR", "category_group_id, slug, label, and description are required");
  }

  const db = await getDb();
  const id = crypto.randomUUID();
  const ts = now();
  const metadata = "{}";

  let result: { category: Category; operation: SyncOperation };

  await db.withTransactionAsync(async () => {
    const groupRow = await db.getFirstAsync<CategoryGroupRow>(
      "SELECT id FROM category_groups WHERE user_id = ? AND id = ? AND deleted = 0",
      userId,
      input.category_group_id,
    );
    if (!groupRow) {
      throw new LocalDbError("VALIDATION_ERROR", "category_group_id does not exist");
    }

    await db.runAsync(
      `INSERT INTO categories
        (id, user_id, category_group_id, slug, label, short_label, description,
         is_system, is_filipino_context, sort_order, is_active, metadata,
         version, deleted, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, 1, ?, 1, 0, ?, ?)`,
      id,
      userId,
      input.category_group_id,
      input.slug,
      input.label,
      input.short_label ?? null,
      input.description,
      boolToInt(input.is_filipino_context),
      input.sort_order ?? 0,
      metadata,
      ts,
      ts,
    );

    const operation = await enqueueOperation(db, {
      userId,
      deviceId,
      entity: "categories",
      recordId: id,
      operationType: "create",
      baseVersion: null,
      changedFields: [],
      payload: { ...input, is_system: false },
    });

    const row = await db.getFirstAsync<CategoryRow>(
      "SELECT * FROM categories WHERE user_id = ? AND id = ?",
      userId,
      id,
    );

    result = { category: mapCategory(row!), operation };
  });

  return result!;
}

export async function updateCategory(
  userId: string,
  deviceId: string,
  id: string,
  input: UpdateCategoryInput,
): Promise<{ category: Category; operation: SyncOperation }> {
  const db = await getDb();
  const ts = now();

  let result: { category: Category; operation: SyncOperation };

  await db.withTransactionAsync(async () => {
    const current = await db.getFirstAsync<CategoryRow>(
      "SELECT * FROM categories WHERE user_id = ? AND id = ? AND deleted = 0",
      userId,
      id,
    );
    if (!current) throw new LocalDbError("NOT_FOUND", "Category not found");

    const updates: string[] = [];
    const params: SQLite.SQLiteBindValue[] = [];
    const changedFields: string[] = [];

    for (const [key, value] of Object.entries(input)) {
      if (value === undefined) continue;
      changedFields.push(key);

      if (key === "is_filipino_context" || key === "is_active") {
        updates.push(`${key} = ?`);
        params.push(boolToInt(value as boolean));
      } else {
        updates.push(`${key} = ?`);
        params.push(value as SQLite.SQLiteBindValue);
      }
    }

    if (updates.length > 0) {
      updates.push("updated_at = ?");
      params.push(ts);
      updates.push("version = version + 1");

      const sql = `UPDATE categories SET ${updates.join(", ")} WHERE user_id = ? AND id = ?`;
      params.push(userId);
      params.push(id);
      await db.runAsync(sql, ...params);
    }

    const operation = await enqueueOperation(db, {
      userId,
      deviceId,
      entity: "categories",
      recordId: id,
      operationType: "update",
      baseVersion: current.version,
      changedFields,
      payload: { ...input },
    });

    const row = await db.getFirstAsync<CategoryRow>(
      "SELECT * FROM categories WHERE user_id = ? AND id = ?",
      userId,
      id,
    );

    result = { category: mapCategory(row!), operation };
  });

  return result!;
}

export async function deleteCategory(
  userId: string,
  deviceId: string,
  id: string,
): Promise<{ category: Category; operation: SyncOperation }> {
  const db = await getDb();
  const ts = now();

  let result: { category: Category; operation: SyncOperation };

  await db.withTransactionAsync(async () => {
    const current = await db.getFirstAsync<CategoryRow>(
      "SELECT * FROM categories WHERE user_id = ? AND id = ? AND deleted = 0",
      userId,
      id,
    );
    if (!current) throw new LocalDbError("NOT_FOUND", "Category not found");

    await db.runAsync(
      "UPDATE categories SET is_active = 0, deleted = 1, version = version + 1, updated_at = ? WHERE user_id = ? AND id = ?",
      ts,
      userId,
      id,
    );

    const operation = await enqueueOperation(db, {
      userId,
      deviceId,
      entity: "categories",
      recordId: id,
      operationType: "delete",
      baseVersion: current.version,
      changedFields: [],
      payload: { id },
    });

    const row = await db.getFirstAsync<CategoryRow>(
      "SELECT * FROM categories WHERE user_id = ? AND id = ?",
      userId,
      id,
    );

    result = { category: mapCategory(row!), operation };
  });

  return result!;
}

export async function createSubcategory(
  userId: string,
  deviceId: string,
  input: CreateSubcategoryInput,
): Promise<{ subcategory: Subcategory; operation: SyncOperation }> {
  const VALID_KINDS = ["income", "expense", "transfer_adjustment"];
  if (!input.slug || !input.label || !input.description || !input.kind) {
    throw new LocalDbError("VALIDATION_ERROR", "slug, label, description, and kind are required");
  }
  if (!VALID_KINDS.includes(input.kind)) {
    throw new LocalDbError("VALIDATION_ERROR", `kind must be one of: ${VALID_KINDS.join(", ")}`);
  }

  const db = await getDb();
  const id = crypto.randomUUID();
  const ts = now();
  const metadata = "{}";

  let result: { subcategory: Subcategory; operation: SyncOperation };

  await db.withTransactionAsync(async () => {
    if (input.category_id) {
      const catRow = await db.getFirstAsync<CategoryRow>(
        "SELECT id FROM categories WHERE user_id = ? AND id = ? AND deleted = 0",
        userId,
        input.category_id,
      );
      if (!catRow) {
        throw new LocalDbError("VALIDATION_ERROR", "category_id does not exist");
      }
    }

    await db.runAsync(
      `INSERT INTO subcategories
        (id, user_id, category_id, slug, kind, label, short_label, description,
         is_system, is_filipino_context, is_protected, sort_order, is_active,
         metadata, version, deleted, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, 1, ?, 1, 0, ?, ?)`,
      id,
      userId,
      input.category_id ?? null,
      input.slug,
      input.kind,
      input.label,
      input.short_label ?? null,
      input.description,
      boolToInt(input.is_filipino_context),
      boolToInt(input.is_protected),
      input.sort_order ?? 0,
      metadata,
      ts,
      ts,
    );

    const operation = await enqueueOperation(db, {
      userId,
      deviceId,
      entity: "subcategories",
      recordId: id,
      operationType: "create",
      baseVersion: null,
      changedFields: [],
      payload: { ...input, is_system: false },
    });

    const row = await db.getFirstAsync<SubcategoryRow>(
      "SELECT * FROM subcategories WHERE user_id = ? AND id = ?",
      userId,
      id,
    );

    result = { subcategory: mapSubcategory(row!), operation };
  });

  return result!;
}

export async function updateSubcategory(
  userId: string,
  deviceId: string,
  id: string,
  input: UpdateSubcategoryInput,
): Promise<{ subcategory: Subcategory; operation: SyncOperation }> {
  const db = await getDb();
  const ts = now();

  let result: { subcategory: Subcategory; operation: SyncOperation };

  await db.withTransactionAsync(async () => {
    const current = await db.getFirstAsync<SubcategoryRow>(
      "SELECT * FROM subcategories WHERE user_id = ? AND id = ? AND deleted = 0",
      userId,
      id,
    );
    if (!current) throw new LocalDbError("NOT_FOUND", "Subcategory not found");

    const updates: string[] = [];
    const params: SQLite.SQLiteBindValue[] = [];
    const changedFields: string[] = [];

    for (const [key, value] of Object.entries(input)) {
      if (value === undefined) continue;
      changedFields.push(key);

      if (key === "is_filipino_context" || key === "is_protected" || key === "is_active") {
        updates.push(`${key} = ?`);
        params.push(boolToInt(value as boolean));
      } else {
        updates.push(`${key} = ?`);
        params.push(value as SQLite.SQLiteBindValue);
      }
    }

    if (updates.length > 0) {
      updates.push("updated_at = ?");
      params.push(ts);
      updates.push("version = version + 1");

      const sql = `UPDATE subcategories SET ${updates.join(", ")} WHERE user_id = ? AND id = ?`;
      params.push(userId);
      params.push(id);
      await db.runAsync(sql, ...params);
    }

    const operation = await enqueueOperation(db, {
      userId,
      deviceId,
      entity: "subcategories",
      recordId: id,
      operationType: "update",
      baseVersion: current.version,
      changedFields,
      payload: { ...input },
    });

    const row = await db.getFirstAsync<SubcategoryRow>(
      "SELECT * FROM subcategories WHERE user_id = ? AND id = ?",
      userId,
      id,
    );

    result = { subcategory: mapSubcategory(row!), operation };
  });

  return result!;
}

export async function deleteSubcategory(
  userId: string,
  deviceId: string,
  id: string,
): Promise<{ subcategory: Subcategory; operation: SyncOperation }> {
  const db = await getDb();
  const ts = now();

  let result: { subcategory: Subcategory; operation: SyncOperation };

  await db.withTransactionAsync(async () => {
    const current = await db.getFirstAsync<SubcategoryRow>(
      "SELECT * FROM subcategories WHERE user_id = ? AND id = ? AND deleted = 0",
      userId,
      id,
    );
    if (!current) throw new LocalDbError("NOT_FOUND", "Subcategory not found");

    await db.runAsync(
      "UPDATE subcategories SET is_active = 0, deleted = 1, version = version + 1, updated_at = ? WHERE user_id = ? AND id = ?",
      ts,
      userId,
      id,
    );

    const operation = await enqueueOperation(db, {
      userId,
      deviceId,
      entity: "subcategories",
      recordId: id,
      operationType: "delete",
      baseVersion: current.version,
      changedFields: [],
      payload: { id },
    });

    const row = await db.getFirstAsync<SubcategoryRow>(
      "SELECT * FROM subcategories WHERE user_id = ? AND id = ?",
      userId,
      id,
    );

    result = { subcategory: mapSubcategory(row!), operation };
  });

  return result!;
}
