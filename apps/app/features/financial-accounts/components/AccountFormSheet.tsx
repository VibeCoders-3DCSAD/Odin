import React from "react";
import { Dimensions, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import type { FinancialAccount } from "../../../local-db/repositories/foundations/financialFoundations";
import { ActionSheet } from "../../../components/ActionSheet";
import { BottomSheetSurface } from "../../../components/BottomSheetSurface";
import { formatDate, toPickerDate } from "../helpers/accountFormParsing";
import { P } from "../helpers/accountsTheme";
import { useAccountForm, type AccountFormSubmit } from "../hooks/useAccountForm";
import { AccountDateField } from "./AccountDateField";
import { AccountKindPicker } from "./AccountKindPicker";
import { AccountTextInput } from "./AccountTextInput";
import { CreditCardFields } from "./CreditCardFields";
import { FormField } from "./FormField";
import SavingsInterestFields from "./SavingsInterestFields";

type Props = { userId: string; visible: boolean; editing: FinancialAccount | null; onClose: () => void; onSubmit: AccountFormSubmit };

export function AccountFormSheet({ userId, visible, editing, onClose, onSubmit }: Props) {
  const form = useAccountForm({ userId, editing, onClose, onSubmit });
  const { kind, fieldErrors, saving } = form;
  const isEdit = editing !== null;

  return (
    <ActionSheet visible={visible} onClose={form.closeSheet} backdropColor="rgba(0,0,0,0.45)">
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "padding"}>
            <Pressable onPress={() => {}}>
              <BottomSheetSurface style={{ backgroundColor: P.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: Dimensions.get("window").height * 0.85 }}>
                <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: P.line, alignSelf: "center", marginTop: 10 }} />
                <ScrollView contentContainerStyle={{ padding: 22, gap: 16 }} keyboardShouldPersistTaps="handled" bounces={false}>
                  <Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 18, color: P.ink }}>
                    {isEdit ? "Edit Account" : "Add Account"}
                  </Text>

                  <Text style={{ fontFamily: "Manrope", fontSize: 12, color: P.muted }}>
                    Fields marked with (*) are required
                  </Text>

                  <FormField label="ACCOUNT NAME" required error={fieldErrors.name}>
                    <AccountTextInput value={form.name} onChangeText={form.setName} placeholder="Enter account name" invalid={Boolean(fieldErrors.name)} />
                  </FormField>

                  <FormField label="ACCOUNT TYPE" required>
                    {editing?.kind === "savings" ? <Text style={{ fontFamily: "Manrope", fontSize: 13, color: P.ink2 }}>Savings (existing account)</Text> : <AccountKindPicker kind={kind} onChange={form.setKind} />}
                  </FormField>

                  {kind === "savings" ? (
                    <SavingsInterestFields persistedReference={form.savedSavingsDetails?.interestReference} rate={form.interestRate} onRateChange={form.setInterestRate} reference={form.interestReference} onReferenceChange={form.setInterestReference} />
                  ) : null}

                  <FormField label={kind === "credit_card" ? "OUTSTANDING BALANCE (₱) (OPTIONAL)" : "OPENING BALANCE (₱)"} required={kind !== "credit_card"} error={fieldErrors.openingBalance}>
                    <AccountTextInput
                      value={form.openingBalance}
                      onChangeText={form.setOpeningBalance}
                      placeholder={kind === "credit_card" ? "Enter outstanding balance" : "Enter opening balance"}
                      keyboardType="decimal-pad"
                      invalid={Boolean(fieldErrors.openingBalance)}
                    />
                  </FormField>

                  <FormField label="INSTITUTION (OPTIONAL)">
                    <AccountTextInput value={form.institutionName} onChangeText={form.setInstitutionName} placeholder="Enter institution name" />
                  </FormField>

                  <FormField label="OPENING DATE (OPTIONAL)">
                    <AccountDateField placeholder="Select opening date" value={form.openedOn} onPress={() => form.setDatePicker("opening")} />
                  </FormField>

                  {kind === "credit_card" ? (
                    <CreditCardFields
                      creditLimit={form.creditLimit}
                      cutoffDay={form.cutoffDay}
                      threshold={form.threshold}
                      allowsExtraPayments={form.allowsExtraPayments}
                      fieldErrors={fieldErrors}
                      onCreditLimitChange={form.setCreditLimit}
                      onCutoffDayChange={form.setCutoffDay}
                      onThresholdChange={form.setThreshold}
                      onToggleExtraPayments={form.toggleExtraPayments}
                    />
                  ) : null}

                  {form.datePicker ? (
                    <DateTimePicker
                      value={toPickerDate(form.openedOn)}
                      mode="date"
                      display={Platform.OS === "ios" ? "spinner" : "default"}
                      onChange={(event, date) => {
                        if (event.type === "set" && date) form.setOpenedOn(formatDate(date));
                        if (Platform.OS !== "ios") form.setDatePicker(null);
                      }}
                    />
                  ) : null}

                  {form.formError && (
                    <Text style={{ fontFamily: "Manrope", fontSize: 12, color: P.error }}>{form.formError}</Text>
                  )}

                  <View style={{ flexDirection: "row", gap: 10, paddingTop: 8 }}>
                    <Pressable onPress={form.closeSheet} disabled={saving} accessibilityRole="button" style={{ flex: 1, height: 50, borderRadius: 12, borderWidth: 1, borderColor: P.line, alignItems: "center", justifyContent: "center" }}>
                      <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 14, color: P.ink2 }}>Cancel</Text>
                    </Pressable>
                    <Pressable onPress={form.handleSubmit} disabled={saving} accessibilityRole="button" style={{ flex: 1, height: 50, borderRadius: 12, backgroundColor: P.brand, alignItems: "center", justifyContent: "center", opacity: saving ? 0.6 : 1 }}>
                      <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 14, color: P.white }}>{saving ? "Saving…" : isEdit ? "Save Changes" : "Add Account"}</Text>
                    </Pressable>
                  </View>
                </ScrollView>
              </BottomSheetSurface>
            </Pressable>
          </KeyboardAvoidingView>
    </ActionSheet>
  );
}
