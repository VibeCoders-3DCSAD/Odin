import { useEffect, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export type PlanCategoryRule = "FLEXIBLE" | "MINIMUM" | "FIXED";

export type PlanCategoryRuleUpdate = {
  rule: PlanCategoryRule;
  minimumAmountCentavos: number | null;
  fixedAmountCentavos: number | null;
};

type Props = {
  category: { label: string; minimum_amount_centavos?: number | null; fixed_amount_centavos?: number | null };
  onSave: (update: PlanCategoryRuleUpdate) => Promise<void>;
  onClose: () => void;
};

function currentRule(category: Props["category"]): PlanCategoryRule {
  if (category.fixed_amount_centavos != null) return "FIXED";
  if (category.minimum_amount_centavos != null) return "MINIMUM";
  return "FLEXIBLE";
}

function amountFor(category: Props["category"], rule: PlanCategoryRule): string {
  const amount = rule === "FIXED" ? category.fixed_amount_centavos : category.minimum_amount_centavos;
  return amount == null ? "" : (amount / 100).toFixed(2);
}

function parseCentavos(value: string): number | null {
  if (!/^\d+(\.\d{1,2})?$/.test(value.trim())) return null;
  return Math.round(Number(value) * 100);
}

export function PlanCategoryRuleEditor({ category, onSave, onClose }: Props) {
  const { bottom: bottomInset } = useSafeAreaInsets();
  const [rule, setRule] = useState<PlanCategoryRule>(() => currentRule(category));
  const [amount, setAmount] = useState(() => amountFor(category, currentRule(category)));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const nextRule = currentRule(category);
    setRule(nextRule);
    setAmount(amountFor(category, nextRule));
    setError(null);
  }, [category]);

  const selectRule = (nextRule: PlanCategoryRule) => {
    setRule(nextRule);
    setAmount(amountFor(category, nextRule));
    setError(null);
  };

  const save = async () => {
    const parsedAmount = rule === "FLEXIBLE" ? null : parseCentavos(amount);
    if (rule !== "FLEXIBLE" && parsedAmount === null) {
      setError("Enter a valid peso amount.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onSave({
        rule,
        minimumAmountCentavos: rule === "MINIMUM" ? parsedAmount : null,
        fixedAmountCentavos: rule === "FIXED" ? parsedAmount : null,
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "This Financial Plan rule could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  return <Modal transparent animationType="slide" onRequestClose={onClose}>
    <Pressable onPress={saving ? undefined : onClose} style={{ flex: 1, backgroundColor: "rgba(16, 29, 22, 0.42)" }}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1, justifyContent: "flex-end" }}>
        <Pressable onPress={() => {}} style={{ backgroundColor: "#FCF8F0", borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 20, paddingHorizontal: 20, paddingBottom: Math.max(bottomInset, 20), gap: 16 }}>
        <View style={{ alignItems: "center" }}><View style={{ width: 34, height: 4, borderRadius: 2, backgroundColor: "#D7DDD8" }} /></View>
        <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}><View style={{ flex: 1 }}><Text style={{ color: "#1B1C1A", fontFamily: "Manrope", fontSize: 18, fontWeight: "800" }}>{category.label}</Text><Text style={{ color: "#6B7A6F", fontFamily: "Manrope", fontSize: 12, marginTop: 3 }}>Set its default treatment for new Financial Plans.</Text></View><Pressable accessibilityRole="button" accessibilityLabel={`Close rule editor for ${category.label}`} disabled={saving} onPress={onClose} hitSlop={8}><Text style={{ color: "#416153", fontFamily: "Manrope", fontSize: 13, fontWeight: "800" }}>Close</Text></Pressable></View>
        <View style={{ flexDirection: "row", gap: 7 }}>
          {(["FLEXIBLE", "MINIMUM", "FIXED"] as const).map((option) => <Pressable key={option} accessibilityRole="radio" accessibilityState={{ checked: rule === option }} accessibilityLabel={`${option[0]}${option.slice(1).toLowerCase()} rule for ${category.label}`} onPress={() => selectRule(option)} style={{ flex: 1, borderRadius: 11, borderWidth: 1, borderColor: rule === option ? "#0E6D46" : "#D7DDD8", backgroundColor: rule === option ? "#E4F5EB" : "#F6F2E9", paddingVertical: 10 }}><Text style={{ color: "#1B1C1A", fontFamily: "Manrope", fontSize: 11, fontWeight: "800", textAlign: "center" }}>{option[0]}{option.slice(1).toLowerCase()}</Text></Pressable>)}
        </View>
        {rule !== "FLEXIBLE" ? <View><Text style={{ color: "#414942", fontFamily: "Manrope", fontSize: 11, fontWeight: "700", marginBottom: 6 }}>{rule === "FIXED" ? "FIXED AMOUNT (PHP)" : "MINIMUM (PHP)"}</Text><TextInput value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor="#6B7A6F" accessibilityLabel={`${rule === "FIXED" ? "Fixed" : "Minimum"} amount for ${category.label} in pesos`} style={{ height: 46, borderRadius: 11, borderWidth: 1, borderColor: "#D7DDD8", backgroundColor: "#FFFFFF", color: "#1B1C1A", fontFamily: "Manrope", fontSize: 15, paddingHorizontal: 13 }} /></View> : <View style={{ borderLeftWidth: 3, borderLeftColor: "#0E6D46", paddingLeft: 10 }}><Text style={{ color: "#416153", fontFamily: "Manrope", fontSize: 12 }}>Flexible is the default. You can include it only when it matters for this month's plan.</Text></View>}
        {error ? <Text accessibilityRole="alert" style={{ color: "#D9001F", fontFamily: "Manrope", fontSize: 11 }}>{error}</Text> : null}
        <Pressable accessibilityRole="button" accessibilityLabel={`Save Financial Plan rule for ${category.label}`} disabled={saving} onPress={() => void save()} style={{ borderRadius: 12, backgroundColor: "#013220", opacity: saving ? 0.6 : 1, paddingVertical: 13 }}>{saving ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={{ color: "#FFFFFF", fontFamily: "Manrope", fontSize: 13, fontWeight: "800", textAlign: "center" }}>Save default</Text>}</Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Pressable>
  </Modal>;
}
