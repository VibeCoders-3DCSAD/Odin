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
  getCurrentSession,
  submitSession,
  updateSession,
} from "./api";
import { FinancialHealthCard, type Classification } from "../dashboard/components/FinancialHealthCard";
import { STEPS, type StepConfig } from "./types";
import { availableOnboardingStep, currentSeasonalAnswers, withOnboardingAnswer } from "./helpers/seasonalAnswers";
import { SEASONAL_QUESTION_KEYS } from "./helpers/seasonalAnswers";
import { normalizeCustomEvents } from "@odin/spending-insights/seasons";
import { CustomSeasonalEventForm } from "./components/CustomSeasonalEventForm";

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
  restart?: boolean;
};

type SubmitResult = {
  classification_available: boolean;
  assessment?: { output_snapshot?: Classification } | null;
};

function isStepComplete(step: StepConfig, answers: Record<string, unknown>) {
  const value = answers[step.questionKey];
  if (step.kind === "review") return true;
  if (step.kind === "card_multi_select") return Array.isArray(value) && value.length > 0;
  if (step.options) return step.options.some((option) => option.key === value);
  if (step.kind === "amount_list") {
    const selected = (answers[step.amountSourceKey ?? ""] as string[] | undefined) ?? [];
    const selectedKeys = selected.filter((key) => key !== "none");
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    if (selectedKeys.length === 0) return true;
    const amounts = value as Record<string, unknown>;
    return selectedKeys.every((key) => typeof amounts[key] === "string" && amounts[key] !== "");
  }
  return typeof value === "string" && value.trim() !== "";
}

function isStepVisible(step: StepConfig, answers: Record<string, unknown>) {
  if (!step.visibleWhen) return true;
  const answer = answers[step.visibleWhen.questionKey];
  const { value } = step.visibleWhen;
  return typeof value === "string" ? answer === value : typeof answer === "string" && value.includes(answer);
}

