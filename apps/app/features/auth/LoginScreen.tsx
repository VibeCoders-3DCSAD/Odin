import { useEffect, useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { ROUTES } from "../../routes";
import { useAccess } from "./components/AccessProvider";
import { AuthButton, EmailField, InfoCard, PasswordField, SwitchPrompt, TextLink, type NoticeProps } from "./components/AuthControls";
import { AuthScreenLayout } from "./components/AuthScreenLayout";
import { GoogleSignInSection } from "./components/GoogleSignInSection";
import { VerificationPending, verificationPendingCopy } from "./components/VerificationPending";
import { useAuthNotice } from "./hooks/useAuthNotice";
import { useCompleteSignIn } from "./hooks/useCompleteSignIn";
import { isValidEmail } from "./helpers/credentialRules";
import { AuthRequestError, buildAuthState, getErrorMessage, login, verifyEmail } from "./services/authApi";

// Messages other auth routes hand to sign-in via ?notice=; only these keys are shown.
export const loginNotices = {
  "password-updated": { tone: "success", message: "Password updated. Sign in with your new password." },
} satisfies Record<string, NoticeProps>;

type Field = "email" | "password";

export default function LoginScreen({ noticeKey }: { noticeKey?: string }) {
  const { links } = useAccess();
  const { notice, setNotice, ensureOnline } = useAuthNotice(
    noticeKey && noticeKey in loginNotices ? loginNotices[noticeKey as keyof typeof loginNotices] : null);
  const { complete, consentScreen } = useCompleteSignIn();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Field[]>([]);
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);
  const [awaitingVerification, setAwaitingVerification] = useState(false);
  const clearError = (field: Field) => setFieldErrors((current) => current.filter((item) => item !== field));

  // An email verification link lands here: confirm it, then let the user sign in.
  const { verificationToken, clearAuthLinks } = links;
  useEffect(() => {
    if (!verificationToken) return;
    clearAuthLinks();
    verifyEmail(verificationToken).then(() => {
      setUnverifiedEmail(null);
      setAwaitingVerification(false);
      setNotice({ tone: "success", message: "Email verified. You can now log in." });
    }).catch((error) => {
      setAwaitingVerification(true);
      setNotice({ tone: "error", message: getErrorMessage(error) });
    });
  }, [verificationToken, clearAuthLinks]);

  async function handleLogin() {
    if (!email.trim()) {
      setFieldErrors(["email"]);
      setNotice({ tone: "error", message: "Enter your email first." });
      return;
    }
    if (!password) {
      setFieldErrors(["password"]);
      setNotice({ tone: "error", message: "Enter your password first." });
      return;
    }

    setBusy(true);
    try {
      if (!await ensureOnline()) return;
      setNotice({ tone: "default", message: "Signing you in..." });
      const payload = await login(email.trim(), password);
      const accessToken = payload.session?.access_token;
      if (!accessToken) throw new Error("No access token returned.");
      await complete(buildAuthState(accessToken, "password", payload));
      setPassword("");
    } catch (error) {
      if (error instanceof AuthRequestError) {
        setFieldErrors(["email", "password"]);
        if (error.status === 401 && error.code === "email_unverified") {
          setUnverifiedEmail(email.trim());
          setAwaitingVerification(true);
        }
      }
      setNotice({ tone: "error", message: getErrorMessage(error) });
    } finally {
      setBusy(false);
    }
  }

  if (awaitingVerification) {
    return <AuthScreenLayout {...verificationPendingCopy} notice={notice}>
      <VerificationPending email={unverifiedEmail} setNotice={setNotice} ensureOnline={ensureOnline}
        onBackToSignIn={() => { setAwaitingVerification(false); setNotice(null); }} />
    </AuthScreenLayout>;
  }

  return (
    <AuthScreenLayout title="Welcome back" subtitle="Sign in to your Budgie account" notice={notice} overlay={consentScreen}>
      <View className="gap-6">
        <View className="gap-4">
          <EmailField value={email} onChangeText={setEmail} error={fieldErrors.includes("email")} onEdit={() => clearError("email")} />
          <PasswordField label="Password" placeholder="Enter your password" value={password} onChangeText={setPassword}
            error={fieldErrors.includes("password")} onEdit={() => clearError("password")} />
        </View>

        <TextLink label="Forgot password?" align="right" onPress={() => router.push(ROUTES.forgotPassword)} />

        <View className="gap-4">
          <AuthButton disabled={busy || googleBusy || !isValidEmail(email) || !password} label="Sign in" loading={busy} onPress={handleLogin} />
          <GoogleSignInSection disabled={busy || googleBusy} busy={googleBusy} onBusyChange={setGoogleBusy}
            setNotice={setNotice} ensureOnline={ensureOnline} complete={complete} />
        </View>

        {unverifiedEmail ? (
          <InfoCard compact icon="email-check-outline">
            Verification email sent to {unverifiedEmail}. Tap the link there, then come back and sign in.
          </InfoCard>
        ) : null}

        <SwitchPrompt prompt="New to Budgie?" label="Create account" onPress={() => router.push(ROUTES.registration)} />
      </View>
    </AuthScreenLayout>
  );
}
