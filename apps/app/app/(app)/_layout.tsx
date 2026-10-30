import { Stack } from "expo-router";
import { useSession } from "../../features/auth/components/AccessProvider";

// Everything here requires an unlocked session (guarded by the root layout); the shell
// itself also waits until onboarding is submitted.
export default function AppLayout() {
  const { onboardingStatus } = useSession();
  return <Stack screenOptions={{ headerShown: false }}>
    <Stack.Protected guard={onboardingStatus === "submitted"}>
      <Stack.Screen name="(shell)" />
    </Stack.Protected>
    <Stack.Screen name="user-onboarding" />
  </Stack>;
}
