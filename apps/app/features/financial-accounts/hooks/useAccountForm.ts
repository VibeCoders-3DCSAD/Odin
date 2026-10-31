import { useEffect, useState } from "react";
import type { SavingsInterestReference } from "@odin/savings-interest";
import type {
  CreateFinancialAccountInput,
  FinancialAccount,
  FinancialAccountKind,
} from "../../../local-db/repositories/foundations/financialFoundations";
import { getSavingsAccountDetails, type SavingsAccountDetailsInput } from "../../../local-db/repositories/savings/savingsAccountDetails";
import { validateAccountForm, type FieldErrors } from "../helpers/accountFormValidation";
import { buildSavingsInterestDetails } from "../helpers/savingsAccountInterest";

export type AccountFormSubmit = (input: CreateFinancialAccountInput, savingsDetails: SavingsAccountDetailsInput | null) => Promise<void>;

type Options = { userId: string; editing: FinancialAccount | null; onClose: () => void; onSubmit: AccountFormSubmit };

// Owns the add/edit account form state: prefill from the account being edited, field errors and submit.
export function useAccountForm({ userId, editing, onClose, onSubmit }: Options) {
  const [name, setName] = useState("");
  const [kind, setKind] = useState<FinancialAccountKind>("bank");
  const [openingBalance, setOpeningBalance] = useState("");
  const [institutionName, setInstitutionName] = useState("");
  const [openedOn, setOpenedOn] = useState<string | null>(null);
  const [creditLimit, setCreditLimit] = useState("");
  const [cutoffDay, setCutoffDay] = useState("");
  const [threshold, setThreshold] = useState("");
  const [allowsExtraPayments, setAllowsExtraPayments] = useState(false);
  const [interestRate, setInterestRate] = useState("");
  const [interestReference, setInterestReference] = useState<SavingsInterestReference | null>(null);
  const [savedSavingsDetails, setSavedSavingsDetails] = useState<SavingsAccountDetailsInput | null>(null);
  const [savingsDetailsReady, setSavingsDetailsReady] = useState(true);
  const [datePicker, setDatePicker] = useState<"opening" | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  useEffect(() => {
    let cancelled = false;
    setSavedSavingsDetails(null);
    setSavingsDetailsReady(editing?.kind !== "savings");
    if (editing) {
      setName(editing.name);
      setKind(editing.kind);
      setOpeningBalance(String(editing.openingBalanceCentavos / 100));
      setInstitutionName(editing.institutionName ?? "");
      setOpenedOn(editing.openedOn);
      const cc = editing.creditCardDetails;
      setCreditLimit(cc ? String(cc.creditLimitCentavos / 100) : "");
      setCutoffDay(cc ? String(cc.cutoffDay) : "");
      setThreshold(cc && cc.alertThresholdPercent != null ? String(cc.alertThresholdPercent) : "");
      setAllowsExtraPayments(cc?.allowsExtraPayments ?? false);
      if (editing.kind === "savings") {
        getSavingsAccountDetails(userId, editing.id).then((details) => {
          if (cancelled) return;
          setSavedSavingsDetails(details);
          setSavingsDetailsReady(true);
          if (!details) return;
          const rate = details.accountType === "high_yield_savings" ? details.baseInterestRateBps : details.interestRateBps;
          setInterestRate(rate == null ? "" : String(rate / 100));
          setInterestReference(details.interestReference ?? null);
        }).catch(() => { if (!cancelled) setFormError("Savings account details could not be loaded. Close and reopen the form to try again."); });
      }
    } else {
      setName(""); setKind("bank"); setOpeningBalance(""); setInstitutionName("");
      setOpenedOn(null);
      setCreditLimit(""); setCutoffDay(""); setThreshold(""); setAllowsExtraPayments(false);
      setInterestRate(""); setInterestReference(null);
    }
    setDatePicker(null);
    setFieldErrors({});
    setFormError(null);
    return () => { cancelled = true; };
  }, [editing, userId]);

  const clearFieldError = (key: keyof FieldErrors) => {
    setFieldErrors((prev) => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  // Field change handler that also clears that field's validation error.
  const changeField = (setter: (value: string) => void, key: keyof FieldErrors) => (value: string) => {
    setter(value);
    clearFieldError(key);
  };

  const closeSheet = () => {
    setDatePicker(null);
    onClose();
  };

  const handleSubmit = async () => {
    setFormError(null);
    if (editing?.kind === "savings" && !savingsDetailsReady) { setFormError("Wait for savings account details to load, or close and reopen the form to try again."); return; }
    const { errors: nextErrors, openingCents, limitCents, cutoffDayValue, thresholdValue } = validateAccountForm({ name, kind, openingBalance, creditLimit, cutoffDay, threshold });

    let savingsDetails: SavingsAccountDetailsInput | null = null;
    if (kind === "savings") {
      try {
        savingsDetails = buildSavingsInterestDetails(savedSavingsDetails, interestRate, interestReference);
      } catch (error) {
        setFormError(error instanceof Error ? error.message : "Check the interest details.");
        return;
      }
    }

    if (Object.keys(nextErrors).length > 0 || (kind === "savings" && !savingsDetails)) { setFieldErrors(nextErrors); return; }

    setSaving(true);
    try {
      const input: CreateFinancialAccountInput = {
        name: name.trim(),
        kind,
        openingBalanceCentavos: openingCents ?? 0,
        institutionName: institutionName.trim() || null,
        openedOn: openedOn ?? null,
      };
      if (kind === "credit_card") {
        input.creditCardDetails = {
          creditLimitCentavos: limitCents!,
          cutoffDay: cutoffDayValue!,
          alertThresholdPercent: thresholdValue!,
          allowsExtraPayments,
        };
      }
      await onSubmit(input, savingsDetails);
    } catch (err) { setFormError(err instanceof Error ? err.message : "Something went wrong"); }
    finally { setSaving(false); }
  };

  return {
    name, setName: changeField(setName, "name"),
    kind, setKind,
    openingBalance, setOpeningBalance: changeField(setOpeningBalance, "openingBalance"),
    institutionName, setInstitutionName,
    openedOn, setOpenedOn,
    creditLimit, setCreditLimit: changeField(setCreditLimit, "creditLimit"),
    cutoffDay, setCutoffDay: changeField(setCutoffDay, "cutoffDay"),
    threshold, setThreshold: changeField(setThreshold, "threshold"),
    allowsExtraPayments, toggleExtraPayments: () => setAllowsExtraPayments((value) => !value),
    interestRate, setInterestRate,
    interestReference, setInterestReference,
    savedSavingsDetails,
    datePicker, setDatePicker,
    saving, formError, fieldErrors,
    closeSheet, handleSubmit,
  };
}
