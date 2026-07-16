import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import TransactionTypeSelector, { TransactionType } from "./components/TransactionTypeSelector";
import { useTransactionData } from "./hooks/useTransactionData";
import { createExpense, createIncome, createTransfer } from "../../local-db/repositories/ledger";
import { runSync } from "../../local-db/sync/runSync";
import { useToast } from "../../components/Toast";
import { useConnectivityStore } from "../../services/connectivity";

const palette = {
  shell: "#fcf8f0",
  brand: "#013220",
  ink: "#1B1C1A",
  ink2: "#414942",
  mut: "#6B7A6F",
  line: "#EAEAE6",
  error: "#D9001F",
  success: "#08B16A",
  card: "#F1F0EB",
};

const QUICK_AMOUNTS = [100, 200, 500, 1000, 2000, 5000];

type Props = {
  userId: string;
  deviceId: string;
  accessToken: string;
  onClose: () => void;
};

export default function NewTransactionScreen({ userId, deviceId, accessToken, onClose }: Props) {
  const { showToast } = useToast();
  const online = useConnectivityStore((s) => s.online);

  const [txType, setTxType] = useState<TransactionType>("expense");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [sourceAccountId, setSourceAccountId] = useState("");
  const [destAccountId, setDestAccountId] = useState("");
  const [subcategoryId, setSubcategoryId] = useState("");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [accountPickerMode, setAccountPickerMode] = useState<"source" | "dest" | null>(null);
  const [isRecurring, setIsRecurring] = useState(false);

  const { accounts, subcategories, loading, error: dataError } = useTransactionData(userId, txType);

  useEffect(() => {
    setSubcategoryId("");
  }, [txType]);

  useEffect(() => {
    if (txType !== "transfer" && subcategories.length > 0 && !subcategoryId) {
      setSubcategoryId(subcategories[0]!.id);
    }
  }, [subcategories, txType, subcategoryId]);

  function resetForm(keepType = false) {
    setAmount("");
    setDescription("");
    setNotes("");
    setSubcategoryId(subcategories[0]?.id ?? "");
    setFormError(null);
    if (!keepType) {
      setTxType("expense");
      setSourceAccountId("");
      setDestAccountId("");
    }
  }

  function parseAmount(): number {
    const parsed = parseFloat(amount);
    if (isNaN(parsed) || parsed <= 0) return 0;
    return Math.round(parsed * 100);
  }

  function formatDate(d: Date): string {
    const today = new Date();
    if (d.toDateString() === today.toDateString()) return "Today";
    return d.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
  }

  async function handleSave(addAnother: boolean) {
    setFormError(null);
    const centavos = parseAmount();
    if (centavos <= 0) { setFormError("Enter a valid amount"); return; }

    const dateStr = date.toISOString().split("T")[0]!;

    if (txType === "expense" && !sourceAccountId) { setFormError("Select a source account"); return; }
    if (txType === "income" && !destAccountId) { setFormError("Select a destination account"); return; }
    if (txType === "transfer") {
      if (!sourceAccountId) { setFormError("Select a source account"); return; }
      if (!destAccountId) { setFormError("Select a destination account"); return; }
    }
    if (txType !== "transfer" && !subcategoryId) { setFormError("Select a category"); return; }

    setSaving(true);
    try {
      if (txType === "expense") {
        await createExpense(userId, deviceId, {
          amount_centavos: centavos,
          source_account_id: sourceAccountId,
          subcategory_id: subcategoryId,
          transaction_date: dateStr,
          merchant_name: description.trim() || undefined,
          notes: notes.trim() || undefined,
        });
      } else if (txType === "income") {
        await createIncome(userId, deviceId, {
          amount_centavos: centavos,
          destination_account_id: destAccountId,
          subcategory_id: subcategoryId,
          transaction_date: dateStr,
          counterparty_name: description.trim() || undefined,
          notes: notes.trim() || undefined,
        });
      } else {
        await createTransfer(userId, deviceId, {
          amount_centavos: centavos,
          source_account_id: sourceAccountId,
          destination_account_id: destAccountId,
          transaction_date: dateStr,
          notes: notes.trim() || undefined,
        });
      }

      showToast("Transaction saved", "success");
      runSync(userId, deviceId, accessToken, { maxAttempts: 3 }).catch(() => {});

      if (addAnother) {
        resetForm(true);
      } else {
        onClose();
      }
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Failed to save transaction");
    } finally {
      setSaving(false);
    }
  }

  function getAccountName(id: string): string {
    return accounts.find((a) => a.id === id)?.name ?? "Select account";
  }

  function renderAccountPicker() {
    if (!accountPickerMode) return null;
    const isSource = accountPickerMode === "source";

    return (
      <Modal visible transparent animationType="slide" onRequestClose={() => setAccountPickerMode(null)}>
        <Pressable onPress={() => setAccountPickerMode(null)} style={{ flex: 1 }}>
          <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" }}>
            <Pressable onPress={() => {}}>
              <View style={{ backgroundColor: palette.shell, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: "60%" }}>
                <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: palette.line, alignSelf: "center", marginTop: 10 }} />
                <ScrollView contentContainerStyle={{ padding: 22, gap: 10 }}>
                  <Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 16, color: palette.ink }}>
                    {isSource ? "From account" : "To account"}
                  </Text>
                  {accounts.map((a) => {
                    const selected = isSource ? sourceAccountId === a.id : destAccountId === a.id;
                    return (
                      <Pressable
                        key={a.id}
                        onPress={() => {
                          if (isSource) setSourceAccountId(a.id);
                          else setDestAccountId(a.id);
                          setAccountPickerMode(null);
                        }}
                        accessibilityRole="button"
                        accessibilityLabel={a.name}
                        accessibilityState={{ selected }}
                        style={{
                          padding: 14, borderRadius: 12, borderWidth: 1,
                          borderColor: selected ? palette.brand : palette.line,
                          backgroundColor: selected ? "#EFFEF7" : palette.card,
                        }}
                      >
                        <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 14, color: palette.ink }}>
                          {a.name}
                        </Text>
                        <Text style={{ fontFamily: "Manrope", fontSize: 11, color: palette.mut, marginTop: 2 }}>
                          {a.kind.replace("_", " ")} · P{(a.current_balance_centavos / 100).toLocaleString()}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    );
  }

  function renderDatePicker() {
    if (!showDatePicker) return null;

    if (Platform.OS === "android") {
      return (
        <DateTimePicker
          value={date}
          mode="date"
          maximumDate={new Date()}
          onChange={(_e, d) => {
            setShowDatePicker(false);
            if (d) setDate(d);
          }}
        />
      );
    }

    return (
      <Modal visible transparent animationType="slide" onRequestClose={() => setShowDatePicker(false)}>
        <Pressable onPress={() => setShowDatePicker(false)} style={{ flex: 1 }}>
          <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" }}>
            <Pressable onPress={() => {}}>
              <View style={{ backgroundColor: palette.shell, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 30 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 22, paddingTop: 14 }}>
                  <Pressable onPress={() => setShowDatePicker(false)}>
                    <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 14, color: palette.mut }}>
                      Cancel
                    </Text>
                  </Pressable>
                  <Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 14, color: palette.ink }}>
                    Select date
                  </Text>
                  <Pressable onPress={() => setShowDatePicker(false)}>
                    <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 14, color: palette.brand }}>
                      Done
                    </Text>
                  </Pressable>
                </View>
                <DateTimePicker
                  value={date}
                  mode="date"
                  maximumDate={new Date()}
                  display="spinner"
                  onChange={(_e, d) => { if (d) setDate(d); }}
                />
              </View>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    );
  }

  if (loading) {
    return (
      <View style={{ alignItems: "center", paddingVertical: 60 }}>
        <ActivityIndicator color={palette.brand} />
        <Text style={{ fontFamily: "Manrope", fontSize: 13, color: palette.mut, marginTop: 10 }}>
          Loading...
        </Text>
      </View>
    );
  }

  if (dataError) {
    return (
      <View style={{ alignItems: "center", paddingVertical: 60 }}>
        <Text style={{ fontFamily: "Manrope", fontSize: 13, color: palette.error, marginBottom: 14 }}>
          {dataError}
        </Text>
        <Pressable
          onPress={onClose}
          style={{ paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: palette.line }}
        >
          <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 13, color: palette.ink2 }}>
            Go back
          </Text>
        </Pressable>
      </View>
    );
  }

  const descriptionLabel = txType === "income" ? "Counterparty" : txType === "transfer" ? "Description" : "Merchant";
  const descriptionPlaceholder = txType === "income" ? "Who paid you?" : txType === "transfer" ? "What's this for?" : "Where did you spend?";
  const needsSource = txType === "expense" || txType === "transfer";
  const needsDest = txType === "income" || txType === "transfer";
  const needsCategory = txType !== "transfer";

  return (
    <View style={{ gap: 16 }}>
      {!online && (
        <View style={{
          backgroundColor: "#FFF8E1", borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14,
          flexDirection: "row", alignItems: "center", gap: 8,
        }}>
          <Text style={{ fontFamily: "Manrope", fontSize: 12, color: "#8D6E00", flex: 1 }}>
            You're offline. Changes will sync when you reconnect.
          </Text>
        </View>
      )}

      <TransactionTypeSelector value={txType} onChange={setTxType} />

      {/* Amount */}
      <View>
        <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 12, color: palette.ink2, marginBottom: 6 }}>
          AMOUNT <Text style={{ color: palette.error }}>*</Text>
        </Text>
        <View style={{
          flexDirection: "row", alignItems: "center", borderRadius: 12, borderWidth: 1,
          borderColor: palette.line, backgroundColor: palette.card, paddingHorizontal: 14,
        }}>
          <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 18, color: palette.brand }}>
            P
          </Text>
          <TextInput
            value={amount}
            onChangeText={setAmount}
            placeholder="0.00"
            placeholderTextColor={palette.mut}
            keyboardType="decimal-pad"
            style={{
              flex: 1, fontFamily: "Manrope", fontSize: 18, color: palette.ink,
              marginLeft: 4, padding: 0, height: 52, textAlign: "right",
            }}
          />
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
          {QUICK_AMOUNTS.map((a) => {
            const selected = amount === String(a);
            return (
              <Pressable
                key={a}
                onPress={() => setAmount(String(a))}
                style={{
                  paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8,
                  backgroundColor: selected ? palette.brand : palette.card,
                  borderWidth: 1, borderColor: selected ? palette.brand : palette.line,
                }}
              >
                <Text style={{
                  fontFamily: "Manrope", fontWeight: "600", fontSize: 12,
                  color: selected ? "#fff" : palette.ink2,
                }}>
                  P{a.toLocaleString()}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Source Account */}
      {needsSource && (
        <View>
          <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 12, color: palette.ink2, marginBottom: 6 }}>
            {txType === "transfer" ? "FROM ACCOUNT" : "SOURCE ACCOUNT"} <Text style={{ color: palette.error }}>*</Text>
          </Text>
          <Pressable
            onPress={() => setAccountPickerMode("source")}
            style={{
              borderRadius: 12, borderWidth: 1, borderColor: palette.line,
              backgroundColor: palette.card, paddingHorizontal: 14, paddingVertical: 14,
            }}
          >
            <Text style={{
              fontFamily: "Manrope", fontSize: 14,
              fontWeight: sourceAccountId ? "600" : "400",
              color: sourceAccountId ? palette.ink : palette.mut,
            }}>
              {sourceAccountId ? getAccountName(sourceAccountId) : "Select source account"}
            </Text>
          </Pressable>
        </View>
      )}

      {/* Destination Account */}
      {needsDest && (
        <View>
          <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 12, color: palette.ink2, marginBottom: 6 }}>
            {txType === "transfer" ? "TO ACCOUNT" : "DESTINATION ACCOUNT"} <Text style={{ color: palette.error }}>*</Text>
          </Text>
          <Pressable
            onPress={() => setAccountPickerMode("dest")}
            style={{
              borderRadius: 12, borderWidth: 1, borderColor: palette.line,
              backgroundColor: palette.card, paddingHorizontal: 14, paddingVertical: 14,
            }}
          >
            <Text style={{
              fontFamily: "Manrope", fontSize: 14,
              fontWeight: destAccountId ? "600" : "400",
              color: destAccountId ? palette.ink : palette.mut,
            }}>
              {destAccountId ? getAccountName(destAccountId) : "Select destination account"}
            </Text>
          </Pressable>
        </View>
      )}

      {/* Category chips */}
      {needsCategory && (
        <View>
          <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 12, color: palette.ink2, marginBottom: 6 }}>
            CATEGORY <Text style={{ color: palette.error }}>*</Text>
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {subcategories.map((sc) => {
              const selected = subcategoryId === sc.id;
              return (
                <Pressable
                  key={sc.id}
                  onPress={() => setSubcategoryId(sc.id)}
                  accessibilityRole="button"
                  accessibilityLabel={sc.label}
                  accessibilityState={{ selected }}
                  style={{
                    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20,
                    backgroundColor: selected ? palette.brand : palette.card,
                    borderWidth: 1,
                    borderColor: selected ? palette.brand
                      : sc.is_filipino_context ? "#D4A017" : palette.line,
                  }}
                >
                  <Text style={{
                    fontFamily: "Manrope", fontWeight: "600", fontSize: 12,
                    color: selected ? "#fff" : palette.ink,
                  }}>
                    {sc.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* Description */}
      <View>
        <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 12, color: palette.ink2, marginBottom: 6 }}>
          {descriptionLabel.toUpperCase()}
        </Text>
        <TextInput
          value={description}
          onChangeText={setDescription}
          placeholder={descriptionPlaceholder}
          placeholderTextColor={palette.mut}
          style={{
            height: 48, borderRadius: 12, borderWidth: 1, borderColor: palette.line,
            paddingHorizontal: 14, fontFamily: "Manrope", fontSize: 14, color: palette.ink,
            backgroundColor: palette.card,
          }}
        />
      </View>

      {/* Date */}
      <View>
        <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 12, color: palette.ink2, marginBottom: 6 }}>
          DATE <Text style={{ color: palette.error }}>*</Text>
        </Text>
        <Pressable
          onPress={() => setShowDatePicker(true)}
          style={{
            borderRadius: 12, borderWidth: 1, borderColor: palette.line,
            backgroundColor: palette.card, paddingHorizontal: 14, paddingVertical: 14,
            flexDirection: "row", alignItems: "center", justifyContent: "space-between",
          }}
        >
          <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 14, color: palette.ink }}>
            {formatDate(date)}
          </Text>
          <Text style={{ fontFamily: "Manrope", fontSize: 11, color: palette.mut }}>
            {Platform.OS === "ios" ? "Change" : "Tap to change"}
          </Text>
        </Pressable>
        {renderDatePicker()}
      </View>

      {/* Notes */}
      <View>
        <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 12, color: palette.ink2, marginBottom: 6 }}>
          NOTES
        </Text>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          placeholder="Optional notes"
          placeholderTextColor={palette.mut}
          multiline
          numberOfLines={2}
          style={{
            borderRadius: 12, borderWidth: 1, borderColor: palette.line,
            paddingHorizontal: 14, paddingTop: 12, fontFamily: "Manrope", fontSize: 14, color: palette.ink,
            backgroundColor: palette.card, minHeight: 64, textAlignVertical: "top",
          }}
        />
      </View>

      {/* Recurring toggle — ponytail: visual placeholder, wired in Slice 6 templates */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 4 }}>
        <Pressable
          onPress={() => setIsRecurring(!isRecurring)}
          accessibilityRole="switch"
          accessibilityLabel="Recurring transaction"
          accessibilityState={{ checked: isRecurring }}
          style={{
            width: 44, height: 26, borderRadius: 100,
            backgroundColor: isRecurring ? palette.brand : palette.line,
            position: "relative",
          }}
        >
          <View style={{
            position: "absolute", top: 3,
            [isRecurring ? "right" : "left"]: 3,
            width: 20, height: 20, borderRadius: 10, backgroundColor: "#fff",
          }} />
        </Pressable>
        <Text style={{ fontFamily: "Manrope", fontSize: 13, color: palette.ink2 }}>
          Make this recurring
        </Text>
      </View>

      {/* Form errors */}
      {formError && (
        <View style={{ backgroundColor: "#FFF0F2", borderRadius: 10, padding: 12 }}>
          <Text style={{ fontFamily: "Manrope", fontSize: 12, color: palette.error, fontWeight: "500" }}>
            {formError}
          </Text>
        </View>
      )}

      {/* Buttons */}
      <View style={{ flexDirection: "row", gap: 10, paddingTop: 4 }}>
        <Pressable
          onPress={() => handleSave(true)}
          disabled={saving}
          style={{
            flex: 1, height: 50, borderRadius: 12, borderWidth: 1, borderColor: palette.brand,
            alignItems: "center", justifyContent: "center",
            opacity: saving ? 0.5 : 1,
          }}
          accessibilityRole="button"
          accessibilityLabel="Save and add another"
        >
          {saving ? (
            <ActivityIndicator color={palette.brand} size="small" />
          ) : (
            <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 13, color: palette.brand }}>
              Save & Add Another
            </Text>
          )}
        </Pressable>
        <Pressable
          onPress={() => handleSave(false)}
          disabled={saving}
          style={{
            flex: 1, height: 50, borderRadius: 12, backgroundColor: palette.brand,
            alignItems: "center", justifyContent: "center",
            opacity: saving ? 0.5 : 1,
          }}
          accessibilityRole="button"
          accessibilityLabel="Save transaction"
        >
          {saving ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 14, color: "#fff" }}>
              Save
            </Text>
          )}
        </Pressable>
      </View>

      {renderAccountPicker()}
    </View>
  );
}