function nextVisibleStepIndex(startIndex: number, direction: 1 | -1, answers: Record<string, unknown>) {
  for (let index = startIndex + direction; index >= 0 && index < STEPS.length; index += direction) {
    const step = STEPS[index];
    if (step && isStepVisible(step, answers)) return index;
  }
  return -1;
}

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
            const retainedAnswers = { questionnaire_version: "2", custom_seasonal_events: normalizeCustomEvents(sess.raw_answers?.custom_seasonal_events) };
            const { response: cr, body: cb } = await createSession(accessToken, retainedAnswers);
            setAnswers(retainedAnswers);
            if (cr.ok && cb.payload?.session) setSessionId(cb.payload.session.id);
            else {
              setInitError(cb?.message ?? "Failed to start reassessment.");
              return;
            }
          } else {
            setSessionId(sess.id);
            if (sess.raw_answers) {
              const raw = currentSeasonalAnswers(sess.raw_answers);
              setAnswers(raw);
              if (typeof raw.monthly_income === "string") setIncomeText(raw.monthly_income);
            }
            const savedStepKey = sess.current_step_key;
            const idx = STEPS.findIndex((s) => s.key === savedStepKey);
            if (idx >= 0) setStepIndex(idx);
          }
        } else {
          const initialAnswers = { questionnaire_version: "2" };
          const { response: cr, body: cb } = await createSession(accessToken, initialAnswers);
          setAnswers(initialAnswers);
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
    const currentStep = STEPS[stepIndex];
    if (!currentStep) return;
    if (!isStepComplete(currentStep, answersRef.current)) {
      setFieldErrors({ [currentStep.questionKey]: currentStep.kind === "card_multi_select" ? "Select at least one answer." : "This answer is required." });
      return;
    }
    setFieldErrors({});
    const next = nextVisibleStepIndex(stepIndex, 1, answersRef.current);
    const nextStep = STEPS[next];
    if (!nextStep) return;
    let nextAnswers = answersRef.current;
    if (nextStep.kind === "amount_list" && !nextAnswers[nextStep.questionKey]) {
      nextAnswers = { ...nextAnswers, [nextStep.questionKey]: {} };
      answersRef.current = nextAnswers;
      setAnswers(nextAnswers);
    }
    setStepIndex(next);
    if (sessionRef.current)
      persistStep(sessionRef.current, nextStep.key, nextAnswers);
  }, [stepIndex, persistStep]);

  const goBack = useCallback(() => {
    const previous = nextVisibleStepIndex(stepIndex, -1, answersRef.current);
    if (previous >= 0) setStepIndex(previous);
  }, [stepIndex]);

  const saveAnswer = useCallback(
    (key: string, value: unknown) => {
      setAnswers((prev) => withOnboardingAnswer(prev, key, value));
      setFieldErrors((errors) => {
        const { [key]: _, ...remaining } = errors;
        return remaining;
      });
    },
    [],
  );

  // ── Submit ──
  const handleSubmit = useCallback(async () => {
    const sid = sessionRef.current;
    if (!sid) return;
    const firstIncomplete = STEPS.findIndex((item) => isStepVisible(item, answersRef.current) && !isStepComplete(item, answersRef.current));
    if (firstIncomplete >= 0) {
      setStepIndex(firstIncomplete);
      const missingStep = STEPS[firstIncomplete];
      if (missingStep) setFieldErrors({ [missingStep.questionKey]: "This answer is required." });
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
        setSubmitResult(body.payload);
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
    return <ResultScreen accessToken={accessToken} result={submitResult} error={submitError} onContinue={onComplete} />;
  }

  const visibleSteps = STEPS.filter((item) => isStepVisible(item, answers));
  const visibleStepIndex = visibleSteps.indexOf(STEPS[stepIndex]!);
  const step = STEPS[stepIndex];
  if (!step) return null;

  return (
    <KeyboardAvoider>
    <View className="flex-1 bg-card">
      {/* Progress bar */}
      <View className="flex-row gap-1.5 px-5 pt-12 pb-4">
        {visibleSteps.map((s, i) => {
          const isDone = i < visibleStepIndex;
          const isCurrent = i === visibleStepIndex;
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
      {visibleStepIndex > 0 && (
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
            onSelect={(val) => saveAnswer(step.questionKey, val)}
          />
        )}

        {step.kind === "card_multi_select" && (
          <CardMultiSelectStep
            step={availableOnboardingStep(step, answers)}
            selected={(answers[step.questionKey] as string[]) ?? []}
            onToggle={(val) => {
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
            }}
          />
        )}

        {step.kind === "dropdown" && (
          <DropdownStep
            step={step}
            selected={answers[step.questionKey] as string | undefined}
            onSelect={(val) => saveAnswer(step.questionKey, val)}
          />
        )}

        {SEASONAL_QUESTION_KEYS.includes(step.questionKey) && (
          <CustomSeasonalEventForm
            key={step.questionKey}
            events={normalizeCustomEvents(answers.custom_seasonal_events)}
            onAdd={(event) => {
              saveAnswer("custom_seasonal_events", [...normalizeCustomEvents(answers.custom_seasonal_events), event]);
              const selected = Array.isArray(answers[step.questionKey]) ? answers[step.questionKey] as string[] : [];
              saveAnswer(step.questionKey, [...selected.filter((key) => key !== "none"), event.id]);
            }}
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
                : (t: string) => saveAnswer(
                    step.questionKey,
                    step.allowUnknown && t === "not_sure" ? t : step.inputSuffix ? t.replace(/[^0-9]/g, "") : t,
                  )
            }
          />
        )}

        {step.kind === "amount_list" && (
          <AmountListStep
            step={step}
            selected={(answers[step.amountSourceKey ?? ""] as string[] | undefined) ?? []}
            values={(answers[step.questionKey] as Record<string, string> | undefined) ?? {}}
            onChange={(key, value) => saveAnswer(step.questionKey, {
              ...((answers[step.questionKey] as Record<string, string> | undefined) ?? {}),
              [key]: value.replace(/[^0-9]/g, ""),
            })}
          />
        )}

        {step.kind === "review" && (
          <ReviewStep
            answers={answers}
            onEdit={(idx) => setStepIndex(idx)}
            incomeText={incomeText}
          />
        )}

        {fieldErrors[step.questionKey] ? (
          <Text style={{ color: ERROR, fontFamily: "Manrope", fontSize: 13, fontWeight: "600", marginTop: 12 }}>
            {fieldErrors[step.questionKey]}
          </Text>
        ) : null}


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
        {step.inputSuffix === "PHP" || step.inputSuffix === "%" ? (
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
              {step.inputSuffix}
            </Text>
            <TextInput
              value={value !== "not_sure" && value ? Number(value).toLocaleString() : ""}
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
      {step.allowUnknown ? (
        <Pressable
          accessibilityRole="radio"
          accessibilityLabel="I don't know"
          accessibilityState={{ selected: value === "not_sure" }}
          onPress={() => onChangeText("not_sure")}
          style={{ marginTop: 12, padding: 16, minHeight: 56, borderRadius: 14, borderWidth: 1.5, borderColor: value === "not_sure" ? AQUA600 : LINE, backgroundColor: value === "not_sure" ? AQUA50 : CARD, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
        >
          <Text style={{ color: value === "not_sure" ? AQUA950 : INK2, fontFamily: "Manrope", fontWeight: "700", fontSize: 18 }}>
            I don't know
          </Text>
          {value === "not_sure" ? <Check size={20} color={AQUA600} weight="bold" /> : null}
        </Pressable>
      ) : null}
    </View>
  );
}

function AmountListStep({
  step,
  selected,
  values,
  onChange,
}: {
  step: StepConfig;
  selected: string[];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
}) {
  const options = step.amountOptions?.filter((option) => selected.includes(option.key)) ?? [];
  if (options.length === 0) {
    return (
      <Text style={{ fontFamily: "Manrope", fontSize: 14, color: MUTED }}>
        No amounts are needed for your selection.
      </Text>
    );
  }
  return (
    <View className="gap-4">
      {options.map((option) => (
        <View key={option.key}>
          <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 14, color: INK2, marginBottom: 10 }}>
            {option.label} Monthly Amount
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", borderWidth: 1.5, borderColor: LINE, borderRadius: 14, backgroundColor: CARD }}>
            <Text style={{ fontFamily: "Manrope", fontWeight: "500", fontSize: 12, color: MUTED, paddingLeft: 16 }}>
              PHP
            </Text>
            <TextInput
              value={values[option.key] ? Number(values[option.key]).toLocaleString() : ""}
              onChangeText={(text) => onChange(option.key, text)}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor={MUTED}
              style={{ flex: 1, fontFamily: "Manrope", fontWeight: "700", fontSize: 20, color: INK, padding: 16 }}
            />
          </View>
        </View>
      ))}
    </View>
  );
}

function ReviewStep({
  answers,
  onEdit,
  incomeText,
}: {
  answers: Record<string, unknown>;
  onEdit: (stepIndex: number) => void;
  incomeText: string;
}) {
  const rows: { label: string; value: string; stepIndex: number }[] = [];
  const stepFor = (key: string) => STEPS.find((step) => step.questionKey === key);
  const addOptionRow = (label: string, questionKey: string) => {
    const step = stepFor(questionKey);
    const option = step?.options?.find((item) => item.key === answers[questionKey]);
    if (step && option) rows.push({ label, value: option.label, stepIndex: STEPS.indexOf(step) });
  };
  const addMultiOptionRow = (label: string, questionKey: string) => {
    const originalStep = stepFor(questionKey);
    const step = originalStep ? availableOnboardingStep(originalStep, answers) : undefined;
    const selections = answers[questionKey];
    if (!step || !Array.isArray(selections)) return;
    const labels = selections
      .map((selection) => {
        const option = step.options?.find((item) => item.key === selection);
        return option ? `${option.label}${option.description ? ` (${option.description})` : ""}` : undefined;
      })
      .filter(Boolean)
      .join(", ");
    if (labels && originalStep) rows.push({ label, value: labels, stepIndex: STEPS.indexOf(originalStep) });
  };
  const addAmountMapRows = (questionKey: string) => {
    const step = stepFor(questionKey);
    const values = answers[questionKey];
    if (!step || !values || typeof values !== "object" || Array.isArray(values)) return;
    for (const [key, amount] of Object.entries(values as Record<string, unknown>)) {
      const option = step.amountOptions?.find((item) => item.key === key);
      if (option && typeof amount === "string") {
        rows.push({ label: `${option.label} Monthly Amount`, value: `PHP ${Number(amount).toLocaleString()}`, stepIndex: STEPS.indexOf(step) });
      }
    }
  };

  const displayName = answers.display_name;
  if (displayName && displayName !== "") rows.push({ label: "Name", value: displayName as string, stepIndex: STEPS.findIndex((step) => step.questionKey === "display_name") });

  if (incomeText)
    rows.push({
      label: "Monthly Income After Deductions",
      value: `PHP ${Number(incomeText).toLocaleString()}`,
      stepIndex: STEPS.findIndex((step) => step.questionKey === "monthly_income"),
    });
  addMultiOptionRow("Monthly Deductions", "monthly_deductions");
  addAmountMapRows("monthly_deduction_amounts");
  addOptionRow("Savings Runway", "emergency_savings_runway");
  const emergencySavings = answers.liquid_emergency_savings;
  if (typeof emergencySavings === "string") rows.push({ label: "Emergency Savings", value: `PHP ${Number(emergencySavings).toLocaleString()}`, stepIndex: STEPS.findIndex((step) => step.questionKey === "liquid_emergency_savings") });
  const essentialCosts = answers.monthly_essential_living_costs;
  if (typeof essentialCosts === "string") rows.push({ label: "Monthly Essential Costs", value: essentialCosts === "not_sure" ? "Not sure" : `PHP ${Number(essentialCosts).toLocaleString()}`, stepIndex: STEPS.findIndex((step) => step.questionKey === "monthly_essential_living_costs") });
  addOptionRow("Currently Paying Off Debt", "paying_off_debt");
  const debtPercentage = answers.monthly_debt_payment_percentage;
  if (answers.paying_off_debt === "true" && typeof debtPercentage === "string") rows.push({ label: "Debt Payment Percentage", value: debtPercentage === "not_sure" ? "Not sure" : `${debtPercentage}%`, stepIndex: STEPS.findIndex((step) => step.questionKey === "monthly_debt_payment_percentage") });
  addOptionRow("Credit Card Payments", "credit_card_revolving_months");

  addMultiOptionRow("Higher-Expense Seasons", "high_expense_seasons");
  addMultiOptionRow("Lower-Expense Seasons", "low_expense_seasons");
  addMultiOptionRow("Savings Seasons", "saving_seasons");

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
          Your onboarding information has been saved.
        </Text>

        <View style={{ width: "100%", marginBottom: 20 }}>
          {result.assessment?.output_snapshot ? (
            <FinancialHealthCard accessToken={accessToken} initialClassification={result.assessment.output_snapshot} />
          ) : (
            <Text style={{ fontFamily: "Manrope", fontSize: 14, color: MUTED }}>
              Your classification is unavailable right now. You can try again from the dashboard check-in.
            </Text>
          )}
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
