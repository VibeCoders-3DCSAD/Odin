import { useEffect, useState } from "react";
import {
  Dimensions,
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
  type ObligationFrequency,
} from "../../../local-db/repositories/financialFoundations";
import type { Subcategory } from "../../../local-db/repositories/taxonomy";

const P = {
  shell: "#fcf8f0", brand: "#013220", brandMedium: "#0E6D46",
  ink: "#1B1C1A", ink2: "#414942", muted: "#6B7A6F",
  line: "#EAEAE6", error: "#D9001F", card: "#F1F0EB", white: "#FFFFFF",
};

const FREQUENCIES: readonly ObligationFrequency[] = ["weekly", "biweekly", "semi_monthly", "monthly", "quarterly", "yearly", "custom"];

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
  const [frequency, setFrequency] = useState<ObligationFrequency>("monthly");
  const [dayOfMonth, setDayOfMonth] = useState("");
  const [dayOfWeek, setDayOfWeek] = useState<number | null>(null);
  const [startDate, setStartDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (obligation) {
      setFrequency(obligation.frequency);
      setDayOfMonth(obligation.dueDayOfMonth != null ? String(obligation.dueDayOfMonth) : "");
      setDayOfWeek(obligation.dueDayOfWeek);
      setStartDate(new Date().toISOString().split("T")[0] ?? "");
      setFormError(null);
    }
  }, [obligation]);

  const showDayOfMonth = frequency === "monthly" || frequency === "semi_monthly" || frequency === "quarterly" || frequency === "yearly";
  const showDayOfWeek = frequency === "weekly" || frequency === "biweekly";

  const dayInvalid = dayOfMonth.trim() !== "" && (() => {
    const n = parseInt(dayOfMonth, 10);
    return isNaN(n) || n < 1 || n > 31;
  })();

  const handleSubmit = async () => {
    if (!obligation) return;
    setFormError(null);

    const errors: string[] = [];
    if (!startDate.trim()) errors.push("Start date is required.");
    if (showDayOfMonth && dayOfMonth.trim() && dayInvalid) errors.push("Day must be 1-31.");

    if (errors.length > 0) { setFormError(errors.join("\n")); return; }

    setSaving(true);
    try {
      await automateObligation(userId, deviceId, obligation.id, {
        frequency,
        dayOfMonth: showDayOfMonth ? (dayOfMonth.trim() ? parseInt(dayOfMonth, 10) : null) : undefined,
        dayOfWeek: showDayOfWeek ? dayOfWeek : undefined,
        startDate: startDate.trim() || undefined,
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

                  <View style={{ padding: 12, borderRadius: 12, backgroundColor: P.card, borderWidth: 1, borderColor: P.line, gap: 6 }}>
                    <Text style={{ fontFamily: "Manrope", fontSize: 11, fontWeight: "600", color: P.muted }}>FROM OBLIGATION</Text>
                    <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 14, color: P.ink }}>{obligation.name}</Text>
                    <Text style={{ fontFamily: "Manrope", fontSize: 13, color: P.ink2 }}>{subName} · ₱{(obligation.amountCentavos / 100).toFixed(2)}</Text>
                  </View>

                  <View>
                    <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 12, color: P.ink2, marginBottom: 6 }}>
                      FREQUENCY
                    </Text>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                      {FREQUENCIES.map((f) => (
                        <Pressable
                          key={f}
                          onPress={() => setFrequency(f)}
                          style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, backgroundColor: frequency === f ? P.brand : P.card }}
                        >
                          <Text style={{ fontSize: 13, fontFamily: "Manrope", fontWeight: "600", color: frequency === f ? P.white : P.ink2 }}>{f}</Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>

                  {showDayOfMonth && (
                    <View>
                      <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 12, color: P.ink2, marginBottom: 6 }}>
                        DAY OF MONTH
                      </Text>
                      <TextInput
                        value={dayOfMonth}
                        onChangeText={setDayOfMonth}
                        placeholder="15"
                        placeholderTextColor={P.muted}
                        keyboardType="number-pad"
                        style={{ height: 46, borderRadius: 12, borderWidth: 1, borderColor: dayInvalid ? P.error : P.line, paddingHorizontal: 14, fontFamily: "Manrope", fontSize: 14, color: P.ink, backgroundColor: P.card }}
                      />
                    </View>
                  )}

                  {showDayOfWeek && (
                    <View>
                      <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 12, color: P.ink2, marginBottom: 6 }}>
                        DAY OF WEEK
                      </Text>
                      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day, idx) => (
                          <Pressable
                            key={day}
                            onPress={() => setDayOfWeek(idx)}
                            style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, backgroundColor: dayOfWeek === idx ? P.brand : P.card }}
                          >
                            <Text style={{ fontSize: 13, fontFamily: "Manrope", fontWeight: "600", color: dayOfWeek === idx ? P.white : P.ink2 }}>{day}</Text>
                          </Pressable>
                        ))}
                      </View>
                    </View>
                  )}

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
