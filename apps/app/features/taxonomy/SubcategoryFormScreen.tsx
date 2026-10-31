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
import { ArrowLeft } from "phosphor-react-native";
import { createSubcategory, updateSubcategory } from "../../local-db/repositories/taxonomy";
import { DEFAULT_TAXONOMY_COLOR, TAXONOMY_COLORS, TaxonomyIcon, type TaxonomyIconKey } from "./taxonomyVisuals";
import { subcategoryIconOptions, subcategoryIconKey } from "../../lib/taxonomyIconOptions";
import { generateSlug } from "./helpers/slug";

type SubcategoryFormScreenProps = {
  mode: "create" | "edit";
  subcategory?: {
    id: string;
    slug: string;
    label: string;
    description: string;
    icon_key?: string;
    color_hex?: string;
    is_protected: boolean;
  };
  categoryId: string;
  categoryLabel: string;
  categorySlug: string;
  categoryColor?: string;
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

export default function SubcategoryFormScreen({
  mode, subcategory, categoryId, categoryLabel, categorySlug, categoryColor,
  userId, deviceId, onSaved, onCancel,
}: SubcategoryFormScreenProps) {
  const isCreate = mode === "create";
  const [label, setLabel] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const iconOptions = subcategoryIconOptions(categorySlug);
  const [iconKey, setIconKey] = useState<TaxonomyIconKey>(() => subcategoryIconKey(categorySlug));
  const [colorHex, setColorHex] = useState(DEFAULT_TAXONOMY_COLOR);
  const [isProtected, setIsProtected] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    setLabel(subcategory?.label ?? "");
    setSlug(subcategory ? generateSlug(subcategory.label) : "");
    setDescription(subcategory?.description ?? "");
    setIconKey(subcategoryIconKey(categorySlug, subcategory?.slug, subcategory?.icon_key));
    setColorHex(subcategory?.color_hex ?? categoryColor ?? DEFAULT_TAXONOMY_COLOR);
    setIsProtected(subcategory?.is_protected ?? false);
    setFormError(null);
  }, [mode, subcategory?.id, categorySlug, categoryColor]);

  useEffect(() => {
    const back = BackHandler.addEventListener("hardwareBackPress", () => {
      onCancel();
      return true;
    });
    return () => back.remove();
  }, [onCancel]);

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
        await createSubcategory(userId, deviceId, {
          kind: "expense",
          category_id: categoryId,
          slug: slug.trim() || generateSlug(label.trim()),
          label: label.trim(),
          description: description.trim(),
          icon_key: iconKey,
          color_hex: colorHex,
          is_protected: isProtected,
        });
      } else {
        await updateSubcategory(userId, deviceId, subcategory!.id, {
          label: label.trim(),
          slug: slug.trim() || generateSlug(label.trim()),
          description: description.trim(),
          icon_key: iconKey,
          color_hex: colorHex,
          is_protected: isProtected,
        });
      }
      onSaved();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Failed to save subcategory");
    } finally {
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: palette.shell }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <View style={{ paddingTop: 0, gap: 16 }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Back to subcategories" onPress={onCancel} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <ArrowLeft size={18} color={palette.ink} weight="bold" />
            <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 14, color: palette.mut }}>Subcategories</Text>
          </Pressable>
          <View style={{ gap: 16 }}>
                  <Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 18, color: palette.ink }}>
                    {isCreate ? "New Subcategory" : "Edit Subcategory"}
                  </Text>

                  {subcategory && !isCreate && (
                    <Text style={{ fontFamily: "Manrope", fontSize: 12, color: palette.mut }}>
                      Editing "{subcategory.label}"
                    </Text>
                  )}

                  <Text style={{ fontFamily: "Manrope", fontSize: 12, color: palette.mut }}>
                    Under: {categoryLabel}
                  </Text>

                  <View>
                    <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 12, color: palette.ink2, marginBottom: 6 }}>
                      LABEL <Text style={{color: palette.error}}>*</Text>
                    </Text>
                    <TextInput
                      value={label}
                      onChangeText={setLabel}
                      placeholder="e.g. Dining Out"
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
                      {iconOptions.map((key) => (
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
                      placeholder="What this subcategory covers"
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
                      onPress={() => setIsProtected(!isProtected)}
                      accessibilityRole="switch"
                      accessibilityLabel="Protected"
                      accessibilityState={{ checked: isProtected }}
                      style={{
                        width: 44, height: 26, borderRadius: 100,
                        backgroundColor: isProtected ? palette.aqua600 : palette.line,
                        position: "relative",
                      }}
                    >
                      <View style={{
                        position: "absolute", top: 3,
                        [isProtected ? "right" : "left"]: 3,
                        width: 20, height: 20, borderRadius: 10, backgroundColor: "#fff",
                      }} />
                    </Pressable>
                    <Text style={{ fontFamily: "Manrope", fontSize: 13, color: palette.ink2 }}>
                      Protected
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
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
