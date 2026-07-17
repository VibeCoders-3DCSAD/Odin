import { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  automateObligation,
  type FinancialObligation,
} from "../../../local-db/repositories/financialFoundations";
import type { Subcategory } from "../../../local-db/repositories/taxonomy";

const P = {
  shell: "#fcf8f0", brand: "#013220", brandMedium: "#0E6D46",
  ink: "#1B1C1A", ink2: "#414942", muted: "#6B7A6F",
  line: "#EAEAE6", error: "#D9001F", card: "#F1F0EB", white: "#FFFFFF",
};

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function dueSummary(o: FinancialObligation): string {
  const parts: string[] = [];
  if (o.dueDayOfMonth != null) {
    parts.push(`day ${o.dueDayOfMonth}`);
    if (o.dueSecondDayOfMonth != null) parts.push(`+ ${o.dueSecondDayOfMonth}`);
  }
  if (o.dueDayOfWeek != null) {
    parts.push(DOW[o.dueDayOfWeek] ?? String(o.dueDayOfWeek));
    if (o.dueSecondDayOfWeek != null) parts.push(`+ ${DOW[o.dueSecondDayOfWeek]}`);
  }
  if (o.dueMonth != null) parts.push(`month ${o.dueMonth}`);
  return parts.join(" · ");
}

type Props = {
  visible: boolean;
  obligation: FinancialObligation | null;
  subcategories: Subcategory[];
  userId: string;
  deviceId: string;
  onClose: () => void;
  onComplete: () => void;
};

export default function AutomateObligationSheet({ visible, obligation, subcategories, userId, deviceId, onClose, onComplete }: Props) {
  const [startDate, setStartDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (obligation) {
      setStartDate(new Date().toISOString().split("T")[0] ?? "");
      setFormError(null);
    }
  }, [obligation]);

  const handleSubmit = async () => {
    if (!obligation) return;
    setFormError(null);

    if (!startDate.trim()) {
      setFormError("Start date is required.");
      return;
    }

    setSaving(true);
    try {
      await automateObligation(userId, deviceId, obligation.id, {
        startDate: startDate.trim(),
      });
      onComplete();
      onClose();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  if (!obligation) return null;

  const subName = subcategories.find((s) => s.id === obligation.subcategoryId)?.label ?? obligation.subcategoryId;
  const summary = dueSummary(obligation);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1 }}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" }}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "padding"}>
            <Pressable onPress={() => {}}>
              <View style={{ backgroundColor: P.shell, maxHeight: "100%", overflow: "hidden" }}>
                <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: P.line, alignSelf: "center", marginTop: 10 }} />
                <ScrollView contentContainerStyle={{ padding: 22, gap: 16 }} keyboardShouldPersistTaps="handled" bounces={false}>
                  <Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 18, color: P.ink }}>
                    Automate This Obligation
                  </Text>

                  <Text style={{ fontFamily: "Manrope", fontSize: 12, color: P.muted }}>
                    Create a recurring expense template from "{obligation.name}"
                  </Text>

                  <View style={{ padding: 12, borderRadius: 12, backgroundColor: P.card, borderWidth: 1, borderColor: P.line, gap: 4 }}>
                    <Text style={{ fontFamily: "Manrope", fontSize: 11, fontWeight: "600", color: P.muted }}>FROM OBLIGATION</Text>
                    <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 14, color: P.ink }}>{obligation.name}</Text>
                    <Text style={{ fontFamily: "Manrope", fontSize: 13, color: P.ink2 }}>{subName} · ₱{(obligation.amountCentavos / 100).toFixed(2)}</Text>
                    <View style={{ flexDirection: "row", alignItems: "center", marginTop: 4, gap: 6 }}>
                      <View style={{ backgroundColor: P.brand, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
                        <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 11, color: P.white }}>{obligation.frequency}</Text>
                      </View>
                      {summary ? (
                        <Text style={{ fontFamily: "Manrope", fontSize: 12, color: P.ink2 }}>{summary}</Text>
                      ) : null}
                    </View>
                  </View>

                  <View>
                    <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 12, color: P.ink2, marginBottom: 6 }}>
                      START DATE
                    </Text>
                    <TextInput
                      value={startDate}
                      onChangeText={setStartDate}
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor={P.muted}
                      style={{ height: 46, borderRadius: 12, borderWidth: 1, borderColor: P.line, paddingHorizontal: 14, fontFamily: "Manrope", fontSize: 14, color: P.ink, backgroundColor: P.card }}
                    />
                  </View>

                  {formError && (
                    <Text style={{ fontFamily: "Manrope", fontSize: 12, color: P.error }}>{formError}</Text>
                  )}

                  <View style={{ flexDirection: "row", gap: 10, paddingTop: 8 }}>
                    <Pressable onPress={onClose} disabled={saving} style={{ flex: 1, height: 50, borderRadius: 12, borderWidth: 1, borderColor: P.line, alignItems: "center", justifyContent: "center" }}>
                      <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 14, color: P.ink2 }}>Cancel</Text>
                    </Pressable>
                    <Pressable onPress={handleSubmit} disabled={saving} style={{ flex: 1, height: 50, borderRadius: 12, backgroundColor: P.brand, alignItems: "center", justifyContent: "center", opacity: saving ? 0.6 : 1 }}>
                      <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 14, color: P.white }}>{saving ? "Creating…" : "Automate"}</Text>
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
