import { Redirect } from "expo-router";
import { ROUTES } from "../Routes";
import { useAuthStore } from "../features/auth/stores/useAuthStore";

// The navigator mounts here after sign-in or unlock; send the user to where they belong.
export default function Index() {
  const phase = useAuthStore((state) => state.phase);
  const onboardingStatus = useAuthStore((state) => state.account?.session.onboardingStatus);
  if (phase !== "unlocked") return <Redirect href={ROUTES.login} />;
  return <Redirect href={onboardingStatus === "submitted" ? ROUTES.dashboard : ROUTES.userOnboarding} />;
}
