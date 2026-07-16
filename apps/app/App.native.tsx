import { useEffect, useState } from "react";
import "./global.css";

import { GoogleSignin } from "@react-native-google-signin/google-signin";
import * as SecureStore from "expo-secure-store";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, Platform, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import AuthExperience, { type AuthenticatedState } from "./components/AuthExperience";
import DevBypassBanner from "./components/DevBypassBanner";
import MobileShell from "./components/MobileShell";
import OnboardingFlow from "./features/onboarding/OnboardingFlow";
import { ToastProvider } from "./components/Toast";
import { startConnectivityPolling } from "./services/connectivity";
import { useDeepLink } from "./hooks/useDeepLink";
import { useDevBypassBootstrap } from "./hooks/useDevBypassBootstrap";
import { API_BASE_URL, REQUEST_TIMEOUT_MS } from "./lib/api";
import {
  createDevBypassSession,
  isDevAuthBypassEnabled,
} from "./lib/devBypass";
import { isSupabaseConfigured, supabase } from "./lib/supabase";

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
      message?: string;
    };
    if (!response.ok) throw new Error(body.message ?? "Failed to restore session.");
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
  const { deviceId, skipSessionRestore, retainSessionOnLogout } = useDevBypassBootstrap();
  const [authenticated, setAuthenticated] = useState<AuthenticatedState | null>(
    () => (isDevAuthBypassEnabled ? createDevBypassSession() : null),
  );
  const { isPasswordRecovery, isResolvingRecoveryToken, recoveryRefreshToken, recoveryToken } = useDeepLink();
  const [isRestoringSession, setIsRestoringSession] = useState(!skipSessionRestore);

  useEffect(() => { startConnectivityPolling(); }, []);

  useEffect(() => {
    if (isDevAuthBypassEnabled || !isSupabaseConfigured) return;
    GoogleSignin.configure({
      webClientId: googleWebClientId,
      iosClientId: googleIosClientId,
    });
  }, []);

  useEffect(() => {
    if (skipSessionRestore) {
      setIsRestoringSession(false);
      return;
    }

    let cancelled = false;

    async function restoreSession() {
      if (isPasswordRecovery || isResolvingRecoveryToken) {
        setIsRestoringSession(false);
        return;
      }

      if (!isSupabaseConfigured) {
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
          return;
        }

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
      } catch {
        await clearAuthSession();
      } finally {
        if (!cancelled) setIsRestoringSession(false);
      }
    }

    restoreSession();
    return () => { cancelled = true; };
  }, [isPasswordRecovery, isResolvingRecoveryToken, skipSessionRestore]);

  async function handleAuthenticated(state: AuthenticatedState) {
    setAuthenticated(state);
    await saveAuthSession(state);
  }

  async function handleLoggedOut() {
    if (retainSessionOnLogout(setAuthenticated)) return;
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
    setAuthenticated((prev) =>
      prev ? { ...prev, onboardingStatus: "submitted" } : prev,
    );
  }

  return (
    <SafeAreaProvider>
      <ToastProvider>
        <View className="flex-1">
          <DevBypassBanner />
          {authenticated ? (
            authenticated.onboardingStatus === "submitted" ? (
              <>
                <MobileShell
                  accessToken={authenticated.accessToken}
                  userId={authenticated.userId ?? ""}
                  deviceId={deviceId}
                  onLoggedOut={handleLoggedOut}
                  signOut={isDevAuthBypassEnabled
                    ? undefined
                    : async () => { await GoogleSignin.signOut(); }}
                />
                <StatusBar style="dark" />
              </>
            ) : (
              <>
                <OnboardingFlow
                  accessToken={authenticated.accessToken}
                  userId={authenticated.userId ?? ""}
                  onComplete={handleOnboardingComplete}
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
                onAuthenticated={handleAuthenticated}
                onLoggedOut={handleLoggedOut}
              />
              <StatusBar style="dark" />
            </>
          )}
        </View>
      </ToastProvider>
    </SafeAreaProvider>
  );
}
