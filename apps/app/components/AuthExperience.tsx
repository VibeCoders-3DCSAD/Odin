import { MaterialCommunityIcons } from "@expo/vector-icons";
import { type ReactNode, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { getConsents } from "../features/governance/api";
import PrivacyConsentScreen from "../features/governance/PrivacyConsentScreen";

const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://localhost:3001";
const requestTimeoutMs = 10_000;
const odinLogo = require("../assets/odin-logo.png");

type AuthMode = "login" | "register" | "reset_password" | "reset_complete";
type AuthProvider = "password" | "google";
type NoticeTone = "default" | "success" | "error";

type AuthResponse = {
  payload?: {
    session?: {
      access_token?: string;
      refresh_token?: string;
    };
    user?: { id?: string };
    profile?: { id?: string };
    onboarding?: { status?: string };
    privacy_settings?: { personalization_enabled?: boolean };
    activation?: {
      email_confirmation_required?: boolean;
      delivery?: string;
    };
    requested?: boolean;
    updated?: boolean;
    logged_out?: boolean;
  };
  error?: string;
  message?: string;
};

type AuthenticatedState = {
  accessToken: string;
  provider: AuthProvider;
  userId?: string;
  profileId?: string;
  onboardingStatus?: string;
};

type GoogleAuthConfig = {
  signIn?: () => Promise<{ accessToken: string; userId: string; refreshToken?: string }>;
  signOut?: () => Promise<void>;
};

export type { AuthenticatedState };

type AuthExperienceProps = {
  google: GoogleAuthConfig;
  isPasswordRecovery?: boolean;
  isResolvingRecoveryToken?: boolean;
  recoveryRefreshToken?: string;
  recoveryToken?: string;
  isEmailVerification?: boolean;
  isResolvingVerification?: boolean;
  verificationToken?: string;
  verificationRefreshToken?: string;
  onAuthenticated: (state: AuthenticatedState) => void;
  onLoggedOut: () => void;
};

const palette = {
  cta: "#013220",
  link: "#12D583",
  brand: "#12D583",
  heading: "#1B1C1A",
  text: "#414942",
  subtle: "#6B7A6F",
  accent: "#F8EFDC",
  canvas: "#E7E5DF",
  success: "#12D583",
  white: "#FFFFFF",
  dangerSoft: "#FFF0F2",
  successSoft: "#EFFEF7",
  error: "#D9001F",
};

async function postJson(
  path: string,
  payload?: Record<string, unknown>,
  accessToken?: string,
) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), requestTimeoutMs);

  try {
    const response = await fetch(`${apiBaseUrl}/odin/api/auth${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: payload ? JSON.stringify({ payload }) : undefined,
      signal: controller.signal,
    });

    let body: AuthResponse = {};

    try {
      body = await response.json() as AuthResponse;
    } catch {
      body = {};
    }

    return { response, body };
  } finally {
    clearTimeout(timeoutId);
  }
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.name === "AbortError") {
    return "The request timed out. Check the API and try again.";
  }

  return error instanceof Error ? error.message : "Something went wrong.";
}

function FieldLabel({ children }: { children: string }) {
  return (
    <Text className="text-ink2 text-[12.5px] font-semibold">
      {children}
    </Text>
  );
}

type AuthFieldProps = {
  label: string;
  value: string;
  placeholder: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  secureTextEntry?: boolean;
  keyboardType?: "default" | "email-address";
  autoCapitalize?: "none" | "words";
  onChangeText: (value: string) => void;
  onFocus: () => void;
  onBlur: () => void;
  focused: boolean;
  trailing?: ReactNode;
};

function AuthField({
  label,
  value,
  placeholder,
  icon,
  secureTextEntry,
  keyboardType = "default",
  autoCapitalize = "none",
  onChangeText,
  onFocus,
  onBlur,
  focused,
  trailing,
}: AuthFieldProps) {
  return (
    <View className="gap-2">
      <FieldLabel>{label}</FieldLabel>
      <View
        className={`min-h-[52px] rounded-[14px] border px-4 flex-row items-center gap-3 ${
          focused ? "border-aqua500 bg-card" : "border-line bg-surface"
        }`}
      >
        <MaterialCommunityIcons color={palette.brand} name={icon} size={18} />
        <TextInput
          autoCapitalize={autoCapitalize}
          autoCorrect={false}
          keyboardType={keyboardType}
          onBlur={onBlur}
          onChangeText={onChangeText}
          onFocus={onFocus}
          placeholder={placeholder}
          placeholderTextColor={palette.subtle}
          secureTextEntry={secureTextEntry}
          className="flex-1 text-heading text-base leading-[20px] font-medium py-4"
          value={value}
        />
        {trailing}
      </View>
    </View>
  );
}

type AuthButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  tone?: "primary" | "secondary";
  icon?: keyof typeof MaterialCommunityIcons.glyphMap;
};

function AuthButton({
  label,
  onPress,
  disabled,
  loading,
  tone = "primary",
  icon,
}: AuthButtonProps) {
  const primary = tone === "primary";

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      onPress={onPress}
      className={`min-h-[54px] rounded-[14px] border items-center justify-center px-4 ${
        primary
          ? "bg-aqua950 border-aqua950"
          : "bg-card border-line"
      } ${disabled || loading ? "opacity-50" : "active:opacity-90"}`}
      style={primary && !disabled && !loading ? { shadowColor: "rgba(1,50,32,0.28)", shadowOffset: { width: 0, height: 4 }, shadowRadius: 8, elevation: 4 } : undefined}
    >
      {loading ? (
        <ActivityIndicator color={primary ? palette.white : palette.brand} />
      ) : (
        <View className="flex-row items-center justify-center gap-2">
          {icon ? (
            <MaterialCommunityIcons
              color={primary ? palette.white : palette.heading}
              name={icon}
              size={18}
            />
          ) : null}
          <Text
            className={`${
              primary ? "text-white" : "text-heading"
            } text-base leading-[20px] font-bold`}
          >
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

type NoticeProps = {
  tone: NoticeTone;
  message: string;
};

function Notice({ tone, message }: NoticeProps) {
  const bgClass = tone === "error"
    ? "bg-errorSoft"
    : "bg-aqua50";
  const iconColor = tone === "error"
    ? palette.error
    : palette.brand;
  const iconName = tone === "error"
    ? "alert-circle-outline"
    : tone === "success"
    ? "check-circle-outline"
    : "information-outline";

  return (
    <View className={`rounded-[16px] p-4 flex-row items-start gap-3 ${bgClass}`}>
      <MaterialCommunityIcons color={iconColor} name={iconName} size={18} />
      <Text className="flex-1 text-heading text-xs leading-[18px] font-medium">{message}</Text>
    </View>
  );
}

export default function AuthExperience({
  google,
  isPasswordRecovery,
  isResolvingRecoveryToken,
  recoveryRefreshToken: recoveryRefreshTokenProp,
  recoveryToken: recoveryTokenProp,
  isEmailVerification,
  isResolvingVerification,
  verificationToken: verificationTokenProp,
  verificationRefreshToken: verificationRefreshTokenProp,
  onAuthenticated,
  onLoggedOut,
}: AuthExperienceProps) {
  const [mode, setMode] = useState<AuthMode>("login");
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState<string | null>(null);
  const [notice, setNotice] = useState<NoticeProps | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [isGoogleBusy, setIsGoogleBusy] = useState(false);
  const [recoveryToken, setRecoveryToken] = useState(recoveryTokenProp ?? "");
  const [recoveryRefreshToken, setRecoveryRefreshToken] = useState(recoveryRefreshTokenProp ?? "");
  const [showConsent, setShowConsent] = useState(false);
  const [pendingAuthState, setPendingAuthState] = useState<{
    accessToken: string; provider: AuthProvider; userId?: string; profileId?: string; onboardingStatus?: string;
  } | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const verifTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (notice) {
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
      noticeTimer.current = setTimeout(() => setNotice(null), 5000);
    }
    return () => { if (noticeTimer.current) clearTimeout(noticeTimer.current); };
  }, [notice]);

  useEffect(() => {
    if (pendingVerificationEmail) {
      if (verifTimer.current) clearTimeout(verifTimer.current);
      verifTimer.current = setTimeout(() => setPendingVerificationEmail(null), 5000);
    }
    return () => { if (verifTimer.current) clearTimeout(verifTimer.current); };
  }, [pendingVerificationEmail]);

  useEffect(() => {
    if (isPasswordRecovery || recoveryTokenProp || recoveryRefreshTokenProp) {
      if (recoveryTokenProp) {
        setRecoveryToken(recoveryTokenProp);
      }
      if (recoveryRefreshTokenProp) {
        setRecoveryRefreshToken(recoveryRefreshTokenProp);
      }
      setMode("reset_complete");
    }
  }, [isPasswordRecovery, recoveryRefreshTokenProp, recoveryTokenProp]);

  useEffect(() => {
    if (!verificationTokenProp) return;
    setPendingVerificationEmail(null);
    setNotice({ tone: "success", message: "Email verified! You can now log in." });
    setMode("login");
  }, [verificationTokenProp]);

  async function bootstrapSession(token: string) {
    const { response, body } = await postJson("/session", undefined, token);

    if (!response.ok) {
      throw new Error(body.message ?? "Failed to restore your session.");
    }

    return body;
  }

  function resetSensitiveFields() {
    setPassword("");
    setConfirmPassword("");
    setShowPassword(false);
    setShowConfirmPassword(false);
  }

  async function handleLogin() {
    if (!email.trim()) {
      setNotice({ tone: "error", message: "Enter your email first." });
      return;
    }

    if (!password) {
      setNotice({ tone: "error", message: "Enter your password first." });
      return;
    }

    setIsBusy(true);
    setNotice({ tone: "default", message: "Signing you in..." });

    try {
      const { response, body } = await postJson("/login", {
        email: email.trim(),
        password,
      });

      if (!response.ok) {
        throw new Error(body.message ?? "Sign in failed.");
      }

      const accessToken = body.payload?.session?.access_token;
      if (!accessToken) throw new Error("No access token returned.");

      const authState = {
        accessToken,
        provider: "password" as const,
        userId: body.payload?.user?.id,
        profileId: body.payload?.profile?.id,
        onboardingStatus: body.payload?.onboarding?.status,
      };

      const consentsRes = await getConsents(accessToken).catch(() => ({ body: {} }));
      const existingConsents = (consentsRes.body as { payload?: unknown[] }).payload;
      if (existingConsents && existingConsents.length > 0) {
        onAuthenticated(authState);
        setPendingVerificationEmail(null);
      } else {
        setPendingAuthState(authState);
        setShowConsent(true);
      }

      resetSensitiveFields();
    } catch (error) {
      setNotice({ tone: "error", message: getErrorMessage(error) });
    } finally {
      setIsBusy(false);
    }
  }

  async function handleRegister() {
    if (!email.trim()) {
      setNotice({ tone: "error", message: "Use a valid email to create your account." });
      return;
    }

    if (!password) {
      setNotice({ tone: "error", message: "Choose a password before continuing." });
      return;
    }

    if (password !== confirmPassword) {
      setNotice({ tone: "error", message: "Your passwords do not match yet." });
      return;
    }

    setIsBusy(true);
    setNotice({ tone: "default", message: "Creating your Odin account..." });

    try {
      const { response, body } = await postJson("/register", {
        email: email.trim(),
        password,
        display_name: displayName.trim() || undefined,
      });

      if (!response.ok) {
        throw new Error(body.message ?? "Registration failed.");
      }

      const accessToken = body.payload?.session?.access_token;

      if (accessToken) {
        const bootstrappedBody = await bootstrapSession(accessToken);
        const authState = {
          accessToken,
          provider: "password" as const,
          userId: bootstrappedBody.payload?.user?.id ?? body.payload?.user?.id,
          profileId: bootstrappedBody.payload?.profile?.id,
          onboardingStatus: bootstrappedBody.payload?.onboarding?.status,
        };
        setPendingAuthState(authState);
        setShowConsent(true);
        setNotice({ tone: "success", message: "Account created. One more step." });
      } else {
        setPendingVerificationEmail(email.trim());
        setMode("login");
        setNotice(null);
      }

      resetSensitiveFields();
    } catch (error) {
      setNotice({ tone: "error", message: getErrorMessage(error) });
    } finally {
      setIsBusy(false);
    }
  }

  async function handlePasswordReset() {
    if (!email.trim()) {
      setNotice({ tone: "error", message: "Enter your email first so we know where to send the reset link." });
      return;
    }

    setIsBusy(true);
    setNotice({ tone: "default", message: "Sending your reset link..." });

    try {
      const { response, body } = await postJson("/password-reset", {
        email: email.trim(),
      });

      if (!response.ok) {
        throw new Error(body.message ?? "Password reset failed.");
      }

      setNotice({
        tone: "success",
        message: "If that email exists, a reset link is on the way now.",
      });
    } catch (error) {
      setNotice({ tone: "error", message: getErrorMessage(error) });
    } finally {
      setIsBusy(false);
    }
  }

  async function handlePasswordUpdate() {
    if (!password) {
      setNotice({ tone: "error", message: "Choose a new password first." });
      return;
    }

    if (password !== confirmPassword) {
      setNotice({ tone: "error", message: "Your new passwords do not match yet." });
      return;
    }

    const recoveryAccessToken = recoveryToken.trim();
    const recoveryRefreshSessionToken = recoveryRefreshToken.trim();

    if (!recoveryAccessToken || !recoveryRefreshSessionToken) {
      setNotice({ tone: "error", message: "Recovery session missing. Request a new reset link and open it on this device." });
      return;
    }

    setIsBusy(true);
    setNotice({ tone: "default", message: "Updating your password..." });

    try {
      const { response, body } = await postJson(
        "/password-update",
        {
          password,
          refresh_token: recoveryRefreshSessionToken,
        },
        recoveryAccessToken,
      );

      if (!response.ok) {
        throw new Error(body.message ?? "Password update failed.");
      }

      setMode("login");
      resetSensitiveFields();
      setRecoveryToken("");
      setRecoveryRefreshToken("");
      setNotice({
        tone: "success",
        message: "Password updated. Sign in with your new password.",
      });
    } catch (error) {
      setNotice({ tone: "error", message: getErrorMessage(error) });
    } finally {
      setIsBusy(false);
    }
  }

  async function handleGoogle() {
    if (!google.signIn) {
      return;
    }

    setIsGoogleBusy(true);
    setNotice({ tone: "default", message: "Opening Google sign-in..." });

    try {
      const session = await google.signIn();

      const body = await bootstrapSession(session.accessToken);

      const authState = {
        accessToken: session.accessToken,
        provider: "google" as const,
        userId: body.payload?.user?.id,
        profileId: body.payload?.profile?.id,
        onboardingStatus: body.payload?.onboarding?.status,
      };

      const consentsRes = await getConsents(session.accessToken).catch(() => ({ body: {} }));
      const existingConsents = (consentsRes.body as { payload?: unknown[] }).payload;
      if (existingConsents && existingConsents.length > 0) {
        onAuthenticated(authState);
        setPendingVerificationEmail(null);
      } else {
        setPendingAuthState(authState);
        setShowConsent(true);
      }
    } catch (error) {
      setNotice({ tone: "error", message: getErrorMessage(error) });
    } finally {
      setIsGoogleBusy(false);
    }
  }

  const title = mode === "login" ? "Welcome back" : mode === "reset_complete" ? "Reset your password" : "Create account";
  const subtitle = mode === "login"
    ? "Sign in to your Odin account"
    : mode === "reset_complete"
    ? "Choose a new password for your account."
    : "Set up your Odin account";

  return (
    <View className="flex-1 bg-card">
      <SafeAreaView className="flex-1">
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{ flex: 1 }}
        >
          <ScrollView contentContainerClassName="flex-grow px-7 py-10" keyboardShouldPersistTaps="handled">
            <View className="w-full max-w-[420px] self-center flex-1 justify-center gap-8">
            <View className="items-center gap-5">
            <View className="w-[64px] h-[64px] rounded-[32px] border-[3px] border-aqua950 items-center justify-center">
              <Image
                resizeMode="contain"
                source={odinLogo}
                className="w-[48px] h-[48px]"
              />
            </View>
            <View className="items-center gap-1">
              <Text className="text-ink text-[26px] leading-[32px] font-extrabold text-center">{title}</Text>
              <Text className="text-ink2 text-base text-center">{subtitle}</Text>
            </View>
          </View>

          <View className="gap-6">
            {mode === "reset_password" ? (
              <View className="gap-6">
                <View className="gap-4">
                  <AuthField
                    focused={focusedField === "email"}
                    icon="email-outline"
                    keyboardType="email-address"
                    label="Email"
                    onBlur={() => setFocusedField(null)}
                    onChangeText={setEmail}
                    onFocus={() => setFocusedField("email")}
                    placeholder="you@example.com"
                    value={email}
                  />
                </View>

                <AuthButton
                  disabled={isBusy}
                  label="Send reset link"
                  loading={isBusy}
                  onPress={handlePasswordReset}
                />

                <View className="flex-row flex-wrap items-center justify-center gap-2">
                  <Text className="text-subtle text-xs">Remember your password?</Text>
                  <Pressable onPress={() => { setMode("login"); }}>
                    <Text className="text-brand text-xs font-bold">Sign in</Text>
                  </Pressable>
                </View>
              </View>
            ) : mode === "reset_complete" ? (
              <View className="gap-6">
                <View className="gap-4">
                  {!recoveryToken || !recoveryRefreshToken ? (
                    <Text className="text-subtle text-xs leading-[18px]">
                      {isResolvingRecoveryToken
                        ? "Opening your reset session..."
                        : "This reset link did not include a recovery session. Request a new reset link and open it on this device."}
                    </Text>
                  ) : null}
                  {recoveryToken && recoveryRefreshToken ? (
                    <Text className="text-brand text-xs font-bold">Reset session ready.</Text>
                  ) : null}
                  <AuthField
                    focused={focusedField === "password"}
                    icon="lock-outline"
                    label="New password"
                    onBlur={() => setFocusedField(null)}
                    onChangeText={setPassword}
                    onFocus={() => setFocusedField("password")}
                    placeholder="Enter new password"
                    secureTextEntry={!showPassword}
                    trailing={
                      <Pressable onPress={() => setShowPassword((value) => !value)}>
                        <MaterialCommunityIcons
                          color={palette.subtle}
                          name={showPassword ? "eye-off-outline" : "eye-outline"}
                          size={18}
                        />
                      </Pressable>
                    }
                    value={password}
                  />
                  <AuthField
                    focused={focusedField === "confirm_password"}
                    icon="shield-check-outline"
                    label="Confirm new password"
                    onBlur={() => setFocusedField(null)}
                    onChangeText={setConfirmPassword}
                    onFocus={() => setFocusedField("confirm_password")}
                    placeholder="Repeat new password"
                    secureTextEntry={!showConfirmPassword}
                    trailing={
                      <Pressable onPress={() => setShowConfirmPassword((value) => !value)}>
                        <MaterialCommunityIcons
                          color={palette.subtle}
                          name={showConfirmPassword ? "eye-off-outline" : "eye-outline"}
                          size={18}
                        />
                      </Pressable>
                    }
                    value={confirmPassword}
                  />
                </View>

                <AuthButton
                  disabled={isBusy || !recoveryToken || !recoveryRefreshToken}
                  label="Update password"
                  loading={isBusy}
                  onPress={handlePasswordUpdate}
                />

                <View className="flex-row flex-wrap items-center justify-center gap-2">
                  <Text className="text-subtle text-xs">Remember your password?</Text>
                  <Pressable onPress={() => { setMode("login"); setRecoveryToken(""); }}>
                    <Text className="text-brand text-xs font-bold">Sign in</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <View className="gap-6">
                <View className="gap-4">
                  {mode === "register" ? (
                    <AuthField
                      autoCapitalize="words"
                      focused={focusedField === "display_name"}
                      icon="account-outline"
                      label="Full name"
                      onBlur={() => setFocusedField(null)}
                      onChangeText={setDisplayName}
                      onFocus={() => setFocusedField("display_name")}
                      placeholder="Juan dela Cruz"
                      value={displayName}
                    />
                  ) : null}

                  <AuthField
                    focused={focusedField === "email"}
                    icon="email-outline"
                    keyboardType="email-address"
                    label="Email"
                    onBlur={() => setFocusedField(null)}
                    onChangeText={setEmail}
                    onFocus={() => setFocusedField("email")}
                    placeholder="you@example.com"
                    value={email}
                  />

                  <AuthField
                    focused={focusedField === "password"}
                    icon="lock-outline"
                    label={mode === "login" ? "Password" : "Create password"}
                    onBlur={() => setFocusedField(null)}
                    onChangeText={setPassword}
                    onFocus={() => setFocusedField("password")}
                    placeholder="Enter your password"
                    secureTextEntry={!showPassword}
                    trailing={
                      <Pressable onPress={() => setShowPassword((value) => !value)}>
                        <MaterialCommunityIcons
                          color={palette.subtle}
                          name={showPassword ? "eye-off-outline" : "eye-outline"}
                          size={18}
                        />
                      </Pressable>
                    }
                    value={password}
                  />

                  {mode === "register" ? (
                    <AuthField
                      focused={focusedField === "confirm_password"}
                      icon="shield-check-outline"
                      label="Confirm password"
                      onBlur={() => setFocusedField(null)}
                      onChangeText={setConfirmPassword}
                      onFocus={() => setFocusedField("confirm_password")}
                      placeholder="Repeat your password"
                      secureTextEntry={!showConfirmPassword}
                      trailing={
                        <Pressable onPress={() => setShowConfirmPassword((value) => !value)}>
                          <MaterialCommunityIcons
                            color={palette.subtle}
                            name={showConfirmPassword ? "eye-off-outline" : "eye-outline"}
                            size={18}
                          />
                        </Pressable>
                      }
                      value={confirmPassword}
                    />
                  ) : null}
                </View>

                {mode === "login" ? (
                  <Pressable onPress={() => setMode("reset_password")}>
                    <Text className="text-link text-xs text-right font-bold">Forgot password?</Text>
                  </Pressable>
                ) : (
                  <Text className="text-subtle text-xs leading-[18px]">
                    By creating an account, you agree to continue through Odin's verification and onboarding flow.
                  </Text>
                )}

                <View className="gap-4">
                  <AuthButton
                    disabled={isBusy || isGoogleBusy}
                    label={mode === "login" ? "Sign in" : "Create account"}
                    loading={isBusy}
                    onPress={mode === "login" ? handleLogin : handleRegister}
                  />

                  {google.signIn ? (
                    <>
                      <View className="flex-row items-center gap-3">
                        <View className="flex-1 h-[1px] bg-accent" />
                        <Text className="text-subtle text-xs font-semibold">or continue with</Text>
                        <View className="flex-1 h-[1px] bg-accent" />
                      </View>

                      <AuthButton
                        disabled={isBusy || isGoogleBusy}
                        icon="google"
                        label="Google"
                        loading={isGoogleBusy}
                        onPress={handleGoogle}
                        tone="secondary"
                      />
                    </>
                  ) : null}
                </View>

                {pendingVerificationEmail ? (
                  <View className="flex-row items-start gap-3 p-4 rounded-[16px] bg-accent">
                    <MaterialCommunityIcons color={palette.brand} name="email-check-outline" size={20} />
                    <Text className="flex-1 text-text text-xs leading-[18px] font-medium">
                      Verification email sent to {pendingVerificationEmail}. Tap the link there, then come back and sign in.
                    </Text>
                  </View>
                ) : null}

                <View className="flex-row flex-wrap items-center justify-center gap-2">
                  <Text className="text-subtle text-xs">
                    {mode === "login" ? "New to Odin?" : "Already have an account?"}
                  </Text>
                  <Pressable onPress={() => setMode(mode === "login" ? "register" : "login")}>
                    <Text className="text-brand text-xs font-bold">
                      {mode === "login" ? "Create account" : "Sign in"}
                    </Text>
                  </Pressable>
                </View>
              </View>
            )}

            {notice ? <Notice message={notice.message} tone={notice.tone} /> : null}
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>

  {showConsent && pendingAuthState ? (
    <PrivacyConsentScreen
      visible={showConsent}
      accessToken={pendingAuthState.accessToken}
      onComplete={() => {
        setShowConsent(false);
        onAuthenticated(pendingAuthState);
        setPendingAuthState(null);
      }}
      onDismiss={() => {
        setShowConsent(false);
        setPendingAuthState(null);
      }}
    />
  ) : null}
</View>
  );
}
