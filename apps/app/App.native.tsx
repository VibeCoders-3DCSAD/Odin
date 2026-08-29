import { useEffect, useState } from "react";
import "./global.css";

import { GoogleSignin } from "@react-native-google-signin/google-signin";
import * as SecureStore from "expo-secure-store";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, Alert, Platform, View } from "react-native";
import AuthExperience, { type AuthenticatedState } from "./components/AuthExperience";
import MobileShell from "./components/MobileShell";
import OnboardingFlow from "./features/onboarding/OnboardingFlow";
import { ToastProvider } from "./components/Toast";
import { startConnectivityPolling } from "./services/connectivity";
import { useDeepLink } from "./hooks/useDeepLink";
import { API_BASE_URL, REQUEST_TIMEOUT_MS } from "./lib/api";
import { getOrCreateDeviceId } from "./local-db/deviceId";
import { supabase } from "./lib/supabase";

const googleWebClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
const googleIosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
const authStorageKey = "odin.auth.session";

type GoogleSignInResult = {
  type?: string;
  idToken?: string | null;
  data?: {
    idToken?: string | null;
  } | null;
};

type GoogleTokensResult = {
  idToken?: string | null;
};

type StoredAuthSession = {
  accessToken: string;
  refreshToken: string;
  provider: AuthenticatedState["provider"];
};

class SessionBootstrapError extends Error {
  constructor(readonly status: number, readonly code: string | undefined, message: string) {
    super(message);
  }
}

