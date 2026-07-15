import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { createCategory, updateCategory } from "../../local-db/repositories/taxonomy";

type CategoryFormScreenProps = {
  visible: boolean;
  mode: "create" | "edit";
  category?: {
    id: string;
    category_group_id: string;
    label: string;
    description: string;
    is_filipino_context: boolean;
  };
  groups?: { id: string; slug: string; label: string }[];
  userId: string;
  deviceId: string;
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

function generateSlug(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

export default function CategoryFormScreen({
  visible, mode, category, groups, userId, deviceId,
  onSaved, onCancel,
}: CategoryFormScreenProps) {
  const isCreate = mode === "create";
  const [label, setLabel] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [isFilipinoContext, setIsFilipinoContext] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setLabel(category?.label ?? "");
      setSlug(category ? generateSlug(category.label) : "");
      setDescription(category?.description ?? "");
      setSelectedGroupId(category?.category_group_id ?? "");
      setIsFilipinoContext(category?.is_filipino_context ?? false);
      setFormError(null);
    }
  }, [visible, mode, category?.id]);

  useEffect(() => {
    if (label.trim()) {
      setSlug(generateSlug(label));
    }
  }, [label]);

  async function handleSave() {
    setFormError(null);
    if (!label.trim()) { setFormError("Label is required"); return; }
    if (!description.trim()) { setFormError("Description is required"); return; }
    if (isCreate && !selectedGroupId) { setFormError("Category group is required"); return; }

    setSaving(true);
    try {
      if (isCreate) {
        await createCategory(userId, deviceId, {
          category_group_id: selectedGroupId,
          slug: slug.trim() || generateSlug(label.trim()),
          label: label.trim(),
          description: description.trim(),
          is_filipino_context: isFilipinoContext,
        });
      } else {
        await updateCategory(userId, deviceId, category!.id, {
          label: label.trim(),
          description: description.trim(),
          is_filipino_context: isFilipinoContext,
        });
      }
      onSaved();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Failed to save category");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <Pressable onPress={onCancel} style={{ flex: 1 }}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" }}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "padding"}>
            <Pressable onPress={() => {}}>
              <View style={{ backgroundColor: palette.shell, borderTopLeftRadius: 20, borderTopRightRadius: 20 }}>
                <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: palette.line, alignSelf: "center", marginTop: 10 }} />
                <ScrollView contentContainerStyle={{ padding: 22, gap: 16 }} keyboardShouldPersistTaps="handled">
                  <Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 18, color: palette.ink }}>
                    {isCreate ? "New Category" : "Edit Category"}
                  </Text>

                  {category && !isCreate && (
                    <Text style={{ fontFamily: "Manrope", fontSize: 12, color: palette.mut }}>
                      Editing "{category.label}"
                    </Text>
                  )}

                  {isCreate && (
                    <View>
                      <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 12, color: palette.ink2, marginBottom: 6 }}>
                        CATEGORY GROUP <Text style={{color: palette.error}}>*</Text>
                      </Text>
                      <View style={{ gap: 6 }}>
                        {groups?.map((g) => (
                          <Pressable
                            key={g.id}
                            onPress={() => setSelectedGroupId(g.id)}
                            accessibilityRole="radio"
                            accessibilityLabel={g.label}
                            accessibilityState={{ checked: selectedGroupId === g.id }}
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
                  )}

                  <View>
                    <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 12, color: palette.ink2, marginBottom: 6 }}>
                      LABEL <Text style={{color: palette.error}}>*</Text>
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
                      DESCRIPTION <Text style={{color: palette.error}}>*</Text>
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

                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <Pressable
                      onPress={() => setIsFilipinoContext(!isFilipinoContext)}
                      accessibilityRole="switch"
                      accessibilityLabel="Filipino context"
                      accessibilityState={{ checked: isFilipinoContext }}
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

                  {formError && (
                    <Text style={{ fontFamily: "Manrope", fontSize: 12, color: palette.error }}>{formError}</Text>
                  )}

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
          </KeyboardAvoidingView>
        </View>
      </Pressable>
    </Modal>
  );
}
