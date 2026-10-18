import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { createCategory, updateCategory } from "../../local-db/repositories/taxonomy";
import { ArrowLeft } from "phosphor-react-native";
import { DEFAULT_TAXONOMY_COLOR, TAXONOMY_COLORS, TAXONOMY_ICON_KEYS, TaxonomyIcon, taxonomyIconKey, type TaxonomyIconKey } from "./taxonomyVisuals";

type CategoryFormScreenProps = {
  mode: "create" | "edit";
  category?: {
    id: string;
    label: string;
    description: string;
    icon_key?: string;
    color_hex?: string;
  };
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
  mode, category, userId, deviceId,
  onSaved, onCancel,
}: CategoryFormScreenProps) {
  const isCreate = mode === "create";
  const [label, setLabel] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [iconKey, setIconKey] = useState<TaxonomyIconKey>(taxonomyIconKey(undefined));
  const [colorHex, setColorHex] = useState(DEFAULT_TAXONOMY_COLOR);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
      setLabel(category?.label ?? "");
      setSlug(category ? generateSlug(category.label) : "");
      setDescription(category?.description ?? "");
      setIconKey(taxonomyIconKey(category?.icon_key));
      setColorHex(category?.color_hex ?? DEFAULT_TAXONOMY_COLOR);
      setFormError(null);
  }, [mode, category?.id]);

  useEffect(() => {
    const back = BackHandler.addEventListener("hardwareBackPress", () => {
      if (!saving) onCancel();
      return true;
    });
    return () => back.remove();
  }, [onCancel, saving]);

  useEffect(() => {
    if (label.trim()) {
      setSlug(generateSlug(label));
    }
  }, [label]);

  async function handleSave() {
    setFormError(null);
    if (!label.trim()) { setFormError("Label is required"); return; }
    if (!description.trim()) { setFormError("Description is required"); return; }

    setSaving(true);
    try {
      if (isCreate) {
        await createCategory(userId, deviceId, {
          slug: slug.trim() || generateSlug(label.trim()),
          label: label.trim(),
          description: description.trim(),
          icon_key: iconKey,
          color_hex: colorHex,
        });
      } else {
        await updateCategory(userId, deviceId, category!.id, {
          label: label.trim(),
          description: description.trim(),
          icon_key: iconKey,
          color_hex: colorHex,
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
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: palette.shell }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40, gap: 16 }} keyboardShouldPersistTaps="handled">
        <Pressable accessibilityRole="button" accessibilityLabel="Back to categories" disabled={saving} onPress={onCancel} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <ArrowLeft size={18} color={palette.ink} weight="bold" />
          <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 14, color: palette.mut }}>Categories</Text>
        </Pressable>
                  <Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 18, color: palette.ink }}>
                    {isCreate ? "New Category" : "Edit Category"}
                  </Text>

                  {category && !isCreate && (
                    <Text style={{ fontFamily: "Manrope", fontSize: 12, color: palette.mut }}>
                      Editing "{category.label}"
                    </Text>
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

                  <View style={{ gap: 8 }}>
                    <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 12, color: palette.ink2 }}>ICON</Text>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                      {TAXONOMY_ICON_KEYS.map((key) => (
                        <Pressable key={key} accessibilityRole="button" accessibilityLabel={`Use ${key} icon`} onPress={() => setIconKey(key)} style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: iconKey === key ? colorHex : palette.card, borderWidth: 1, borderColor: iconKey === key ? colorHex : palette.line, alignItems: "center", justifyContent: "center" }}>
                          <TaxonomyIcon iconKey={key} size={20} color={iconKey === key ? "#fff" : palette.ink2} weight="fill" />
                        </Pressable>
                      ))}
                    </View>
                  </View>

                  <View style={{ gap: 8 }}>
                    <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 12, color: palette.ink2 }}>COLOR</Text>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                      {TAXONOMY_COLORS.map((color) => (
                        <Pressable key={color} accessibilityRole="button" accessibilityLabel={`Use ${color} color`} onPress={() => setColorHex(color)} style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: color, borderWidth: colorHex === color ? 3 : 1, borderColor: colorHex === color ? palette.ink : "#fff" }} />
                      ))}
                    </View>
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
    </KeyboardAvoidingView>
  );
}
