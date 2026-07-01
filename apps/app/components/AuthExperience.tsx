import { MaterialCommunityIcons } from "@expo/vector-icons";
import { type ReactNode, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";

const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://localhost:3001";
const requestTimeoutMs = 10_000;
const odinLogo = require("../assets/odin-logo.png");

type AuthMode = "login" | "register";
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
  enabled: boolean;
  helperText: string;
  signIn?: () => Promise<{ accessToken: string; userId: string; refreshToken?: string }>;
  signOut?: () => Promise<void>;
};

type AuthExperienceProps = {
  google: GoogleAuthConfig;
};

const palette = {
  cta: "#F9192D",
  link: "#1E4B95",
  brand: "#0F8B8D",
  heading: "#0F0F2C",
  text: "#101720",
  subtle: "#9CB0C1",
  accent: "#ECF1F6",
  canvas: "#F4EFED",
  success: "#EFBF3A",
  white: "#FFFFFF",
  dangerSoft: "#FFE6EA",
  successSoft: "#FFF3CE",
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
    <Text className="text-text text-xs font-semibold">
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
        className={`min-h-[56px] rounded-[16px] border bg-white px-4 flex-row items-center gap-3 ${
          focused ? "border-cta" : "border-accent"
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
      className={`min-h-[56px] rounded-[16px] border items-center justify-center px-4 ${
        primary
          ? "bg-cta border-cta"
          : "bg-white border-accent"
      } ${disabled || loading ? "opacity-50" : "active:opacity-90"}`}
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
    ? "bg-dangerSoft"
    : tone === "success"
    ? "bg-successSoft"
    : "bg-accent";
  const iconColor = tone === "error"
    ? palette.cta
    : tone === "success"
    ? palette.brand
    : palette.link;
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

function SwatchStrip() {
  const swatches = [
    { name: "Brand", color: palette.brand },
    { name: "Links", color: palette.link },
    { name: "Success", color: palette.success },
    { name: "Active", color: palette.cta },
    { name: "Light", color: palette.canvas },
  ];

  return (
    <View className="gap-3">
      <Text className="text-white/72 text-xs tracking-[1.6px] font-semibold">ODIN AUTH KIT</Text>
      <View className="flex-row gap-3 flex-wrap">
        {swatches.map((swatch) => (
          <View key={swatch.name} className="gap-2">
            <View className="w-[92px] h-[68px] rounded-[16px]" style={{ backgroundColor: swatch.color }} />
            <Text className="text-white text-xs font-semibold">{swatch.name}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export default function AuthExperience({ google }: AuthExperienceProps) {
  const { width } = useWindowDimensions();
  const isWide = width >= 960;

  const [mode, setMode] = useState<AuthMode>("login");
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState<string | null>(null);
  const [authenticated, setAuthenticated] = useState<AuthenticatedState | null>(null);
  const [notice, setNotice] = useState<NoticeProps | null>({
    tone: "default",
    message: google.helperText,
  });
  const [isBusy, setIsBusy] = useState(false);
  const [isGoogleBusy, setIsGoogleBusy] = useState(false);

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

  function setAuthenticatedState(
    body: AuthResponse,
    provider: AuthProvider,
  ) {
    const accessToken = body.payload?.session?.access_token;

    if (!accessToken) {
      throw new Error("No access token returned from the auth route.");
    }

    setAuthenticated({
      accessToken,
      provider,
      userId: body.payload?.user?.id,
      profileId: body.payload?.profile?.id,
      onboardingStatus: body.payload?.onboarding?.status,
    });
    setPendingVerificationEmail(null);
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

      setAuthenticatedState(body, "password");
      resetSensitiveFields();
      setNotice({ tone: "success", message: "You are signed in and ready to continue." });
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
        setAuthenticatedState(
          {
            payload: {
              ...bootstrappedBody.payload,
              session: body.payload?.session,
            },
          },
          "password",
        );
        setNotice({ tone: "success", message: "Account created. You are already signed in." });
      } else {
        setPendingVerificationEmail(email.trim());
        setMode("login");
        setNotice({
          tone: "success",
          message: "Account created. Check your inbox for the verification link, then come back and sign in.",
        });
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

  async function handleGoogle() {
    if (!google.enabled || !google.signIn) {
      setNotice({ tone: "default", message: google.helperText });
      return;
    }

    setIsGoogleBusy(true);
    setNotice({ tone: "default", message: "Opening Google sign-in..." });

    try {
      const session = await google.signIn();

      const body = await bootstrapSession(session.accessToken);

      setAuthenticatedState(
        {
          payload: {
            ...body.payload,
            session: { access_token: session.accessToken },
          },
        },
        "google",
      );
      setNotice({ tone: "success", message: "Google sign-in worked. You are in." });
    } catch (error) {
      setNotice({ tone: "error", message: getErrorMessage(error) });
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

  const title = mode === "login" ? "Welcome back" : "Create your account";
  const subtitle = mode === "login"
    ? "Sign in to continue your Odin flow with email and password, or use Google on native builds."
    : "Set up your Odin account with a clean email flow, then finish onboarding right after auth.";

  return (
    <SafeAreaView className="flex-1 bg-canvas">
      <ScrollView contentContainerClassName="flex-grow p-6">
        <View className={`w-full max-w-[1120px] self-center flex-1 gap-6 ${isWide ? "flex-row items-stretch" : "justify-center"}`}>
          <View className={`gap-6 ${isWide ? "flex-1 bg-heading rounded-[24px] p-6 justify-between" : "items-center pt-2 pb-2"}`}>
            <View className="w-[72px] h-[72px] rounded-[36px] border-2 border-brand bg-white items-center justify-center overflow-hidden">
              <Image
                resizeMode="contain"
                source={odinLogo}
                className="w-[54px] h-[54px]"
              />
            </View>
            <View className={`gap-2 ${isWide ? "items-start" : "items-center"}`}>
              <Text className={`text-white text-2xl leading-[30px] font-extrabold ${!isWide ? "text-center" : ""}`}>
                Calm money decisions start with a sharp sign-in flow.
              </Text>
              <Text className={`text-white/76 text-base max-w-[420px] ${!isWide ? "text-center" : ""}`}>
                Dedicated login and registration screens, built around your spacing,
                type scale, and palette instead of the old QA stub.
              </Text>
            </View>
            {isWide ? <SwatchStrip /> : null}
          </View>

          <View
            className="flex-1 bg-white rounded-[24px] p-6 gap-6 border border-[rgba(15,15,44,0.06)]"
            style={{
              shadowColor: palette.heading,
              shadowOpacity: 0.12,
              shadowRadius: 10,
              shadowOffset: { width: 0, height: 2 },
              elevation: 5,
            }}
          >
            <View className="flex-row gap-2 bg-accent rounded-[16px] p-1">
              <Pressable
                onPress={() => setMode("login")}
                className={`flex-1 rounded-xl py-3 items-center justify-center ${
                  mode === "login" ? "bg-white shadow-sm" : ""
                }`}
              >
                <Text className={`text-xs font-bold ${mode === "login" ? "text-heading" : "text-subtle"}`}>
                  Sign in
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setMode("register")}
                className={`flex-1 rounded-xl py-3 items-center justify-center ${
                  mode === "register" ? "bg-white shadow-sm" : ""
                }`}
              >
                <Text className={`text-xs font-bold ${mode === "register" ? "text-heading" : "text-subtle"}`}>
                  Create account
                </Text>
              </Pressable>
            </View>

            <View className="gap-2">
              <Text className="text-heading text-2xl leading-[30px] font-extrabold">{title}</Text>
              <Text className="text-text text-base">{subtitle}</Text>
            </View>

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
                  <Pressable onPress={handlePasswordReset}>
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

                  <View className="flex-row items-center gap-3">
                    <View className="flex-1 h-[1px] bg-accent" />
                    <Text className="text-subtle text-xs font-semibold">or continue with</Text>
                    <View className="flex-1 h-[1px] bg-accent" />
                  </View>

                  <AuthButton
                    disabled={!google.enabled || isBusy || isGoogleBusy}
                    icon="google"
                    label={google.enabled ? "Google" : "Google on native builds"}
                    loading={isGoogleBusy}
                    onPress={handleGoogle}
                    tone="secondary"
                  />
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
    </SafeAreaView>
  );
}
