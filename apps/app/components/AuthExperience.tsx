import { MaterialCommunityIcons } from "@expo/vector-icons";
import { type ReactNode, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Pressable,
  SafeAreaView,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { getConsents } from "../features/governance/api";
import PrivacyConsentScreen from "../features/governance/PrivacyConsentScreen";
import { isOnline } from "../lib/network";

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
  verificationToken?: string;
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

type FieldTone = "default" | "error" | "success";

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
  tone?: FieldTone;
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
  tone = "default",
  trailing,
}: AuthFieldProps) {
  const borderBg = tone === "error"
    ? "border-[#E53935] bg-errorSoft"
    : tone === "success" && focused
    ? "border-aqua500 bg-card"
    : focused
    ? "border-aqua500 bg-card"
    : "border-line bg-surface";

  return (
    <View className="gap-2">
      <FieldLabel>{label}</FieldLabel>
      <View className={`min-h-[52px] rounded-[14px] border px-4 flex-row items-center gap-3 ${borderBg}`}>
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

const monza100 = "#FFDEE2";
const monza700 = "#B71C1C";

type PasswordRule = {
  key: keyof typeof passwordChecksTemplate;
  label: string;
};

const passwordChecksTemplate = {
  length: false,
  upper: false,
  lower: false,
  number: false,
  symbol: false,
};

const passwordRules: PasswordRule[] = [
  { key: "length", label: "8+ characters" },
  { key: "upper", label: "Uppercase letter" },
  { key: "lower", label: "Lowercase letter" },
  { key: "number", label: "Number" },
  { key: "symbol", label: "Symbol" },
];

function PasswordRules({ checks }: { checks: typeof passwordChecksTemplate }) {
  return (
    <View className="gap-1.5">
      {passwordRules.map((rule) => {
        const passed = checks[rule.key];
        return (
          <View key={rule.key} className="flex-row items-center gap-2">
            <MaterialCommunityIcons
              color={passed ? "#12D583" : monza700}
              name={passed ? "check-circle" : "close-circle"}
              size={14}
            />
            <Text style={{ color: passed ? "#12D583" : monza700, fontSize: 12, fontWeight: "500" }}>
              {rule.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function Notice({ tone, message }: NoticeProps) {
  const isError = tone === "error";
  const bgClass = isError ? "bg-errorSoft" : "bg-aqua50";
  const borderClass = isError ? "border" : "border-0";
  const iconColor = isError ? palette.error : palette.brand;
  const iconName = isError
    ? "alert-circle"
    : tone === "success"
    ? "check-circle-outline"
    : "information-outline";
  const textColor = isError ? monza700 : palette.heading;
  const textWeight = isError ? "font-semibold" : "font-medium";

  return (
    <View
      className={`rounded-[13px] px-[15px] py-[13px] flex-row items-center gap-[10px] ${bgClass} ${borderClass}`}
      style={isError ? { borderColor: monza100 } : undefined}
    >
      <MaterialCommunityIcons color={iconColor} name={iconName} size={20} />
      <Text className={`flex-1 text-xs leading-[18px] ${textWeight}`} style={{ color: textColor }}>{message}</Text>
    </View>
  );
}

export default function AuthExperience({
  google,
  isPasswordRecovery,
  isResolvingRecoveryToken,
  recoveryRefreshToken: recoveryRefreshTokenProp,
  recoveryToken: recoveryTokenProp,
  verificationToken: verificationTokenProp,
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
  const [authenticated, setAuthenticated] = useState<AuthenticatedState | null>(null);
  const [fieldErrors, setFieldErrors] = useState<string[]>([]);
  const [emailTouched, setEmailTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [confirmTouched, setConfirmTouched] = useState(false);

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const passwordChecks = {
    length: password.length >= 8,
    upper: /[A-Z]/.test(password),
    lower: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    symbol: /[^A-Za-z0-9]/.test(password),
  };
  const passwordValid = Object.values(passwordChecks).every(Boolean);
  const confirmValid = password !== "" && confirmPassword === password;

  const isLoginValid = emailValid && password.length > 0;
  const isRegisterValid = emailValid && passwordValid && confirmValid;

  function buildAuthState(
    accessToken: string, provider: AuthProvider,
    payload?: { user?: { id?: string }; profile?: { id?: string }; onboarding?: { status?: string } },
  ) {
    return {
      accessToken,
      provider,
      userId: payload?.user?.id,
      profileId: payload?.profile?.id,
      onboardingStatus: payload?.onboarding?.status,
    };
  }

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

  useEffect(() => { setNotice(null); }, [mode]);

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
      setFieldErrors(["email"]);
      setNotice({ tone: "error", message: "Enter your email first." });
      return;
    }

    if (!password) {
      setFieldErrors(["password"]);
      setNotice({ tone: "error", message: "Enter your password first." });
      return;
    }

    const online = await isOnline();
    if (!online) {
      setNotice({ tone: "error", message: "No internet connection. Please check your network and try again." });
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
        setFieldErrors(["email", "password"]);
        throw new Error(body.message ?? "Sign in failed.");
      }

      const accessToken = body.payload?.session?.access_token;
      if (!accessToken) throw new Error("No access token returned.");

      const authState = buildAuthState(accessToken, "password", body.payload);

      const consentsRes = await getConsents(accessToken);
      if (!consentsRes.response.ok) {
        throw new Error("Failed to check consent status. Please try again.");
      }
      const existing = (consentsRes.body as { payload?: { consents?: { status: string }[] } }).payload?.consents;
      const hasGranted = existing?.some((c) => c.status === "granted");
      if (hasGranted) {
        setAuthenticated(authState);
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

    const online = await isOnline();
    if (!online) {
      setNotice({ tone: "error", message: "No internet connection. Please check your network and try again." });
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
        const mergedPayload = {
          ...bootstrappedBody.payload,
          user: { id: bootstrappedBody.payload?.user?.id ?? body.payload?.user?.id },
        };
        const authState = buildAuthState(accessToken, "password", mergedPayload);
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
      setFieldErrors(["email"]);
      setNotice({ tone: "error", message: "Enter your email first so we know where to send the reset link." });
      return;
    }

    const online = await isOnline();
    if (!online) {
      setNotice({ tone: "error", message: "No internet connection. Please check your network and try again." });
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
      setFieldErrors(["password"]);
      setNotice({ tone: "error", message: "Choose a new password first." });
      return;
    }

    if (password !== confirmPassword) {
      setFieldErrors(["confirm_password"]);
      setNotice({ tone: "error", message: "Your new passwords do not match yet." });
      return;
    }

    const recoveryAccessToken = recoveryToken.trim();
    const recoveryRefreshSessionToken = recoveryRefreshToken.trim();

    if (!recoveryAccessToken || !recoveryRefreshSessionToken) {
      setNotice({ tone: "error", message: "Recovery session missing. Request a new reset link and open it on this device." });
      return;
    }

    const online = await isOnline();
    if (!online) {
      setNotice({ tone: "error", message: "No internet connection. Please check your network and try again." });
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

    const online = await isOnline();
    if (!online) {
      setNotice({ tone: "error", message: "No internet connection. Please check your network and try again." });
      return;
    }

    setIsGoogleBusy(true);
    setNotice({ tone: "default", message: "Opening Google sign-in..." });

    try {
      const session = await google.signIn();

      const body = await bootstrapSession(session.accessToken);

      const authState = buildAuthState(session.accessToken, "google", body.payload);

      const consentsRes = await getConsents(session.accessToken);
      if (!consentsRes.response.ok) {
        throw new Error("Failed to check consent status. Please try again.");
      }
      const existing = (consentsRes.body as { payload?: { consents?: { status: string }[] } }).payload?.consents;
      const hasGranted = existing?.some((c) => c.status === "granted");
      if (hasGranted) {
        setAuthenticated(authState);
        onAuthenticated(authState);
        setPendingVerificationEmail(null);
      } else {
        setPendingAuthState(authState);
        setShowConsent(true);
      }
    } catch (error) {
      const msg = getErrorMessage(error);
      setNotice({ tone: "error", message: /Google sign-in was cancelled/i.test(msg) ? "Google login cancelled." : msg });
    } finally {
      setIsGoogleBusy(false);
    }
  }

  async function handleLogout() {
    if (!authenticated?.accessToken) {
      return;
    }

    const provider = authenticated.provider;

    setIsBusy(true);
    setNotice({ tone: "default", message: "Logging you out..." });

    try {
      const { response, body } = await postJson(
        "/logout",
        undefined,
        authenticated.accessToken,
      );

      if (!response.ok) {
        throw new Error(body.message ?? "Logout failed.");
      }

      setAuthenticated(null);
      onLoggedOut();

      if (provider === "google" && google.signOut) {
        try {
          await google.signOut();
        } catch (error) {
          setNotice({
            tone: "default",
            message: `Logged out from Odin. Native Google sign-out failed: ${getErrorMessage(error)}`,
          });
          return;
        }
      }

      setNotice({ tone: "success", message: "You are logged out." });
    } catch (error) {
      setNotice({ tone: "error", message: getErrorMessage(error) });
    } finally {
      setIsBusy(false);
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
        <KeyboardAvoidingView behavior="height" style={{ flex: 1 }}>
          <ScrollView contentContainerClassName="flex-grow px-7 py-10" keyboardShouldPersistTaps="handled">
            <View className="w-full max-w-[420px] self-center gap-8 pt-8">
            <View className="items-center gap-5">
            <View className="w-[64px] h-[64px] rounded-[32px] border-[3px] border-aqua950 items-center justify-center">
              <Image
                accessibilityLabel="Odin logo"
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
            {notice ? <Notice message={notice.message} tone={notice.tone} /> : null}
            {authenticated ? (
              <View className="gap-6">
                <View className="flex-row gap-4 p-6 rounded-[24px] bg-accent items-start">
                  <View className="w-12 h-12 rounded-full bg-white items-center justify-center">
                    <MaterialCommunityIcons color={palette.brand} name="check" size={24} />
                  </View>
                  <View className="gap-2 flex-1">
                    <Text className="text-heading text-xl leading-[24px] font-bold">You are authenticated.</Text>
                    <Text className="text-text text-xs leading-[18px]">
                      Provider: {authenticated.provider === "google" ? "Google" : "Email + password"}
                    </Text>
                    <Text className="text-text text-xs leading-[18px]">
                      User: {authenticated.userId ?? "Unavailable"}
                    </Text>
                    <Text className="text-text text-xs leading-[18px]">
                      Onboarding: {authenticated.onboardingStatus ?? "in_progress"}
                    </Text>
                  </View>
                </View>
                <AuthButton
                  disabled={isBusy}
                  label="Log out"
                  loading={isBusy}
                  onPress={handleLogout}
                />
              </View>
            ) : mode === "reset_password" ? (
              <View className="gap-6">
                <View className="gap-4">
                  <AuthField
                    focused={focusedField === "email"}
                    icon="email-outline"
                    keyboardType="email-address"
                    label="Email"
                    onBlur={() => setFocusedField(null)}
                    onChangeText={(v) => { setEmail(v); setFieldErrors((prev) => prev.filter((f) => f !== "email")); setEmailTouched(true); }}
                    onFocus={() => { setFocusedField("email"); setFieldErrors((prev) => prev.filter((f) => f !== "email")); }}
                    placeholder="you@example.com"
                    tone={
                      fieldErrors.includes("email") ? "error"
                      : emailTouched && email.length > 0 && !emailValid ? "error"
                      : emailTouched && email.length > 0 && emailValid && focusedField === "email" ? "success"
                      : "default"
                    }
                    value={email}
                  />
                </View>

                <AuthButton
                  disabled={isBusy || email.length === 0}
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
                    onChangeText={(v) => { setPassword(v); setFieldErrors((prev) => prev.filter((f) => f !== "password")); setPasswordTouched(true); }}
                    onFocus={() => { setFocusedField("password"); setFieldErrors((prev) => prev.filter((f) => f !== "password")); }}
                    placeholder="Enter new password"
                    secureTextEntry={!showPassword}
                    tone={
                      fieldErrors.includes("password") ? "error"
                      : passwordTouched && !passwordValid ? "error"
                      : passwordTouched && passwordValid ? "success"
                      : "default"
                    }
                    trailing={
                      <Pressable
                        accessibilityLabel={showPassword ? "Hide password" : "Show password"}
                        accessibilityState={{ selected: showPassword }}
                        onPress={() => setShowPassword((value) => !value)}
                      >
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
                    onChangeText={(v) => { setConfirmPassword(v); setFieldErrors((prev) => prev.filter((f) => f !== "confirm_password")); setConfirmTouched(true); }}
                    onFocus={() => { setFocusedField("confirm_password"); setFieldErrors((prev) => prev.filter((f) => f !== "confirm_password")); }}
                    placeholder="Repeat new password"
                    secureTextEntry={!showConfirmPassword}
                    tone={
                      fieldErrors.includes("confirm_password") ? "error"
                      : confirmTouched && !confirmValid ? "error"
                      : confirmTouched && confirmValid ? "success"
                      : "default"
                    }
                    trailing={
                      <Pressable
                        accessibilityLabel={showConfirmPassword ? "Hide password" : "Show password"}
                        accessibilityState={{ selected: showConfirmPassword }}
                        onPress={() => setShowConfirmPassword((value) => !value)}
                      >
                        <MaterialCommunityIcons
                          color={palette.subtle}
                          name={showConfirmPassword ? "eye-off-outline" : "eye-outline"}
                          size={18}
                        />
                      </Pressable>
                    }
                    value={confirmPassword}
                  />
                  {passwordTouched ? <PasswordRules checks={passwordChecks} /> : null}
                </View>

                <AuthButton
                  disabled={isBusy || !recoveryToken || !recoveryRefreshToken || !passwordValid || !confirmValid}
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
                    onChangeText={(v) => { setEmail(v); setFieldErrors((prev) => prev.filter((f) => f !== "email")); setEmailTouched(true); }}
                    onFocus={() => { setFocusedField("email"); setFieldErrors((prev) => prev.filter((f) => f !== "email")); }}
                    placeholder="you@example.com"
                    tone={
                      fieldErrors.includes("email") ? "error"
                      : emailTouched && email.length > 0 && !emailValid ? "error"
                      : emailTouched && email.length > 0 && emailValid && focusedField === "email" ? "success"
                      : "default"
                    }
                    value={email}
                  />

                  <AuthField
                    focused={focusedField === "password"}
                    icon="lock-outline"
                    label={mode === "login" ? "Password" : "Create password"}
                    onBlur={() => setFocusedField(null)}
                    onChangeText={(v) => { setPassword(v); setFieldErrors((prev) => prev.filter((f) => f !== "password")); setPasswordTouched(true); }}
                    onFocus={() => { setFocusedField("password"); setFieldErrors((prev) => prev.filter((f) => f !== "password")); }}
                    placeholder="Enter your password"
                    secureTextEntry={!showPassword}
                    tone={
                      mode === "register"
                        ? fieldErrors.includes("password") ? "error"
                        : passwordTouched && !passwordValid ? "error"
                        : passwordTouched && passwordValid ? "success"
                        : "default"
                        : fieldErrors.includes("password") ? "error"
                        : "default"
                    }
                    trailing={
                      <Pressable
                        accessibilityLabel={showPassword ? "Hide password" : "Show password"}
                        accessibilityState={{ selected: showPassword }}
                        onPress={() => setShowPassword((value) => !value)}
                      >
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
                    <>
                      {passwordTouched ? <PasswordRules checks={passwordChecks} /> : null}
                      <AuthField
                        focused={focusedField === "confirm_password"}
                        icon="shield-check-outline"
                        label="Confirm password"
                        onBlur={() => setFocusedField(null)}
                        onChangeText={(v) => { setConfirmPassword(v); setFieldErrors((prev) => prev.filter((f) => f !== "confirm_password")); setConfirmTouched(true); }}
                        onFocus={() => { setFocusedField("confirm_password"); setFieldErrors((prev) => prev.filter((f) => f !== "confirm_password")); }}
                        placeholder="Repeat your password"
                        secureTextEntry={!showConfirmPassword}
                        tone={
                          fieldErrors.includes("confirm_password") ? "error"
                          : confirmTouched && !confirmValid ? "error"
                          : confirmTouched && confirmValid ? "success"
                          : "default"
                        }
                        trailing={
                          <Pressable
                            accessibilityLabel={showConfirmPassword ? "Hide password" : "Show password"}
                            accessibilityState={{ selected: showConfirmPassword }}
                            onPress={() => setShowConfirmPassword((value) => !value)}
                          >
                            <MaterialCommunityIcons
                              color={palette.subtle}
                              name={showConfirmPassword ? "eye-off-outline" : "eye-outline"}
                              size={18}
                            />
                          </Pressable>
                        }
                        value={confirmPassword}
                      />
                    </>
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
                    disabled={isBusy || isGoogleBusy || (mode === "login" ? !isLoginValid : !isRegisterValid)}
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
        setAuthenticated(pendingAuthState);
        onAuthenticated(pendingAuthState);
        setPendingAuthState(null);
      }}
      onDismiss={() => {
        setShowConsent(false);
        setPendingAuthState(null);
        onLoggedOut();
      }}
    />
  ) : null}
</View>
  );
}
