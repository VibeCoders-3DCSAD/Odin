import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import KeyboardAvoider from "../../components/KeyboardAvoider";
import {
  CaretLeft,
  CaretRight,
  Check,
  CheckCircle,
  PencilSimple,
} from "phosphor-react-native";
import { useConnectivityStore } from "../../services/connectivity";
import { useToast } from "../../components/Toast";
import {
  createSession,
  confirmProfileAssignment,
  getEligibilityProfile,
  getCurrentSession,
  getProfileAssignment,
  rejectProfileAssignment,
  submitSession,
  updateSession,
  updateEligibilityProfile,
} from "./api";
import { STEPS, type StepConfig } from "./types";

const AQUA50 = "#EFFEF7";
const AQUA600 = "#08B16A";
const AQUA950 = "#013220";
const CARD = "#FCF8F0";
const INK = "#1B1C1A";
const INK2 = "#414942";
const LINE = "#EAEAE6";
const MUTED = "#6B7A6F";
const ERROR = "#D9001F";
const MONTHLY_OBLIGATIONS_KEY = "monthly_obligations";

type OnboardingFlowProps = {
  accessToken: string;
  userId: string;
  onComplete: () => void;
  restart?: boolean;
};

type SubmitResult = {
  assessment: { id: string; proposed_profile_label: string };
  assignment: { id: string; profile_label: string; confirmation_required: boolean };
};

