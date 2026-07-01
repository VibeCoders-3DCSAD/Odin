import { MaterialCommunityIcons } from "@expo/vector-icons";
import { type ReactNode, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
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
    <Text
      style={{
        color: palette.text,
        fontSize: 12,
        lineHeight: 16,
        fontWeight: "600",
      }}
    >
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
    <View style={{ gap: 8 }}>
      <FieldLabel>{label}</FieldLabel>
      <View
        style={[
          styles.inputShell,
          focused ? styles.inputShellFocused : null,
        ]}
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
          style={styles.input}
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
      style={({ pressed }) => [
        styles.buttonBase,
        {
          backgroundColor: primary ? palette.cta : palette.white,
          borderColor: primary ? palette.cta : palette.accent,
          opacity: disabled || loading ? 0.5 : pressed ? 0.92 : 1,
        },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={primary ? palette.white : palette.brand} />
      ) : (
        <View style={styles.buttonContent}>
          {icon ? (
            <MaterialCommunityIcons
              color={primary ? palette.white : palette.heading}
              name={icon}
              size={18}
            />
          ) : null}
          <Text
            style={{
              color: primary ? palette.white : palette.heading,
              fontSize: 16,
              lineHeight: 20,
              fontWeight: "700",
            }}
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
  const backgroundColor = tone === "error"
    ? palette.dangerSoft
    : tone === "success"
    ? palette.successSoft
    : palette.accent;
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
    <View style={[styles.notice, { backgroundColor }]}> 
      <MaterialCommunityIcons color={iconColor} name={iconName} size={18} />
      <Text style={styles.noticeText}>{message}</Text>
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
    <View style={{ gap: 12 }}>
      <Text style={styles.overline}>ODIN AUTH KIT</Text>
      <View style={styles.swatchRow}>
        {swatches.map((swatch) => (
          <View key={swatch.name} style={styles.swatchItem}>
            <View style={[styles.swatchTile, { backgroundColor: swatch.color }]} />
            <Text style={styles.swatchLabel}>{swatch.name}</Text>
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
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={[styles.frame, isWide ? styles.frameWide : styles.frameNarrow]}>
          <View style={[styles.hero, isWide ? styles.heroWide : styles.heroNarrow]}>
            <View style={styles.heroBadge}>
              <Image
                resizeMode="contain"
                source={odinLogo}
                style={styles.heroLogo}
              />
            </View>
            <View style={{ gap: 8, alignItems: isWide ? "flex-start" : "center" }}>
              <Text style={[styles.heroHeading, !isWide ? { textAlign: "center" } : null]}>
                Calm money decisions start with a sharp sign-in flow.
              </Text>
              <Text style={[styles.heroBody, !isWide ? { textAlign: "center" } : null]}>
                Dedicated login and registration screens, built around your spacing,
                type scale, and palette instead of the old QA stub.
              </Text>
            </View>
            {isWide ? <SwatchStrip /> : null}
          </View>

          <View style={styles.card}>
            <View style={styles.segmentedControl}>
              <Pressable
                onPress={() => setMode("login")}
                style={[styles.segment, mode === "login" ? styles.segmentActive : null]}
              >
                <Text style={[styles.segmentText, mode === "login" ? styles.segmentTextActive : null]}>
                  Sign in
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setMode("register")}
                style={[styles.segment, mode === "register" ? styles.segmentActive : null]}
              >
                <Text style={[styles.segmentText, mode === "register" ? styles.segmentTextActive : null]}>
                  Create account
                </Text>
              </Pressable>
            </View>

            <View style={{ gap: 8 }}>
              <Text style={styles.cardTitle}>{title}</Text>
              <Text style={styles.cardSubtitle}>{subtitle}</Text>
            </View>

            {authenticated ? (
              <View style={{ gap: 24 }}>
                <View style={styles.successPanel}>
                  <View style={styles.successIcon}>
                    <MaterialCommunityIcons color={palette.brand} name="check" size={24} />
                  </View>
                  <View style={{ gap: 8, flex: 1 }}>
                    <Text style={styles.successTitle}>You are authenticated.</Text>
                    <Text style={styles.successBody}>
                      Provider: {authenticated.provider === "google" ? "Google" : "Email + password"}
                    </Text>
                    <Text style={styles.successBody}>
                      User: {authenticated.userId ?? "Unavailable"}
                    </Text>
                    <Text style={styles.successBody}>
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
              <View style={{ gap: 24 }}>
                <View style={{ gap: 16 }}>
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
                    <Text style={styles.inlineLink}>Forgot password?</Text>
                  </Pressable>
                ) : (
                  <Text style={styles.footnote}>
                    By creating an account, you agree to continue through Odin's verification and onboarding flow.
                  </Text>
                )}

                <View style={{ gap: 16 }}>
                  <AuthButton
                    disabled={isBusy || isGoogleBusy}
                    label={mode === "login" ? "Sign in" : "Create account"}
                    loading={isBusy}
                    onPress={mode === "login" ? handleLogin : handleRegister}
                  />

                  <View style={styles.dividerRow}>
                    <View style={styles.dividerLine} />
                    <Text style={styles.dividerText}>or continue with</Text>
                    <View style={styles.dividerLine} />
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
                  <View style={styles.pendingPanel}>
                    <MaterialCommunityIcons color={palette.brand} name="email-check-outline" size={20} />
                    <Text style={styles.pendingText}>
                      Verification email sent to {pendingVerificationEmail}. Tap the link there, then come back and sign in.
                    </Text>
                  </View>
                ) : null}

                <View style={styles.footerRow}>
                  <Text style={styles.footerText}>
                    {mode === "login" ? "New to Odin?" : "Already have an account?"}
                  </Text>
                  <Pressable onPress={() => setMode(mode === "login" ? "register" : "login")}>
                    <Text style={styles.footerLink}>
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

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: palette.canvas,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
  },
  frame: {
    width: "100%",
    maxWidth: 1120,
    alignSelf: "center",
    flex: 1,
    gap: 24,
  },
  frameWide: {
    flexDirection: "row",
    alignItems: "stretch",
  },
  frameNarrow: {
    justifyContent: "center",
  },
  hero: {
    gap: 24,
  },
  heroWide: {
    flex: 1,
    backgroundColor: palette.heading,
    borderRadius: 24,
    padding: 24,
    justifyContent: "space-between",
  },
  heroNarrow: {
    alignItems: "center",
    paddingTop: 8,
    paddingBottom: 8,
  },
  heroBadge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2,
    borderColor: palette.brand,
    backgroundColor: palette.white,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  heroLogo: {
    width: 54,
    height: 54,
  },
  heroHeading: {
    color: palette.white,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "800",
  },
  heroBody: {
    color: "rgba(255,255,255,0.76)",
    fontSize: 16,
    lineHeight: 24,
    maxWidth: 420,
  },
  overline: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 1.6,
    fontWeight: "600",
  },
  swatchRow: {
    flexDirection: "row",
    gap: 12,
    flexWrap: "wrap",
  },
  swatchItem: {
    gap: 8,
  },
  swatchTile: {
    width: 92,
    height: 68,
    borderRadius: 16,
  },
  swatchLabel: {
    color: palette.white,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600",
  },
  card: {
    flex: 1,
    backgroundColor: palette.white,
    borderRadius: 24,
    padding: 24,
    gap: 24,
    shadowColor: palette.heading,
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 5,
    borderWidth: 1,
    borderColor: "rgba(15, 15, 44, 0.06)",
  },
  segmentedControl: {
    flexDirection: "row",
    gap: 8,
    backgroundColor: palette.accent,
    borderRadius: 16,
    padding: 4,
  },
  segment: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentActive: {
    backgroundColor: palette.white,
    shadowColor: palette.heading,
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  segmentText: {
    color: palette.subtle,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
  },
  segmentTextActive: {
    color: palette.heading,
  },
  cardTitle: {
    color: palette.heading,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "800",
  },
  cardSubtitle: {
    color: palette.text,
    fontSize: 16,
    lineHeight: 24,
  },
  inputShell: {
    minHeight: 56,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.accent,
    backgroundColor: palette.white,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  inputShellFocused: {
    borderColor: palette.cta,
  },
  input: {
    flex: 1,
    color: palette.heading,
    fontSize: 16,
    lineHeight: 20,
    paddingVertical: 16,
    fontWeight: "500",
  },
  inlineLink: {
    color: palette.link,
    fontSize: 12,
    lineHeight: 16,
    textAlign: "right",
    fontWeight: "700",
  },
  footnote: {
    color: palette.subtle,
    fontSize: 12,
    lineHeight: 18,
  },
  buttonBase: {
    minHeight: 56,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  buttonContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: palette.accent,
  },
  dividerText: {
    color: palette.subtle,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600",
  },
  pendingPanel: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 16,
    borderRadius: 16,
    backgroundColor: palette.accent,
  },
  pendingText: {
    flex: 1,
    color: palette.text,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "500",
  },
  footerRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  footerText: {
    color: palette.subtle,
    fontSize: 12,
    lineHeight: 16,
  },
  footerLink: {
    color: palette.brand,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
  },
  notice: {
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  noticeText: {
    flex: 1,
    color: palette.heading,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "500",
  },
  successPanel: {
    flexDirection: "row",
    gap: 16,
    padding: 24,
    borderRadius: 24,
    backgroundColor: palette.accent,
    alignItems: "flex-start",
  },
  successIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: palette.white,
    alignItems: "center",
    justifyContent: "center",
  },
  successTitle: {
    color: palette.heading,
    fontSize: 20,
    lineHeight: 24,
    fontWeight: "700",
  },
  successBody: {
    color: palette.text,
    fontSize: 12,
    lineHeight: 18,
  },
});
