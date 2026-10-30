import { useState } from "react";
import { Redirect, useLocalSearchParams } from "expo-router";
import OnboardingFlow from "../../features/onboarding/OnboardingFlow";
import { useSession } from "../../features/auth/components/AccessProvider";
import { useAuthStore } from "../../features/auth/stores/useAuthStore";
import { ROUTES } from "../../Routes";

// ?restart=1 reopens a submitted profile for reassessment from Settings.
export default function UserOnboarding() {
  const { accessToken, userId, onboardingStatus } = useSession();
  const { restart } = useLocalSearchParams<{ restart?: string }>();
  const [completed, setCompleted] = useState(false);
  // Redirect only after the stored status flips, so the dashboard guard is already open.
  if (completed && onboardingStatus === "submitted") return <Redirect href={ROUTES.dashboard} />;
  return <OnboardingFlow accessToken={accessToken} userId={userId} restart={restart === "1"}
    onComplete={() => { void useAuthStore.getState().updateOnboarding().then(() => setCompleted(true)); }} />;
}
