import { Text, View } from "react-native";
import { bootstrapSession, buildAuthState, getErrorMessage } from "../services/authApi";
import { startGoogleSignIn } from "../services/googleSignIn";
import type { AuthenticatedState } from "../types";
import { AuthButton, type NoticeProps } from "./AuthControls";

type Props = {
  disabled: boolean;
  busy: boolean;
  onBusyChange: (busy: boolean) => void;
  setNotice: (notice: NoticeProps | null) => void;
  ensureOnline: () => Promise<boolean>;
  complete: (authState: AuthenticatedState) => Promise<void>;
};

// "or continue with Google", shared by sign-in and registration.
export function GoogleSignInSection({ disabled, busy, onBusyChange, setNotice, ensureOnline, complete }: Props) {
  async function handleGoogle() {
    onBusyChange(true);
    try {
      if (!await ensureOnline()) return;
      setNotice({ tone: "default", message: "Opening Google sign-in..." });
      const session = await startGoogleSignIn();
      const payload = await bootstrapSession(session.accessToken);
      await complete(buildAuthState(session.accessToken, "google", payload, session.refreshToken));
    } catch (error) {
      const message = getErrorMessage(error);
      setNotice({ tone: "error", message: /cancelled/i.test(message) ? "Google login cancelled." : message });
    } finally {
      onBusyChange(false);
    }
  }

  return <>
    <View className="flex-row items-center gap-3">
      <View className="flex-1 h-[1px] bg-accent" />
      <Text className="text-subtle text-xs font-semibold">or continue with</Text>
      <View className="flex-1 h-[1px] bg-accent" />
    </View>
    <AuthButton disabled={disabled} icon="google" label="Google" loading={busy} onPress={handleGoogle} tone="secondary" />
  </>;
}
