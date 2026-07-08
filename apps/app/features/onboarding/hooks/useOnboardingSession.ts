import { useCallback, useEffect, useRef, useState } from "react";
import {
  createOnboardingSession,
  getCurrentOnboardingSession,
  updateOnboardingSession,
} from "../api";
import { ONBOARDING_ERRORS, ONBOARDING_STEPS } from "../constants";
import type { OnboardingStepKey } from "../constants";

export type UseOnboardingSessionResult = {
  sessionId: string | null;
  currentStep: OnboardingStepKey;
  answers: Record<string, unknown>;
  goToStep: (step: OnboardingStepKey) => void;
  updateAnswers: (partial: Record<string, unknown>) => void;
  isCreating: boolean;
  isSaving: boolean;
  error: string | null;
  ready: boolean;
};

export function useOnboardingSession(
  accessToken: string,
): UseOnboardingSessionResult {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [currentStep, setCurrentStepState] = useState<OnboardingStepKey>("income_type");
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [isCreating, setIsCreating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const answersRef = useRef(answers);
  answersRef.current = answers;

  useEffect(() => {
    let cancelled = false;

    async function init() {
      setIsCreating(true);
      setError(null);

      try {
        const { response, body } = await getCurrentOnboardingSession(accessToken);

        if (!response.ok && !body.payload) {
          throw new Error(body.message ?? ONBOARDING_ERRORS.session_fetch_failed);
        }

        const existing = body.payload?.session;

        if (existing && existing.status === "in_progress") {
          setSessionId(existing.id);
          if (existing.current_step_key && ONBOARDING_STEPS.includes(existing.current_step_key as OnboardingStepKey)) {
            setCurrentStepState(existing.current_step_key as OnboardingStepKey);
          }
          if (existing.raw_answers) {
            setAnswers(existing.raw_answers as Record<string, unknown>);
          }
          if (!cancelled) setReady(true);
          return;
        }

        const { response: createRes, body: createBody } = await createOnboardingSession(accessToken, {});

        if (!createRes.ok || !createBody.payload?.session) {
          throw new Error(createBody.message ?? ONBOARDING_ERRORS.session_create_failed);
        }

        setSessionId(createBody.payload.session.id);
        if (!cancelled) setReady(true);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : ONBOARDING_ERRORS.generic);
      } finally {
        if (!cancelled) setIsCreating(false);
      }
    }

    init();
    return () => { cancelled = true; };
  }, [accessToken]);

  const goToStep = useCallback((step: OnboardingStepKey) => {
    setCurrentStepState(step);

    if (!sessionId) return;
    setIsSaving(true);
    setError(null);

    updateOnboardingSession(accessToken, sessionId, {
      raw_answers: answersRef.current,
      current_step_key: step,
    })
      .then(({ response, body }) => {
        if (!response.ok) {
          setError(body.message ?? ONBOARDING_ERRORS.session_update_failed);
        }
      })
      .catch(() => setError(ONBOARDING_ERRORS.generic))
      .finally(() => setIsSaving(false));
  }, [accessToken, sessionId]);

  const updateAnswers = useCallback((partial: Record<string, unknown>) => {
    setAnswers((prev) => ({ ...prev, ...partial }));
  }, []);

  return {
    sessionId,
    currentStep,
    answers,
    goToStep,
    updateAnswers,
    isCreating,
    isSaving,
    error,
    ready,
  };
}
