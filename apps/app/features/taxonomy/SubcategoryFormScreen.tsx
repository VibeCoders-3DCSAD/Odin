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
import { createSubcategory, updateSubcategory } from "../../local-db/repositories/taxonomy";

type SubcategoryFormScreenProps = {
  visible: boolean;
  mode: "create" | "edit";
  subcategory?: {
    id: string;
    slug: string;
    label: string;
    description: string;
    is_protected: boolean;
    minimum_amount_centavos: number | null;
    always_in_budget: boolean;
    fixed_amount_centavos: number | null;
  };
  categoryId: string;
  categoryLabel: string;
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

export default function SubcategoryFormScreen({
  visible, mode, subcategory, categoryId, categoryLabel,
  userId, deviceId, onSaved, onCancel,
}: SubcategoryFormScreenProps) {
  const isCreate = mode === "create";
  const [label, setLabel] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [isProtected, setIsProtected] = useState(false);
  const [alwaysInBudget, setAlwaysInBudget] = useState(false);
  const [minimumAmount, setMinimumAmount] = useState("");
  const [fixedAmount, setFixedAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setLabel(subcategory?.label ?? "");
      setSlug(subcategory ? generateSlug(subcategory.label) : "");
      setDescription(subcategory?.description ?? "");
      setIsProtected(subcategory?.is_protected ?? false);
      setAlwaysInBudget(subcategory?.always_in_budget ?? false);
      setMinimumAmount(subcategory?.minimum_amount_centavos != null ? (subcategory.minimum_amount_centavos / 100).toFixed(2) : "");
      setFixedAmount(subcategory?.fixed_amount_centavos != null ? (subcategory.fixed_amount_centavos / 100).toFixed(2) : "");
      setFormError(null);
    }
  }, [visible, mode, subcategory?.id]);

  useEffect(() => {
    if (label.trim()) {
      setSlug(generateSlug(label));
    }
  }, [label]);

  async function handleSave() {
    setFormError(null);
    if (!label.trim()) { setFormError("Label is required"); return; }
    if (!description.trim()) { setFormError("Description is required"); return; }
    const normalizedMinimum = minimumAmount.trim();
    if ((isProtected || alwaysInBudget) && !/^\d+(\.\d{1,2})?$/.test(normalizedMinimum)) {
      setFormError("Minimum must be a valid peso amount");
      return;
    }
    const normalizedFixed = fixedAmount.trim();
    if (normalizedFixed && !/^\d+(\.\d{1,2})?$/.test(normalizedFixed)) {
      setFormError("Fixed amount must be a valid peso amount");
      return;
    }
    const minimumAmountCentavos = isProtected || alwaysInBudget ? Math.round(Number(normalizedMinimum) * 100) : null;
    const fixedAmountCentavos = normalizedFixed ? Math.round(Number(normalizedFixed) * 100) : null;
    if (fixedAmountCentavos !== null && minimumAmountCentavos !== null && fixedAmountCentavos < minimumAmountCentavos) {
      setFormError("Fixed amount cannot be lower than the minimum");
      return;
    }

    setSaving(true);
    try {
      if (isCreate) {
        await createSubcategory(userId, deviceId, {
          kind: "expense",
          category_id: categoryId,
          slug: slug.trim() || generateSlug(label.trim()),
          label: label.trim(),
          description: description.trim(),
          is_protected: isProtected,
          minimum_amount_centavos: minimumAmountCentavos,
          always_in_budget: alwaysInBudget,
          fixed_amount_centavos: fixedAmountCentavos,
        });
      } else {
        await updateSubcategory(userId, deviceId, subcategory!.id, {
          label: label.trim(),
          slug: slug.trim() || generateSlug(label.trim()),
          description: description.trim(),
          is_protected: isProtected,
          minimum_amount_centavos: minimumAmountCentavos,
          always_in_budget: alwaysInBudget,
          fixed_amount_centavos: fixedAmountCentavos,
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
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <Pressable onPress={onCancel} style={{ flex: 1 }}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" }}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "padding"}>
            <Pressable onPress={() => {}}>
              <View style={{ backgroundColor: palette.shell, borderTopLeftRadius: 20, borderTopRightRadius: 20 }}>
                <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: palette.line, alignSelf: "center", marginTop: 10 }} />
                <ScrollView contentContainerStyle={{ padding: 22, gap: 16 }} keyboardShouldPersistTaps="handled">
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

                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <Pressable
                      onPress={() => setAlwaysInBudget(!alwaysInBudget)}
                      accessibilityRole="switch"
                      accessibilityLabel="Always include in budget"
                      accessibilityState={{ checked: alwaysInBudget }}
                      style={{
                        width: 44, height: 26, borderRadius: 100,
                        backgroundColor: alwaysInBudget ? palette.aqua600 : palette.line,
                        position: "relative",
                      }}
                    >
                      <View style={{
                        position: "absolute", top: 3,
                        [alwaysInBudget ? "right" : "left"]: 3,
                        width: 20, height: 20, borderRadius: 10, backgroundColor: "#fff",
                      }} />
                    </Pressable>
                    <Text style={{ fontFamily: "Manrope", fontSize: 13, color: palette.ink2 }}>
                      Always include in budget
                    </Text>
                  </View>

                  {(isProtected || alwaysInBudget) && (
                    <View>
                      <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 12, color: palette.ink2, marginBottom: 6 }}>
                        MINIMUM (PHP) <Text style={{color: palette.error}}>*</Text>
                      </Text>
                      <TextInput
                        value={minimumAmount}
                        onChangeText={setMinimumAmount}
                        placeholder="0.00"
                        placeholderTextColor={palette.mut}
                        keyboardType="decimal-pad"
                        accessibilityLabel="Minimum amount in pesos"
                        style={{ height: 46, borderRadius: 12, borderWidth: 1, borderColor: palette.line, paddingHorizontal: 14, fontFamily: "Manrope", fontSize: 14, color: palette.ink, backgroundColor: palette.card }}
                      />
                    </View>
                  )}

                  {alwaysInBudget && (
                    <View>
                      <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 12, color: palette.ink2, marginBottom: 6 }}>
                        FIXED AMOUNT (PHP)
                      </Text>
                      <TextInput
                        value={fixedAmount}
                        onChangeText={setFixedAmount}
                        placeholder="Optional"
                        placeholderTextColor={palette.mut}
                        keyboardType="decimal-pad"
                        accessibilityLabel="Fixed budget amount in pesos"
                        style={{ height: 46, borderRadius: 12, borderWidth: 1, borderColor: palette.line, paddingHorizontal: 14, fontFamily: "Manrope", fontSize: 14, color: palette.ink, backgroundColor: palette.card }}
                      />
                    </View>
                  )}

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
