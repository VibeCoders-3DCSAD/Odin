import { useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { createCategory, updateCategory } from "./api";
import type { Category, CategoryGroup } from "./types";

type CategoryFormScreenProps = {
  visible: boolean;
  mode: "create" | "edit";
  category?: Category;
  groups?: CategoryGroup[];
  accessToken: string;
  onSaved: () => void;
  onCancel: () => void;
};

const palette = {
  shell: "#fcf8f0",
  brand: "#013220",
  ink: "#1B1C1A",
  ink2: "#414942",
  mut: "#6B7A6F",
  line: "#EAEAE6",
  error: "#D9001F",
  aqua600: "#08B16A",
  card: "#F1F0EB",
};

export default function CategoryFormScreen({
  visible, mode, category, groups, accessToken,
  onSaved, onCancel,
}: CategoryFormScreenProps) {
  const isCreate = mode === "create";
  const [label, setLabel] = useState(category?.label ?? "");
  const [description, setDescription] = useState(category?.description ?? "");
  const [shortLabel, setShortLabel] = useState(category?.short_label ?? "");
  const [selectedGroupId, setSelectedGroupId] = useState(category?.category_group_id ?? "");
  const [isFilipinoContext, setIsFilipinoContext] = useState(category?.is_filipino_context ?? false);
  const [sortOrder, setSortOrder] = useState(String(category?.sort_order ?? 0));
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  function autoSlug(label: string) {
    return label.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  }

  async function handleSave() {
    setFormError(null);
    if (!label.trim()) { setFormError("Label is required"); return; }
    if (!description.trim()) { setFormError("Description is required"); return; }
    if (isCreate && !selectedGroupId) { setFormError("Category group is required"); return; }

    setSaving(true);
    const payload: Record<string, unknown> = {
      label: label.trim(),
      short_label: shortLabel.trim() || null,
      description: description.trim(),
      is_filipino_context: isFilipinoContext,
      sort_order: parseInt(sortOrder, 10) || 0,
    };

    if (isCreate) {
      Object.assign(payload, { category_group_id: selectedGroupId, slug: autoSlug(label) });
    }

    try {
      const { response, body } = isCreate
        ? await createCategory(accessToken, payload as Parameters<typeof createCategory>[1])
        : await updateCategory(accessToken, category!.id, payload as Parameters<typeof updateCategory>[2]);

      if (!response.ok) {
        setFormError(body.message || "Failed to save category");
        return;
      }
      onSaved();
    } catch {
      setFormError("Network error. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" }} onPress={onCancel}>
        <Pressable onPress={() => {}}>
          <View style={{ backgroundColor: palette.shell, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: "90%" }}>
          <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: palette.line, alignSelf: "center", marginTop: 10 }} />
          <ScrollView contentContainerStyle={{ padding: 22, gap: 16 }}>
            <Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 18, color: palette.ink }}>
              {isCreate ? "New Category" : "Edit Category"}
            </Text>

            {formError && (
              <Text style={{ fontFamily: "Manrope", fontSize: 12, color: palette.error }}>{formError}</Text>
            )}

            {isCreate && (
              <>
                <View>
                  <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 12, color: palette.ink2, marginBottom: 6 }}>CATEGORY GROUP</Text>
                  <View style={{ gap: 6 }}>
                    {groups?.map((g) => (
                      <Pressable
                        key={g.id}
                        accessibilityRole="button"
                        accessibilityLabel={g.label}
                        accessibilityState={{ selected: selectedGroupId === g.id }}
                        onPress={() => setSelectedGroupId(g.id)}
                        style={{
                          padding: 12, borderRadius: 10, borderWidth: 1,
                          borderColor: selectedGroupId === g.id ? palette.brand : palette.line,
                          backgroundColor: selectedGroupId === g.id ? "#EFFEF7" : "transparent",
                        }}
                      >
                        <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 13, color: palette.ink }}>
                          {g.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              </>
            )}

            <View>
              <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 12, color: palette.ink2, marginBottom: 6 }}>
                LABEL {isCreate ? "" : "(leave empty to keep current)"}
              </Text>
              <TextInput
                value={label}
                onChangeText={setLabel}
                placeholder="e.g. My Category"
                placeholderTextColor={palette.mut}
                style={{
                  height: 46, borderRadius: 12, borderWidth: 1, borderColor: palette.line,
                  paddingHorizontal: 14, fontFamily: "Manrope", fontSize: 14, color: palette.ink,
                  backgroundColor: palette.card,
                }}
              />
            </View>

            <View>
              <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 12, color: palette.ink2, marginBottom: 6 }}>
                SHORT LABEL (optional)
              </Text>
              <TextInput
                value={shortLabel}
                onChangeText={setShortLabel}
                placeholder="e.g. My Cat"
                placeholderTextColor={palette.mut}
                style={{
                  height: 46, borderRadius: 12, borderWidth: 1, borderColor: palette.line,
                  paddingHorizontal: 14, fontFamily: "Manrope", fontSize: 14, color: palette.ink,
                  backgroundColor: palette.card,
                }}
              />
            </View>

            <View>
              <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 12, color: palette.ink2, marginBottom: 6 }}>
                DESCRIPTION
              </Text>
              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder="What this category covers"
                placeholderTextColor={palette.mut}
                multiline
                numberOfLines={3}
                style={{
                  borderRadius: 12, borderWidth: 1, borderColor: palette.line,
                  paddingHorizontal: 14, paddingTop: 12, fontFamily: "Manrope", fontSize: 14, color: palette.ink,
                  backgroundColor: palette.card, minHeight: 80, textAlignVertical: "top",
                }}
              />
            </View>

            <View>
              <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 12, color: palette.ink2, marginBottom: 6 }}>
                SORT ORDER
              </Text>
              <TextInput
                value={sortOrder}
                onChangeText={setSortOrder}
                keyboardType="numeric"
                style={{
                  height: 46, borderRadius: 12, borderWidth: 1, borderColor: palette.line,
                  paddingHorizontal: 14, fontFamily: "Manrope", fontSize: 14, color: palette.ink,
                  backgroundColor: palette.card,
                }}
              />
            </View>

            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <Pressable
                accessibilityRole="switch"
                accessibilityLabel="Filipino context"
                accessibilityState={{ checked: isFilipinoContext }}
                onPress={() => setIsFilipinoContext(!isFilipinoContext)}
                style={{
                  width: 44, height: 26, borderRadius: 100,
                  backgroundColor: isFilipinoContext ? palette.aqua600 : palette.line,
                  position: "relative",
                }}
              >
                <View style={{
                  position: "absolute", top: 3,
                  [isFilipinoContext ? "right" : "left"]: 3,
                  width: 20, height: 20, borderRadius: 10, backgroundColor: "#fff",
                }} />
              </Pressable>
              <Text style={{ fontFamily: "Manrope", fontSize: 13, color: palette.ink2 }}>
                Filipino context (localized spending tags)
              </Text>
            </View>

            <View style={{ flexDirection: "row", gap: 10, paddingTop: 8 }}>
              <Pressable
                onPress={onCancel}
                disabled={saving}
                style={{
                  flex: 1, height: 50, borderRadius: 12, borderWidth: 1, borderColor: palette.line,
                  alignItems: "center", justifyContent: "center",
                }}
              >
                <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 14, color: palette.ink2 }}>
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                onPress={handleSave}
                disabled={saving}
                style={{
                  flex: 1, height: 50, borderRadius: 12, backgroundColor: palette.brand,
                  alignItems: "center", justifyContent: "center",
                }}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 14, color: "#fff" }}>
                    Save
                  </Text>
                )}
              </Pressable>
            </View>
          </ScrollView>
        </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