export default function OnboardingFlow({
  accessToken,
  userId: _userId,
  onComplete,
  restart = false,
}: OnboardingFlowProps) {
  const online = useConnectivityStore((state) => state.online);
  const { showToast } = useToast();

  const [initializing, setInitializing] = useState(true);
  const [initError, setInitError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<SubmitResult | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [obligationAmount, setObligationAmount] = useState("");
  const [incomeText, setIncomeText] = useState("");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const dateOfBirth = (answers.date_of_birth as string) ?? "";

  const sessionRef = useRef(sessionId);
  sessionRef.current = sessionId;
  const answersRef = useRef(answers);
  answersRef.current = answers;
  const onlineRef = useRef(online);
  onlineRef.current = online;

  // ── Session init ──
  useEffect(() => {
    if (!online) return;
    let cancelled = false;
    async function init() {
      try {
        const { response, body } = await getCurrentSession(accessToken);
        if (cancelled) return;

        if (response.ok && body.payload?.session) {
          const sess = body.payload.session;
          if (sess.status === "submitted") {
            if (!restart) {
              onComplete();
              return;
            }
            const { response: cr, body: cb } = await createSession(accessToken);
            if (cr.ok && cb.payload?.session) setSessionId(cb.payload.session.id);
            else {
              setInitError(cb?.message ?? "Failed to start reassessment.");
              return;
            }
          } else {
            setSessionId(sess.id);
            if (sess.raw_answers) {
              const raw = sess.raw_answers as Record<string, unknown>;
              setAnswers(raw);
              if (typeof raw.monthly_obligations === "string") setObligationAmount(raw.monthly_obligations);
              if (typeof raw.monthly_income === "string") setIncomeText(raw.monthly_income);
            }
            const savedStepKey = sess.current_step_key;
            const idx = STEPS.findIndex((s) => s.key === savedStepKey);
            if (idx >= 0) setStepIndex(idx);
          }
        } else {
          const { response: cr, body: cb } = await createSession(accessToken);
          if (cancelled) return;
          if (cr.ok && cb.payload?.session) {
            setSessionId(cb.payload.session.id);
          } else {
            if (!cancelled) setInitError(cb?.message ?? "Failed to create onboarding session.");
            return;
          }
        }
        if (!cancelled) setInitError(null);
      } catch {
        if (!cancelled && onlineRef.current) setInitError("Failed to load onboarding session. Please check your connection and try again.");
      } finally {
        if (!cancelled) setInitializing(false);
      }
    }
    init();
    return () => {
      cancelled = true;
    };
  }, [accessToken, onComplete, showToast, online, restart]);

  // ── Persist progress on step change ──
  const persistStep = useCallback(
    async (sid: string, stepKey: string, raw: Record<string, unknown>) => {
      try {
        await updateSession(accessToken, sid, {
          current_step_key: stepKey,
          raw_answers: raw,
        });
      } catch {}
    },
    [accessToken],
  );

  // ── Navigation ──
  const goNext = useCallback(() => {
    if (stepIndex >= STEPS.length - 1) return;
    const currentStep = STEPS[stepIndex];
    if (!currentStep) return;
    const value = answersRef.current[currentStep.questionKey];
    const incomplete = currentStep.kind === "input"
      ? (currentStep.key === "monthly_income" ? incomeText === "" : typeof value !== "string" || value.trim() === "")
      : currentStep.kind === "card_multi_select"
        ? !Array.isArray(value) || value.length === 0 || (currentStep.key === "fixed_obligations" && obligationAmount === "")
        : currentStep.kind !== "review" && (typeof value !== "string" || value === "");
    if (incomplete) {
      const errorKey = currentStep.key === "fixed_obligations" && Array.isArray(value) && value.length > 0 && obligationAmount === "" ? MONTHLY_OBLIGATIONS_KEY : currentStep.questionKey;
      setFieldErrors({ [errorKey]: currentStep.kind === "card_multi_select" ? "Select at least one answer." : "This answer is required." });
      return;
    }
    setFieldErrors({});
    const next = stepIndex + 1;
    const nextStep = STEPS[next];
    if (!nextStep) return;
    setStepIndex(next);
    if (sessionRef.current)
      persistStep(sessionRef.current, nextStep.key, answersRef.current);
  }, [stepIndex, persistStep, incomeText, obligationAmount]);

  const goBack = useCallback(() => {
    if (stepIndex <= 0) return;
    setStepIndex((p) => p - 1);
  }, [stepIndex]);

  const saveAnswer = useCallback(
    (key: string, value: unknown) => {
      setAnswers((prev) => ({ ...prev, [key]: value }));
      setFieldErrors((errors) => {
        const { [key]: _, ...remaining } = errors;
        return remaining;
      });
    },
    [],
  );

  const handleIncomeStabilitySelect = useCallback(
    (val: string) => {
      const mapped = val === "very_stable" || val === "stable" ? "stable" : "variable";
      setAnswers((prev) => ({ ...prev, income_stability: val, income_type: mapped }));
      setFieldErrors((errors) => {
        const { income_stability: _, ...remaining } = errors;
        return remaining;
      });
    },
    [],
  );

  const handleProtectedCategoriesToggle = useCallback(
    (val: string) => {
      setAnswers((prev) => {
        const prior = (prev.protected_categories as string[]) ?? [];
        const noneKey = "none";
        let next: string[];
        if (val === noneKey) {
          next = [noneKey];
        } else {
          const withoutNone = prior.filter((k) => k !== noneKey);
          next = withoutNone.includes(val)
            ? withoutNone.filter((k) => k !== val)
            : [...withoutNone, val];
        }
        const hasDeps = next.includes("dependents_children") || next.includes("dependents_elderly");
        return { ...prev, protected_categories: next, has_dependents: hasDeps };
      });
      setFieldErrors((errors) => {
        const { protected_categories: _, ...remaining } = errors;
        return remaining;
      });
    },
    [],
  );

  // ── Submit ──
  const handleSubmit = useCallback(async () => {
    const sid = sessionRef.current;
    if (!sid) return;
    const firstIncomplete = STEPS.findIndex((item) => {
      if (item.kind === "review") return false;
      const answer = answersRef.current[item.questionKey];
      if (item.kind === "input") return typeof answer !== "string" || answer === "";
      if (item.kind === "card_multi_select") return !Array.isArray(answer) || answer.length === 0;
      return typeof answer !== "string" || answer === "";
    });
    if (firstIncomplete >= 0 || obligationAmount === "") {
      const obligationStepIndex = STEPS.findIndex((item) => item.key === "fixed_obligations");
      const targetIndex = firstIncomplete >= 0 ? firstIncomplete : obligationStepIndex;
      setStepIndex(targetIndex);
      const missingStep = STEPS[targetIndex];
      if (missingStep) setFieldErrors({ [firstIncomplete >= 0 ? missingStep.questionKey : MONTHLY_OBLIGATIONS_KEY]: "This answer is required." });
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const { response: updateRes, body: updateBody } = await updateSession(accessToken, sid, {
        current_step_key: "review",
        raw_answers: answersRef.current,
      });
      if (!updateRes.ok) {
        setSubmitError(updateBody?.message ?? "Failed to save answers.");
        setSubmitting(false);
        return;
      }
      const { response, body } = await submitSession(accessToken, sid);
      if (response.ok && body.payload) {
        const eligibility = await updateEligibilityProfile(accessToken, {
          date_of_birth: answersRef.current.date_of_birth,
          is_filipino: answersRef.current.is_filipino === "true",
          metro_manila_presence: answersRef.current.metro_manila_presence,
          metro_manila_locality_code: answersRef.current.metro_manila_locality_code,
          primary_employment_classification: answersRef.current.primary_employment_classification,
        });
        if (!eligibility.response.ok) setSubmitError(eligibility.body.message ?? "Your research eligibility could not be saved.");
        setSubmitResult({
          assessment: {
            id: body.payload.assessment.id,
            proposed_profile_label: body.payload.assessment.proposed_profile_label,
          },
          assignment: {
            id: body.payload.assignment.id,
            profile_label: body.payload.assignment.profile_label,
            confirmation_required: body.payload.assignment.confirmation_required,
          },
        });
      } else {
        setSubmitError(body.message ?? "Submission failed.");
      }
    } catch {
      setSubmitError("Network error. Please try again.");
    }
    setSubmitting(false);
  }, [accessToken, showToast, obligationAmount]);

  // ── Offline guard ──
  if (!online) {
    return (
      <View className="flex-1 items-center justify-center bg-card px-6">
        <Text
          style={{
            fontFamily: "Manrope",
            fontWeight: "700",
            fontSize: 18,
            color: INK,
            textAlign: "center",
            marginBottom: 12,
          }}
        >
          Internet Required
        </Text>
        <Text
          style={{
            fontFamily: "Manrope",
            fontWeight: "400",
            fontSize: 14,
            color: MUTED,
            textAlign: "center",
          }}
        >
          Onboarding requires an internet connection. Please connect and try again.
        </Text>
      </View>
    );
  }

  // ── Loading ──
  if (initializing) {
    return (
      <View className="flex-1 items-center justify-center bg-card">
        <ActivityIndicator color={AQUA950} />
      </View>
    );
  }

  // ── Init error ──
  if (initError) {
    return (
      <View className="flex-1 items-center justify-center bg-card px-6">
        <Text
          style={{
            fontFamily: "Manrope",
            fontWeight: "700",
            fontSize: 18,
            color: INK,
            textAlign: "center",
            marginBottom: 12,
          }}
        >
          Unable to Start
        </Text>
        <Text
          style={{
            fontFamily: "Manrope",
            fontWeight: "400",
            fontSize: 14,
            color: MUTED,
            textAlign: "center",
          }}
        >
          {initError}
        </Text>
      </View>
    );
  }

  // ── Result screen ──
  if (submitResult) {
    return <ResultScreen accessToken={accessToken} result={submitResult} error={submitError} onContinue={onComplete} />;
  }

  const step = STEPS[stepIndex];
  if (!step) return null;

  return (
    <KeyboardAvoider>
    <View className="flex-1 bg-card">
      {/* Progress bar */}
      <View className="flex-row gap-1.5 px-5 pt-12 pb-4">
        {STEPS.map((s, i) => {
          const isDone = i < stepIndex;
          const isCurrent = i === stepIndex;
          const bg = isDone ? AQUA950 : isCurrent ? AQUA600 : LINE;
          return (
            <View
              key={s.key}
              style={{
                flex: 1,
                height: 3,
                borderRadius: 2,
                backgroundColor: bg,
              }}
            />
          );
        })}
      </View>

      {/* Back button */}
      {stepIndex > 0 && (
        <Pressable
          onPress={goBack}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          className="px-5 pb-2"
        >
          <View className="flex-row items-center gap-1">
            <CaretLeft size={16} color={INK2} weight="bold" />
            <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 13, color: INK2 }}>
              Back
            </Text>
          </View>
        </Pressable>
      )}

      <ScrollView
        className="flex-1 px-5"
        contentContainerStyle={{ paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Step header */}
        <Text
          style={{
            fontFamily: "Manrope",
            fontWeight: "800",
            fontSize: 24,
            color: INK,
            marginBottom: 4,
          }}
        >
          {step.title}
        </Text>
        {step.subtitle ? (
          <Text
            style={{
              fontFamily: "Manrope",
              fontWeight: "400",
              fontSize: 14,
              color: MUTED,
              marginBottom: 24,
              lineHeight: 20,
            }}
          >
            {step.subtitle}
          </Text>
        ) : (
          <View className="h-6" />
        )}

        {/* Step content */}
        {step.kind === "card_select" && (
          <CardSelectStep
            step={step}
            selected={answers[step.questionKey] as string | undefined}
            onSelect={
              step.key === "income_stability"
                ? handleIncomeStabilitySelect
                : (val) => saveAnswer(step.questionKey, val)
            }
          />
        )}

        {step.kind === "card_multi_select" && (
          <CardMultiSelectStep
            step={step}
            selected={(answers[step.questionKey] as string[]) ?? []}
            onToggle={
              step.key === "dependents_protected"
                ? handleProtectedCategoriesToggle
                : (val) => {
                    const prev = (answers[step.questionKey] as string[]) ?? [];
                    const noneKey = step.options?.find((o) => o.key === "none")?.key;
                    if (val === noneKey) {
                      saveAnswer(step.questionKey, [noneKey]);
                      return;
                    }
                    const withoutNone = prev.filter((k) => k !== noneKey);
                    const next = withoutNone.includes(val)
                      ? withoutNone.filter((k) => k !== val)
                      : [...withoutNone, val];
                    saveAnswer(step.questionKey, next);
                  }
            }
          />
        )}

        {step.kind === "dropdown" && (
          <DropdownStep
            step={step}
            selected={answers[step.questionKey] as string | undefined}
            onSelect={(val) => saveAnswer(step.questionKey, val)}
          />
        )}

        {step.kind === "input" && step.key === "date_of_birth" ? (
          <DateStep
            step={step}
            value={dateOfBirth}
            showPicker={showDatePicker}
            onPress={() => setShowDatePicker(true)}
            onChange={(_event: DateTimePickerEvent, selectedDate?: Date) => {
              setShowDatePicker(false);
              if (selectedDate) {
                const yyyy = selectedDate.getFullYear();
                const mm = String(selectedDate.getMonth() + 1).padStart(2, "0");
                const dd = String(selectedDate.getDate()).padStart(2, "0");
                saveAnswer("date_of_birth", `${yyyy}-${mm}-${dd}`);
              }
            }}
          />
        ) : step.kind === "input" && (
          <InputStep
            step={step}
            value={step.key === "monthly_income" ? incomeText : (answers[step.questionKey] as string) ?? ""}
            onChangeText={
              step.key === "monthly_income"
                ? (t: string) => {
                    const digits = t.replace(/[^0-9]/g, "");
                    setIncomeText(digits);
                    saveAnswer(step.questionKey, digits === "" ? "" : digits);
                  }
                : (t: string) => saveAnswer(step.questionKey, t)
            }
          />
        )}

        {step.kind === "review" && (
          <ReviewStep
            answers={answers}
            onEdit={(idx) => setStepIndex(idx)}
            obligationAmount={obligationAmount}
            incomeText={incomeText}
          />
        )}

        {fieldErrors[step.questionKey] ? (
          <Text style={{ color: ERROR, fontFamily: "Manrope", fontSize: 13, fontWeight: "600", marginTop: 12 }}>
            {fieldErrors[step.questionKey]}
          </Text>
        ) : null}

        {/* Obligation amount sub-input on the obligations step */}
        {step.key === "fixed_obligations" && (
          <View style={{ marginTop: 20 }}>
            <Text
              style={{
                fontFamily: "Manrope",
                fontWeight: "600",
                fontSize: 14,
                color: INK2,
                marginBottom: 8,
              }}
            >
              Total Monthly Obligations
            </Text>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                borderWidth: 1.5,
                borderColor: LINE,
                borderRadius: 14,
                backgroundColor: CARD,
              }}
            >
              <Text
                style={{
                  fontFamily: "Manrope",
                  fontWeight: "600",
                  fontSize: 16,
                  color: MUTED,
                  paddingLeft: 16,
                }}
              >
                PHP
              </Text>
              <TextInput
                value={obligationAmount ? Number(obligationAmount).toLocaleString() : ""}
                onChangeText={(t) => {
                  const digits = t.replace(/[^0-9]/g, "");
                  setObligationAmount(digits);
                  saveAnswer("monthly_obligations", digits === "" ? "" : digits);
                }}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={MUTED}
                style={{
                  flex: 1,
                  fontFamily: "Manrope",
                  fontWeight: "600",
                  fontSize: 18,
                  color: INK,
                  padding: 16,
                }}
              />
            </View>
            {fieldErrors[MONTHLY_OBLIGATIONS_KEY] ? (
              <Text style={{ color: ERROR, fontFamily: "Manrope", fontSize: 13, fontWeight: "600", marginTop: 8 }}>
                {fieldErrors[MONTHLY_OBLIGATIONS_KEY]}
              </Text>
            ) : null}
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Bottom CTA */}
      <View
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          padding: 20,
          paddingBottom: 36,
          backgroundColor: CARD,
          borderTopWidth: 1,
          borderTopColor: LINE,
        }}
      >
        {step.kind === "review" ? (
          <Pressable
            onPress={handleSubmit}
            disabled={submitting}
            accessibilityRole="button"
            accessibilityLabel="Submit assessment"
            style={{
              height: 54,
              borderRadius: 14,
              backgroundColor: AQUA950,
              justifyContent: "center",
              alignItems: "center",
              flexDirection: "row",
              gap: 8,
              opacity: submitting ? 0.45 : 1,
              shadowColor: AQUA950,
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.28,
              shadowRadius: 20,
              elevation: 6,
            }}
          >
            {submitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text
                style={{
                  fontFamily: "Manrope",
                  fontWeight: "700",
                  fontSize: 15,
                  color: "#FFFFFF",
                }}
              >
                Submit Assessment
              </Text>
            )}
          </Pressable>
        ) : (
          <Pressable
            onPress={goNext}
            accessibilityRole="button"
            accessibilityLabel="Continue"
            style={{
              height: 54,
              borderRadius: 14,
              backgroundColor: AQUA950,
              justifyContent: "center",
              alignItems: "center",
              flexDirection: "row",
              gap: 8,
              opacity: 1,
              shadowColor: AQUA950,
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.28,
              shadowRadius: 20,
              elevation: 6,
            }}
          >
            <Text
              style={{
                fontFamily: "Manrope",
                fontWeight: "700",
                fontSize: 15,
                color: "#FFFFFF",
              }}
            >
              Continue
            </Text>
            <CaretRight size={16} color="#FFFFFF" weight="bold" />
          </Pressable>
        )}
      </View>
    </View>
    </KeyboardAvoider>
  );
}