async function bootstrapSession(accessToken: string) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${API_BASE_URL}/odin/api/auth/session`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      signal: controller.signal,
    });
    const body = await response.json().catch(() => ({})) as {
      payload?: { user?: { id?: string }; profile?: { id?: string }; onboarding?: { status?: string } };
      code?: string;
      message?: string;
    };
    if (!response.ok) throw new SessionBootstrapError(response.status, body.code, body.message ?? "Failed to restore session.");
    return body.payload;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function saveAuthSession(state: AuthenticatedState) {
  if (!state.refreshToken) return;
  await SecureStore.setItemAsync(authStorageKey, JSON.stringify({
    accessToken: state.accessToken,
    refreshToken: state.refreshToken,
    provider: state.provider,
  } satisfies StoredAuthSession));
}

async function clearAuthSession() {
  await SecureStore.deleteItemAsync(authStorageKey);
}

async function getGoogleIdToken() {
  if (!googleWebClientId) {
    throw new Error(
      "Google sign-in is not configured. Set EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID in .env — get it from Google Cloud Console > APIs & Services > Credentials.",
    );
  }

  const googleResult = await GoogleSignin.signIn() as GoogleSignInResult;

  const signInIdToken = googleResult.data?.idToken ?? googleResult.idToken;

  if (signInIdToken) {
    return signInIdToken;
  }

  const googleTokens = await GoogleSignin.getTokens() as GoogleTokensResult;

  if (googleTokens.idToken) {
    return googleTokens.idToken;
  }

  throw new Error(
    "Google did not return an ID token. Check that EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID in .env matches the web client ID in your Google Cloud project.",
  );
}

export default function App() {
  const [authenticated, setAuthenticated] = useState<AuthenticatedState | null>(null);
  const {
    isPasswordRecovery,
    isResolvingRecoveryToken,
    recoveryRefreshToken,
    recoveryToken,
    verificationToken,
  } = useDeepLink();
  const [deviceId, setDeviceId] = useState("");
  const [isRestoringSession, setIsRestoringSession] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState<string | null>(null);
  const [reassessing, setReassessing] = useState(false);

  useEffect(() => { getOrCreateDeviceId().then(setDeviceId).catch(() => {}); }, []);
  useEffect(() => { startConnectivityPolling(); }, []);

  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        clearAuthSession().catch(() => {});
        return;
      }

      if (event !== "TOKEN_REFRESHED" || !session?.access_token) return;

      setAuthenticated((current) => {
        if (!current) return current;
        const refreshed = {
          ...current,
          accessToken: session.access_token,
          refreshToken: session.refresh_token ?? current.refreshToken,
        };
        saveAuthSession(refreshed).catch(() => {});
        return refreshed;
      });
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    GoogleSignin.configure({
      webClientId: googleWebClientId,
      iosClientId: googleIosClientId,
    });
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function restoreSession() {
      let restoredEmail: string | null = null;
      if (isPasswordRecovery || isResolvingRecoveryToken) {
        setIsRestoringSession(false);
        return;
      }

      try {
        const raw = await SecureStore.getItemAsync(authStorageKey);
        if (!raw) return;

        const stored = JSON.parse(raw) as Partial<StoredAuthSession>;
        if (!stored.accessToken || !stored.refreshToken || !stored.provider) {
          await clearAuthSession();
          return;
        }

        const { data, error } = await supabase.auth.setSession({
          access_token: stored.accessToken,
          refresh_token: stored.refreshToken,
        });

        const session = data.session;
        if (error || !session?.access_token || !session.refresh_token) {
          await clearAuthSession();
          if (!cancelled) setSessionExpired(true);
          return;
        }
        restoredEmail = session.user.email ?? null;

        const payload = await bootstrapSession(session.access_token);
        const restored: AuthenticatedState = {
          accessToken: session.access_token,
          refreshToken: session.refresh_token,
          provider: stored.provider,
          userId: payload?.user?.id,
          profileId: payload?.profile?.id,
          onboardingStatus: payload?.onboarding?.status,
        };
        await saveAuthSession(restored);
        if (!cancelled) setAuthenticated(restored);
      } catch (error) {
        await clearAuthSession();
        if (!cancelled && error instanceof SessionBootstrapError) {
          if (error.code === "email_unverified") {
            setVerificationEmail(restoredEmail);
          } else if (error.status === 401) {
            setSessionExpired(true);
          }
        }
      } finally {
        if (!cancelled) setIsRestoringSession(false);
      }
    }

    restoreSession();
    return () => { cancelled = true; };
  }, [isPasswordRecovery, isResolvingRecoveryToken]);

  async function handleAuthenticated(state: AuthenticatedState) {
    if (state.refreshToken) {
      const { error } = await supabase.auth.setSession({
        access_token: state.accessToken,
        refresh_token: state.refreshToken,
      });
      if (error) {
        await clearAuthSession();
        setAuthenticated(null);
        Alert.alert("Sign-in failed", "We couldn't establish a secure session. Please sign in again.");
        return false;
      }
    }
    setAuthenticated(state);
    await saveAuthSession(state);
    return true;
  }

  async function handleLoggedOut() {
    await clearAuthSession();
    setAuthenticated(null);
  }

  async function startGoogleSignIn() {
    if (Platform.OS === "android") {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    }

    const googleIdToken = await getGoogleIdToken();

    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: "google",
      token: googleIdToken,
    });

    if (error || !data.session?.access_token) {
      throw new Error(error?.message ?? "Supabase Google sign-in failed.");
    }

    return {
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token ?? undefined,
      userId: data.user?.id,
    };
  }

  async function handleOnboardingComplete() {
    setReassessing(false);
    setAuthenticated((prev) =>
      prev ? { ...prev, onboardingStatus: "submitted" } : prev,
    );
  }

  return (
    <ToastProvider>
      {authenticated ? (
        authenticated.onboardingStatus === "submitted" && !reassessing ? (
          <>
            <MobileShell
              accessToken={authenticated.accessToken}
              userId={authenticated.userId ?? ""}
              deviceId={deviceId}
                onLoggedOut={handleLoggedOut}
                onRequestReassessment={() => setReassessing(true)}
              signOut={async () => { await GoogleSignin.signOut(); }}
            />
            <StatusBar style="dark" />
          </>
        ) : (
          <>
            <OnboardingFlow
              accessToken={authenticated.accessToken}
              userId={authenticated.userId ?? ""}
              onComplete={handleOnboardingComplete}
              restart={reassessing}
            />
            <StatusBar style="dark" />
          </>
        )
      ) : isRestoringSession ? (
        <View className="flex-1 items-center justify-center bg-card">
          <ActivityIndicator color="#013220" />
          <StatusBar style="dark" />
        </View>
      ) : (
        <>
          <AuthExperience
            google={{
              signIn: startGoogleSignIn,
              signOut: async () => {
                await GoogleSignin.signOut();
              },
            }}
            isPasswordRecovery={isPasswordRecovery}
            isResolvingRecoveryToken={isResolvingRecoveryToken}
            recoveryRefreshToken={recoveryRefreshToken ?? undefined}
            recoveryToken={recoveryToken ?? undefined}
            verificationToken={verificationToken ?? undefined}
            verificationEmail={verificationEmail ?? undefined}
            sessionExpired={sessionExpired}
            onAuthenticated={handleAuthenticated}
            onLoggedOut={handleLoggedOut}
          />
          <StatusBar style="dark" />
        </>
      )}
    </ToastProvider>
  );
}
