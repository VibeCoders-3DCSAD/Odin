import { useState } from "react";
import { Text, View } from "react-native";
import { router } from "expo-router";
import { ROUTES } from "../../Routes";
import { AuthButton, EmailField, PasswordField, PasswordRules, SwitchPrompt, TextField } from "./components/AuthControls";
import { AuthScreenLayout } from "./components/AuthScreenLayout";
import { GoogleSignInSection } from "./components/GoogleSignInSection";
import { VerificationPending, verificationPendingCopy } from "./components/VerificationPending";
import { useAuthNotice } from "./hooks/useAuthNotice";
import { useCompleteSignIn } from "./hooks/useCompleteSignIn";
import { getPasswordChecks, isStrongPassword, isValidEmail } from "./helpers/credentialRules";
import { bootstrapSession, buildAuthState, getErrorMessage, register } from "./services/authApi";

type Field = "email" | "password" | "confirm_password";

export default function RegistrationScreen() {
  const { notice, setNotice, ensureOnline } = useAuthNotice();
  const { complete, consentScreen } = useCompleteSignIn();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Field[]>([]);
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  // Set once registration succeeds without a session: the account awaits email verification.
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);
  const clearError = (field: Field) => setFieldErrors((current) => current.filter((item) => item !== field));

  const emailValid = isValidEmail(email);
  const passwordValid = isStrongPassword(password);
  const confirmValid = password !== "" && confirmPassword === password;
  const backToSignIn = () => router.dismissTo(ROUTES.login);

  async function handleRegister() {
    if (!emailValid) {
      setFieldErrors(["email"]);
      setNotice({ tone: "error", message: "Use a valid email to create your account." });
      return;
    }
    if (!passwordValid) {
      setFieldErrors(["password"]);
      setNotice({ tone: "error", message: "Your password does not meet the requirements." });
      return;
    }
    if (!confirmValid) {
      setFieldErrors(["confirm_password"]);
      setNotice({ tone: "error", message: "Your passwords do not match yet." });
      return;
    }

    setBusy(true);
    try {
      if (!await ensureOnline()) return;
      setNotice({ tone: "default", message: "Creating your Budgie account..." });
      const payload = await register(email.trim(), password, displayName.trim() || undefined);
      const accessToken = payload.session?.access_token;

      if (accessToken) {
        const session = await bootstrapSession(accessToken);
        await complete(buildAuthState(accessToken, "password", {
          ...session, user: { id: session.user?.id ?? payload.user?.id }, session: payload.session,
        }));
        setNotice({ tone: "success", message: "Account created. One more step." });
      } else {
        setUnverifiedEmail(email.trim());
        setNotice(null);
      }
      setPassword("");
      setConfirmPassword("");
    } catch (error) {
      setNotice({ tone: "error", message: getErrorMessage(error) });
    } finally {
      setBusy(false);
    }
  }

  if (unverifiedEmail) {
    return <AuthScreenLayout {...verificationPendingCopy} notice={notice}>
      <VerificationPending email={unverifiedEmail} setNotice={setNotice} ensureOnline={ensureOnline} onBackToSignIn={backToSignIn} />
    </AuthScreenLayout>;
  }

  return (
    <AuthScreenLayout title="Create account" subtitle="Set up your Budgie account" notice={notice} overlay={consentScreen}>
      <View className="gap-6">
        <View className="gap-4">
          <TextField label="Full name" placeholder="Juan dela Cruz" icon="account-outline" value={displayName} onChangeText={setDisplayName} />
          <EmailField value={email} onChangeText={setEmail} error={fieldErrors.includes("email")} onEdit={() => clearError("email")} />
          <PasswordField label="Create password" placeholder="Enter your password" value={password} valid={passwordValid}
            onChangeText={(next) => { setPassword(next); setPasswordTouched(true); }}
            error={fieldErrors.includes("password")} onEdit={() => clearError("password")} />
          {passwordTouched ? <PasswordRules checks={getPasswordChecks(password)} /> : null}
          <PasswordField label="Confirm password" placeholder="Re-enter your password" icon="shield-check-outline"
            value={confirmPassword} onChangeText={setConfirmPassword} valid={confirmValid}
            error={fieldErrors.includes("confirm_password")} onEdit={() => clearError("confirm_password")} />
        </View>

        <Text className="text-subtle text-xs leading-[18px]">
          By creating an account, you agree to continue through Budgie's verification and onboarding flow.
        </Text>

        <View className="gap-4">
          <AuthButton disabled={busy || googleBusy || !emailValid || !passwordValid || !confirmValid}
            label="Create account" loading={busy} onPress={handleRegister} />
          <GoogleSignInSection disabled={busy || googleBusy} busy={googleBusy} onBusyChange={setGoogleBusy}
            setNotice={setNotice} ensureOnline={ensureOnline} complete={complete} />
        </View>

        <SwitchPrompt prompt="Already have an account?" label="Sign in" onPress={backToSignIn} />
      </View>
    </AuthScreenLayout>
  );
}