// ── Sub-components ──

function CardSelectStep({
  step,
  selected,
  onSelect,
}: {
  step: StepConfig;
  selected: string | undefined;
  onSelect: (key: string) => void;
}) {
  return (
    <View className="gap-3">
      {step.options?.map((opt) => {
        const active = selected === opt.key;
        return (
          <Pressable
            key={opt.key}
            onPress={() => onSelect(opt.key)}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            accessibilityLabel={opt.label}
            style={{
              borderWidth: 1.5,
              borderColor: active ? AQUA600 : LINE,
              borderRadius: 14,
              padding: 16,
              backgroundColor: active ? AQUA50 : CARD,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontFamily: "Manrope",
                  fontWeight: "600",
                  fontSize: 15,
                  color: active ? AQUA950 : INK2,
                }}
              >
                {opt.label}
              </Text>
              {opt.description ? (
                <Text
                  style={{
                    fontFamily: "Manrope",
                    fontWeight: "400",
                    fontSize: 13,
                    color: MUTED,
                    marginTop: 4,
                  }}
                >
                  {opt.description}
                </Text>
              ) : null}
            </View>
            {active && <Check size={18} color={AQUA600} weight="bold" />}
          </Pressable>
        );
      })}
    </View>
  );
}

function CardMultiSelectStep({
  step,
  selected,
  onToggle,
}: {
  step: StepConfig;
  selected: string[];
  onToggle: (key: string) => void;
}) {
  return (
    <View className="gap-3">
      {step.options?.map((opt) => {
        const active = selected.includes(opt.key);
        return (
          <Pressable
            key={opt.key}
            onPress={() => onToggle(opt.key)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: active }}
            accessibilityLabel={opt.label}
            style={{
              borderWidth: 1.5,
              borderColor: active ? AQUA600 : LINE,
              borderRadius: 14,
              padding: 16,
              backgroundColor: active ? AQUA50 : CARD,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontFamily: "Manrope",
                  fontWeight: "600",
                  fontSize: 15,
                  color: active ? AQUA950 : INK2,
                }}
              >
                {opt.label}
              </Text>
              {opt.description ? (
                <Text
                  style={{
                    fontFamily: "Manrope",
                    fontWeight: "400",
                    fontSize: 13,
                    color: MUTED,
                    marginTop: 4,
                  }}
                >
                  {opt.description}
                </Text>
              ) : null}
            </View>
            {active && <Check size={18} color={AQUA600} weight="bold" />}
          </Pressable>
        );
      })}
    </View>
  );
}

