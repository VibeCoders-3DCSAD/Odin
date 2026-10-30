import { useState } from "react";
import { View } from "react-native";
import { getErrorMessage, resendVerification } from "../services/authApi";
import { AuthButton, InfoCard, TextLink, type NoticeProps } from "./AuthControls";

type Props = {
  email: string | null;
  setNotice: (notice: NoticeProps | null) => void;
  ensureOnline: () => Promise<boolean>;
  onBackToSignIn: () => void;
};

export const verificationPendingCopy = { title: "Verify your email", subtitle: "Confirm your email address to continue." };

// Shown after registering without a session, or signing in before verifying.
export function VerificationPending({ email, setNotice, ensureOnline, onBackToSignIn }: Props) {
  const [busy, setBusy] = useState(false);

  async function handleResend() {
    if (!email) return;
    setBusy(true);
    try {
      if (!await ensureOnline()) return;
      await resendVerification(email);
      setNotice({ tone: "success", message: `A new verification email was sent to ${email}.` });
    } catch (error) {
      setNotice({ tone: "error", message: getErrorMessage(error) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <View className="gap-6">
      <InfoCard icon="email-check-outline">
        Check {email ?? "your inbox"} for Budgie's verification link. The link confirms email ownership and unlocks sign-in.
      </InfoCard>
      <AuthButton disabled={busy || !email} label="Resend verification email" loading={busy} onPress={handleResend} />
      <TextLink label="Back to sign in" onPress={onBackToSignIn} />
    </View>
  );
}
