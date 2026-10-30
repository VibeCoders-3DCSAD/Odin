import { Redirect } from "expo-router";
import { ROUTES } from "../routes";
import { useAccess } from "../features/auth/components/AccessProvider";
import { useAuthStore } from "../features/auth/stores/useAuthStore";

// The navigator mounts here after sign-in, unlock or a reset link; send the user to where they belong.
export default function Index() {
  const { links } = useAccess();
  const phase = useAuthStore((state) => state.phase);
  const onboardingStatus = useAuthStore((state) => state.account?.session.onboardingStatus);
  if (phase !== "unlocked") {
    // "recovery" also means "sign in again" (forgot PIN, expired verification); only a reset link opens Forgot password.
    const fromResetLink = links.isPasswordRecovery || links.isResolvingRecoveryToken;
    return <Redirect href={fromResetLink ? ROUTES.forgotPassword : ROUTES.login} />;
  }
  if (onboardingStatus !== "submitted") return <Redirect href={ROUTES.userOnboarding} />;
  return <Redirect href={ROUTES.dashboard} />;
}