function DropdownStep({
  step,
  selected,
  onSelect,
}: {
  step: StepConfig;
  selected: string | undefined;
  onSelect: (key: string) => void;
}) {
  return (
    <View className="gap-3">
      {step.options?.map((opt) => {
        const active = selected === opt.key;
        return (
          <Pressable
            key={opt.key}
            onPress={() => onSelect(opt.key)}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            accessibilityLabel={opt.label}
            style={{
              borderWidth: 1.5,
              borderColor: active ? AQUA600 : LINE,
              borderRadius: 14,
              padding: 16,
              backgroundColor: active ? AQUA50 : CARD,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Text
              style={{
                fontFamily: "Manrope",
                fontWeight: "600",
                fontSize: 15,
                color: active ? AQUA950 : INK2,
              }}
            >
              {opt.label}
            </Text>
            {active && <Check size={18} color={AQUA600} weight="bold" />}
          </Pressable>
        );
      })}
    </View>
  );
}

function DateStep({
  step,
  value,
  showPicker,
  onPress,
  onChange,
}: {
  step: StepConfig;
  value: string;
  showPicker: boolean;
  onPress: () => void;
  onChange: (event: DateTimePickerEvent, date?: Date) => void;
}) {
  const parsed = value ? new Date(value + "T00:00:00") : new Date();
  const display = value
    ? new Date(value + "T00:00:00").toLocaleDateString("en-PH", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "";

  return (
    <View>
      {step.inputLabel ? (
        <Text
          style={{
            fontFamily: "Manrope",
            fontWeight: "600",
            fontSize: 14,
            color: INK2,
            marginBottom: 10,
          }}
        >
          {step.inputLabel}
        </Text>
      ) : null}
      <Pressable
        onPress={onPress}
        style={{
          borderWidth: 1.5,
          borderColor: LINE,
          borderRadius: 14,
          backgroundColor: CARD,
          padding: 16,
        }}
      >
        <Text
          style={{
            fontFamily: "Manrope",
            fontWeight: "700",
            fontSize: 20,
            color: value ? INK : MUTED,
          }}
        >
          {value ? display : "Select date"}
        </Text>
      </Pressable>
      {showPicker && (
        <DateTimePicker
          value={parsed}
          mode="date"
          onChange={onChange}
        />
      )}
    </View>
  );
}

function InputStep({
  step,
  value,
  onChangeText,
}: {
  step: StepConfig;
  value: string;
  onChangeText: (t: string) => void;
}) {
  return (
    <View>
      {step.inputLabel ? (
        <Text
          style={{
            fontFamily: "Manrope",
            fontWeight: "600",
            fontSize: 14,
            color: INK2,
            marginBottom: 10,
          }}
        >
          {step.inputLabel}
        </Text>
      ) : null}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          borderWidth: 1.5,
          borderColor: LINE,
          borderRadius: 14,
          backgroundColor: CARD,
        }}
      >
        {step.inputSuffix === "PHP" ? (
          <>
            <Text
              style={{
                fontFamily: "Manrope",
                fontWeight: "500",
                fontSize: 12,
                color: MUTED,
                paddingLeft: 16,
              }}
            >
              PHP
            </Text>
            <TextInput
              value={value ? Number(value).toLocaleString() : ""}
              onChangeText={(t) => onChangeText(t.replace(/[^0-9]/g, ""))}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor={MUTED}
              style={{
                flex: 1,
                fontFamily: "Manrope",
                fontWeight: "700",
                fontSize: 20,
                color: INK,
                padding: 16,
              }}
            />
          </>
        ) : (
          <TextInput
            value={value as string}
            onChangeText={(t) => onChangeText(t)}
            keyboardType="default"
            placeholder={step.inputPlaceholder ?? ""}
            placeholderTextColor={MUTED}
            style={{
              flex: 1,
              fontFamily: "Manrope",
              fontWeight: "700",
              fontSize: 20,
              color: INK,
              padding: 16,
            }}
          />
        )}
      </View>
    </View>
  );
}

function ReviewStep({
  answers,
  onEdit,
  obligationAmount,
  incomeText,
}: {
  answers: Record<string, unknown>;
  onEdit: (stepIndex: number) => void;
  obligationAmount: string;
  incomeText: string;
}) {
  const rows: { label: string; value: string; stepIndex: number }[] = [];

  const DOB_STEP = STEPS[1]!;
  const NAT_STEP = STEPS[2]!;
  const MM_STEP = STEPS[3]!;
  const LOCALITY_STEP = STEPS[4]!;
  const EMP_CLASS_STEP = STEPS[5]!;
  const EMP_STEP = STEPS[6]!;
  const STAB_STEP = STEPS[7]!;
  const FREQ_STEP = STEPS[8]!;
  const OBL_STEP = STEPS[10]!;
  const DEP_STEP = STEPS[11]!;

  const displayName = answers.display_name;
  if (displayName && displayName !== "") rows.push({ label: "Name", value: displayName as string, stepIndex: 0 });

  const dob = answers.date_of_birth;
  if (dob && dob !== "") rows.push({ label: "Date of Birth", value: dob as string, stepIndex: 1 });

  const natLabel = NAT_STEP.options?.find((o) => o.key === answers.is_filipino);
  if (natLabel) rows.push({ label: "Filipino Citizen", value: natLabel.label, stepIndex: 2 });

  const mmLabel = MM_STEP.options?.find((o) => o.key === answers.metro_manila_presence);
  if (mmLabel) rows.push({ label: "Metro Manila", value: mmLabel.label, stepIndex: 3 });

  const localityLabel = LOCALITY_STEP.options?.find((o) => o.key === answers.metro_manila_locality_code);
  if (localityLabel) rows.push({ label: "Locality", value: localityLabel.label, stepIndex: 4 });

  const empClassLabel = EMP_CLASS_STEP.options?.find((o) => o.key === answers.primary_employment_classification);
  if (empClassLabel) rows.push({ label: "Employment", value: empClassLabel.label, stepIndex: 5 });

  const empLabel = EMP_STEP.options?.find((o) => o.key === answers.employment_status);
  if (empLabel) rows.push({ label: "Employment Status", value: empLabel.label, stepIndex: 6 });

  const stabLabel = STAB_STEP.options?.find((o) => o.key === answers.income_stability);
  if (stabLabel) rows.push({ label: "Income Stability", value: stabLabel.label, stepIndex: 7 });

  const freqLabel = FREQ_STEP.options?.find((o) => o.key === answers.pay_frequency);
  if (freqLabel) rows.push({ label: "Pay Frequency", value: freqLabel.label, stepIndex: 8 });

  if (incomeText)
    rows.push({
      label: "Monthly Income",
      value: `PHP ${Number(incomeText).toLocaleString()}`,
      stepIndex: 9,
    });

  const obligations = (answers.fixed_obligation_types as string[] | undefined) ?? [];
  const oblLabels = obligations
    .map((k) => OBL_STEP.options?.find((o) => o.key === k)?.label)
    .filter(Boolean)
    .join(", ");
  if (oblLabels) {
    rows.push({ label: "Obligations", value: oblLabels, stepIndex: 10 });
    if (obligationAmount)
      rows.push({
        label: "Total",
        value: `PHP ${Number(obligationAmount).toLocaleString()}`,
        stepIndex: 10,
      });
  }

  const protectedCats = (answers.protected_categories as string[] | undefined) ?? [];
  const catLabels = protectedCats
    .map((k) => DEP_STEP.options?.find((o) => o.key === k)?.label)
    .filter(Boolean)
    .join(", ");
  if (catLabels) rows.push({ label: "Categories", value: catLabels, stepIndex: 11 });

  return (
    <View>
      {rows.map((row, i) => (
        <View key={i}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingVertical: 14,
              borderBottomWidth: 1,
              borderBottomColor: LINE,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontFamily: "Manrope",
                  fontWeight: "500",
                  fontSize: 12,
                  color: MUTED,
                  marginBottom: 2,
                }}
              >
                {row.label}
              </Text>
              <Text
                style={{
                  fontFamily: "Manrope",
                  fontWeight: "600",
                  fontSize: 14,
                  color: INK,
                }}
              >
                {row.value}
              </Text>
            </View>
            <Pressable
              onPress={() => onEdit(row.stepIndex)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={`Edit ${row.label}`}
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                backgroundColor: AQUA50,
                alignItems: "center",
                justifyContent: "center",
                marginLeft: 12,
              }}
            >
              <PencilSimple size={14} color={AQUA600} />
            </Pressable>
          </View>
        </View>
      ))}
    </View>
  );
}

