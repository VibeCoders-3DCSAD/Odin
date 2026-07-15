import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
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
  getCurrentSession,
  submitSession,
  updateSession,
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

type OnboardingFlowProps = {
  accessToken: string;
  userId: string;
  onComplete: () => void;
};

type SubmitResult = {
  assessment: { id: string; proposed_profile_label: string };
  assignment: { id: string; profile_label: string; confirmation_required: boolean };
};

export default function OnboardingFlow({
  accessToken,
  userId: _userId,
  onComplete,
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

  const sessionRef = useRef(sessionId);
  sessionRef.current = sessionId;
  const answersRef = useRef(answers);
  answersRef.current = answers;

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
            onComplete();
            return;
          }
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
        } else {
          const { response: cr, body: cb } = await createSession(accessToken);
          if (cancelled) return;
          if (cr.ok && cb.payload?.session) {
            setSessionId(cb.payload.session.id);
          } else {
            if (!cancelled) setInitError(cb?.message ?? "Failed to create onboarding session.");
          }
        }
      } catch {
        if (!cancelled) setInitError("Failed to load onboarding session. Please check your connection and try again.");
      }
      if (!cancelled) setInitializing(false);
    }
    init();
    return () => {
      cancelled = true;
    };
  }, [accessToken, onComplete, showToast, online]);

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
    const next = stepIndex + 1;
    const nextStep = STEPS[next];
    if (!nextStep) return;
    setStepIndex(next);
    if (sessionRef.current)
      persistStep(sessionRef.current, nextStep.key, answersRef.current);
  }, [stepIndex, persistStep]);

  const goBack = useCallback(() => {
    if (stepIndex <= 0) return;
    setStepIndex((p) => p - 1);
  }, [stepIndex]);

  const saveAnswer = useCallback(
    (key: string, value: unknown) => {
      setAnswers((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const handleIncomeStabilitySelect = useCallback(
    (val: string) => {
      const mapped = val === "very_stable" || val === "stable" ? "stable" : "variable";
      setAnswers((prev) => ({ ...prev, income_stability: val, income_type: mapped }));
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
    },
    [],
  );

  // ── Submit ──
  const handleSubmit = useCallback(async () => {
    const sid = sessionRef.current;
    if (!sid) return;
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
        showToast("Assessment submitted", "success");
      } else {
        setSubmitError(body.message ?? "Submission failed.");
      }
    } catch {
      setSubmitError("Network error. Please try again.");
    }
    setSubmitting(false);
  }, [accessToken, showToast]);

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
    return <ResultScreen result={submitResult} error={submitError} onContinue={onComplete} />;
  }

  const step = STEPS[stepIndex];
  if (!step) return null;

  const isCurrentStepComplete = (() => {
    const val = answers[step.questionKey];
    if (step.kind === "input") return incomeText !== "";
    if (step.kind === "card_multi_select") return Array.isArray(val) && val.length > 0;
    if (step.kind === "review") {
      const required = STEPS.filter((s) => s.kind !== "review" && s.kind !== "result");
      return required.every((s) => {
        const v = answers[s.questionKey];
        if (s.kind === "input") return answers[s.questionKey] !== "" && answers[s.questionKey] !== undefined;
        if (s.kind === "card_multi_select") return Array.isArray(v) && v.length > 0;
        return typeof v === "string" && v !== "";
      }) && obligationAmount !== "";
    }
    return typeof val === "string" && val !== "";
  })();

  return (
    <View className="flex-1 bg-card">
      {/* Progress bar */}
      <View className="flex-row gap-1.5 px-5 pt-12 pb-4">
        {STEPS.map((s) => {
          const isDone = s.index < stepIndex;
          const isCurrent = s.index === stepIndex;
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

        {step.kind === "input" && (
          <InputStep
            step={step}
            value={incomeText}
            onChangeText={(t) => {
              const digits = t.replace(/[^0-9]/g, "");
              setIncomeText(digits);
              saveAnswer(step.questionKey, digits === "" ? "" : digits);
            }}
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
            disabled={submitting || !isCurrentStepComplete}
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
              opacity: submitting || !isCurrentStepComplete ? 0.45 : 1,
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
            disabled={!isCurrentStepComplete}
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
              opacity: !isCurrentStepComplete ? 0.45 : 1,
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
        ) : null}
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

  const EMP_STEP = STEPS[0]!;
  const STAB_STEP = STEPS[1]!;
  const FREQ_STEP = STEPS[2]!;
  const OBL_STEP = STEPS[4]!;
  const DEP_STEP = STEPS[5]!;

  const empLabel = EMP_STEP.options?.find((o) => o.key === answers.employment_status);
  if (empLabel) rows.push({ label: "Employment", value: empLabel.label, stepIndex: 0 });

  const stabLabel = STEPS[1]!.options?.find((o) => o.key === answers.income_stability);
  if (stabLabel) rows.push({ label: "Income Stability", value: stabLabel.label, stepIndex: 1 });

  const freqLabel = FREQ_STEP.options?.find((o) => o.key === answers.pay_frequency);
  if (freqLabel) rows.push({ label: "Pay Frequency", value: freqLabel.label, stepIndex: 2 });

  if (incomeText)
    rows.push({
      label: "Monthly Income",
      value: `PHP ${Number(incomeText).toLocaleString()}`,
      stepIndex: 3,
    });

  const obligations = (answers.fixed_obligation_types as string[] | undefined) ?? [];
  const oblLabels = obligations
    .map((k) => OBL_STEP.options?.find((o) => o.key === k)?.label)
    .filter(Boolean)
    .join(", ");
  if (oblLabels) {
    rows.push({ label: "Obligations", value: oblLabels, stepIndex: 4 });
    if (obligationAmount)
      rows.push({
        label: "Total",
        value: `PHP ${Number(obligationAmount).toLocaleString()}`,
        stepIndex: 4,
      });
  }

  const protectedCats = (answers.protected_categories as string[] | undefined) ?? [];
  const catLabels = protectedCats
    .map((k) => DEP_STEP.options?.find((o) => o.key === k)?.label)
    .filter(Boolean)
    .join(", ");
  if (catLabels) rows.push({ label: "Categories", value: catLabels, stepIndex: 5 });

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
  result,
  error,
  onContinue,
}: {
  result: SubmitResult;
  error: string | null;
  onContinue: () => void;
}) {
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
            This is a deterministic placeholder classification. Odin's ML classifier,
            currently under development, will provide more nuanced profiling in a future update.
          </Text>
        </View>

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
          accessibilityRole="button"
          accessibilityLabel="Continue to Dashboard"
          style={{
            width: "100%",
            height: 54,
            borderRadius: 14,
            backgroundColor: AQUA950,
            justifyContent: "center",
            alignItems: "center",
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
