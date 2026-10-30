import { useState } from "react";
import { Text, View } from "react-native";
import { router } from "expo-router";
import { ROUTES } from "../../Routes";
import { useAccess } from "./components/AccessProvider";
import { AuthButton, EmailField, InfoCard, Notice, PasswordField, PasswordRules, SwitchPrompt } from "./components/AuthControls";
import { AuthScreenLayout } from "./components/AuthScreenLayout";
import { useAuthNotice } from "./hooks/useAuthNotice";
import { getPasswordChecks, isStrongPassword, isValidEmail } from "./helpers/credentialRules";
import { AuthRequestError, getErrorMessage, requestPasswordReset, updatePassword } from "./services/authApi";

type Field = "email" | "password" | "confirm_password";

// Without a reset link this asks for the email to send one to; opened from the link
// (odin://auth/reset), it sets the new password.
export default function ForgotPasswordScreen() {
  const { links } = useAccess();
  const fromResetLink = links.isPasswordRecovery || Boolean(links.recoveryToken);
  return fromResetLink ? <ChooseNewPassword /> : <RequestResetLink />;
}

function backToSignIn(clearAuthLinks: () => void, params?: { notice: string }) {
  clearAuthLinks();
  router.dismissTo({ pathname: ROUTES.login, params });
}

function RequestResetLink() {
  const { links } = useAccess();
  const { notice, setNotice, ensureOnline } = useAuthNotice();
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState(false);
  const [busy, setBusy] = useState(false);
  const emailValid = isValidEmail(email);

  async function handleRequest() {
    if (!emailValid) {
      setEmailError(true);
      setNotice({ tone: "error", message: "Enter a valid registered email." });
      return;
    }

    setBusy(true);
    try {
      if (!await ensureOnline()) return;
      setNotice({ tone: "default", message: "Sending your reset link..." });
      await requestPasswordReset(email.trim());
      setNotice({ tone: "success", message: "If that email exists, a reset link is on the way now." });
    } catch (error) {
      setNotice({ tone: "error", message: getErrorMessage(error) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthScreenLayout title="Forgot password" subtitle="We'll email you a link to reset it." notice={notice}>
      <View className="gap-6">
        <EmailField value={email} onChangeText={setEmail} error={emailError} onEdit={() => setEmailError(false)}
          placeholder="Enter your registered email" />
        <AuthButton disabled={busy || !emailValid} label="Send reset link" loading={busy} onPress={handleRequest} />
        <SwitchPrompt prompt="Remember your password?" label="Sign in" onPress={() => backToSignIn(links.clearAuthLinks)} />
      </View>
    </AuthScreenLayout>
  );
}

function ChooseNewPassword() {
  const { links } = useAccess();
  const { notice, setNotice, ensureOnline } = useAuthNotice();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Field[]>([]);
  const [busy, setBusy] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);
  const clearError = (field: Field) => setFieldErrors((current) => current.filter((item) => item !== field));

  const recoveryToken = links.recoveryToken?.trim() ?? "";
  const recoveryRefreshToken = links.recoveryRefreshToken?.trim() ?? "";
  const sessionReady = Boolean(recoveryToken && recoveryRefreshToken);
  const passwordValid = isStrongPassword(password);
  const confirmValid = password !== "" && confirmPassword === password;

  async function handleUpdate() {
    if (!password) {
      setFieldErrors(["password"]);
      setNotice({ tone: "error", message: "Choose a new password first." });
      return;
    }
    if (password !== confirmPassword) {
      setFieldErrors(["confirm_password"]);
      setNotice({ tone: "error", message: "Your new passwords do not match yet." });
      return;
    }
    if (!sessionReady) {
      setNotice({ tone: "error", message: "Recovery session missing. Request a new reset link and open it on this device." });
      return;
    }

    setBusy(true);
    try {
      if (!await ensureOnline()) return;
      setNotice({ tone: "default", message: "Updating your password..." });
      await updatePassword(password, recoveryToken, recoveryRefreshToken);
      backToSignIn(links.clearAuthLinks, { notice: "password-updated" });
    } catch (error) {
      // A rejected recovery session gets its own screen; the generic 401 copy ("Invalid email or password") would mislead.
      if (error instanceof AuthRequestError && error.status === 401) {
        setNotice(null);
        setSessionExpired(true);
      } else setNotice({ tone: "error", message: getErrorMessage(error) });
    } finally {
      setBusy(false);
    }
  }

  if (sessionExpired) {
    return (
      <AuthScreenLayout title="Session expired" subtitle="Sign in again to continue securely." notice={notice}>
        <View className="gap-6">
          <InfoCard icon="lock-clock">Your secure session is no longer valid. Sign in again to protect your account.</InfoCard>
          <AuthButton label="Sign in again" onPress={() => backToSignIn(links.clearAuthLinks)} />
        </View>
      </AuthScreenLayout>
    );
  }

  let sessionStatus = <Notice tone="error" message="This reset link did not include a recovery session. Request a new reset link and open it on this device." />;
  if (sessionReady) sessionStatus = <Text className="text-brand text-xs font-bold">Reset session ready.</Text>;
  else if (links.isResolvingRecoveryToken) sessionStatus = <Text className="text-subtle text-xs leading-[18px]">Opening your reset session...</Text>;

  return (
    <AuthScreenLayout title="Reset your password" subtitle="Choose a new password for your account." notice={notice}>
      <View className="gap-6">
        <View className="gap-4">
          {sessionStatus}
          <PasswordField label="New password" placeholder="Enter new password" value={password} valid={passwordValid}
            onChangeText={(next) => { setPassword(next); setPasswordTouched(true); }}
            error={fieldErrors.includes("password")} onEdit={() => clearError("password")} />
          <PasswordField label="Confirm new password" placeholder="Repeat new password" icon="shield-check-outline"
            value={confirmPassword} onChangeText={setConfirmPassword} valid={confirmValid}
            error={fieldErrors.includes("confirm_password")} onEdit={() => clearError("confirm_password")} />
          {passwordTouched ? <PasswordRules checks={getPasswordChecks(password)} /> : null}
        </View>
        <AuthButton disabled={busy || !sessionReady || !passwordValid || !confirmValid} label="Update password" loading={busy} onPress={handleUpdate} />
        <SwitchPrompt prompt="Remember your password?" label="Sign in" onPress={() => backToSignIn(links.clearAuthLinks)} />
      </View>
    </AuthScreenLayout>
  );
}