function ResultScreen({
  accessToken,
  result,
  error,
  onContinue,
}: {
  accessToken: string;
  result: SubmitResult;
  error: string | null;
  onContinue: () => void;
}) {
  const [drivers, setDrivers] = useState<{ driver_label: string; value_text: string; explanation: string }[]>([]);
  const [eligible, setEligible] = useState<boolean | null>(null);
  const [decision, setDecision] = useState<"accepted" | "rejected" | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [savingDecision, setSavingDecision] = useState(false);
  const [decisionError, setDecisionError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getProfileAssignment(accessToken), getEligibilityProfile(accessToken)])
      .then(([profile, eligibility]) => {
        if (profile.response.ok) setDrivers(profile.body.payload?.drivers ?? []);
        if (eligibility.response.ok) setEligible(eligibility.body.payload?.profile?.eligibility_confirmed_at != null);
      })
      .catch(() => {});
  }, [accessToken]);

  const label = result.assignment.profile_label
    .replace(/_/g, "-")
    .replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <ScrollView
      className="flex-1 bg-card"
      contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 24 }}
    >
      <View style={{ alignItems: "center" }}>
        <View
          style={{
            width: 72,
            height: 72,
            borderRadius: 36,
            backgroundColor: AQUA50,
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 20,
          }}
        >
          <CheckCircle size={36} color={AQUA600} weight="fill" />
        </View>

        <Text
          style={{
            fontFamily: "Manrope",
            fontWeight: "800",
            fontSize: 26,
            color: INK,
            textAlign: "center",
            marginBottom: 8,
          }}
        >
          Assessment Complete
        </Text>

        <Text
          style={{
            fontFamily: "Manrope",
            fontWeight: "400",
            fontSize: 14,
            color: MUTED,
            textAlign: "center",
            marginBottom: 24,
            lineHeight: 20,
          }}
        >
          Your financial profile has been assessed.
        </Text>

        <View
          style={{
            width: "100%",
            borderRadius: 16,
            padding: 24,
            backgroundColor: AQUA950,
            marginBottom: 20,
          }}
        >
          <Text
            style={{
              fontFamily: "Manrope",
              fontWeight: "600",
              fontSize: 12,
              color: "#41EDA4",
              textTransform: "uppercase",
              letterSpacing: 1,
              marginBottom: 8,
            }}
          >
            Your Profile
          </Text>
          <Text
            style={{
              fontFamily: "Manrope",
              fontWeight: "800",
              fontSize: 28,
              color: "#FFFFFF",
              marginBottom: 12,
            }}
          >
            {label}
          </Text>
          <Text
            style={{
              fontFamily: "Manrope",
              fontWeight: "400",
              fontSize: 13,
              color: "#84D4AE",
              lineHeight: 19,
            }}
          >
            {drivers.length > 0
              ? drivers.map((driver) => `${driver.driver_label}: ${driver.value_text}. ${driver.explanation}`).join("\n")
              : "Your profile is based on the financial details you provided."}
          </Text>
        </View>

        <View
          style={{
            width: "100%",
            borderRadius: 16,
            padding: 16,
            backgroundColor: eligible ? AQUA50 : CARD,
            borderWidth: 1,
            borderColor: eligible ? AQUA600 : LINE,
            marginBottom: 20,
          }}
        >
          <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 14, color: INK, marginBottom: 4 }}>
            Research eligibility
          </Text>
          <Text style={{ fontFamily: "Manrope", fontSize: 13, color: INK2, lineHeight: 19 }}>
            {eligible === null ? "Checking your saved eligibility profile..." : eligible
              ? "You are eligible for Odin research: ages 20–40 and living or working in Metro Manila. This does not affect access to the app."
              : "You are not currently eligible for Odin research. This does not affect access to the app."}
          </Text>
        </View>

        {decision === null ? (
          <View style={{ width: "100%", gap: 10, marginBottom: 20 }}>
            <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 14, color: INK }}>Does this profile fit you?</Text>
            <Pressable disabled={savingDecision} onPress={async () => {
              setSavingDecision(true); setDecisionError(null);
              const response = await confirmProfileAssignment(accessToken, result.assignment.id);
              if (response.response.ok) setDecision("accepted"); else setDecisionError(response.body.message ?? "Couldn't accept your profile.");
              setSavingDecision(false);
            }} style={{ height: 48, borderRadius: 14, backgroundColor: AQUA950, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ color: "#FFFFFF", fontFamily: "Manrope", fontWeight: "700" }}>Accept profile</Text>
            </Pressable>
            <TextInput value={rejectReason} onChangeText={setRejectReason} placeholder="Why doesn't this fit?" placeholderTextColor={MUTED} style={{ borderWidth: 1, borderColor: LINE, borderRadius: 14, padding: 14, color: INK, fontFamily: "Manrope" }} />
            <Pressable disabled={savingDecision || !rejectReason.trim()} onPress={async () => {
              setSavingDecision(true); setDecisionError(null);
              const response = await rejectProfileAssignment(accessToken, result.assignment.id, rejectReason);
              if (response.response.ok) setDecision("rejected"); else setDecisionError(response.body.message ?? "Couldn't reject your profile.");
              setSavingDecision(false);
            }} style={{ height: 48, borderRadius: 14, borderWidth: 1, borderColor: LINE, alignItems: "center", justifyContent: "center", opacity: rejectReason.trim() ? 1 : 0.45 }}>
              <Text style={{ color: INK, fontFamily: "Manrope", fontWeight: "700" }}>Reject and choose manually in Settings</Text>
            </Pressable>
            {decisionError ? <Text style={{ color: ERROR, fontFamily: "Manrope", fontSize: 13 }}>{decisionError}</Text> : null}
          </View>
        ) : null}

        {error ? (
          <View
            style={{
              width: "100%",
              borderRadius: 14,
              padding: 16,
              backgroundColor: "#FFF0F2",
              borderWidth: 1,
              borderColor: "#FFCDD2",
              marginBottom: 16,
            }}
          >
            <Text
              style={{
                fontFamily: "Manrope",
                fontWeight: "600",
                fontSize: 13,
                color: ERROR,
              }}
            >
              {error}
            </Text>
          </View>
        ) : null}

        <Pressable
          onPress={onContinue}
          disabled={decision === null}
          accessibilityRole="button"
          accessibilityLabel="Continue to Dashboard"
          style={{
            width: "100%",
            height: 54,
            borderRadius: 14,
            backgroundColor: AQUA950,
            justifyContent: "center",
            alignItems: "center",
            opacity: decision === null ? 0.45 : 1,
            shadowColor: AQUA950,
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.28,
            shadowRadius: 20,
            elevation: 6,
          }}
        >
          <Text
            style={{
              fontFamily: "Manrope",
              fontWeight: "700",
              fontSize: 15,
              color: "#FFFFFF",
            }}
          >
            Continue to Dashboard
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
