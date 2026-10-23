import { useEffect, useState } from "react";
import "./global.css";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import { StatusBar } from "expo-status-bar";
import * as ScreenCapture from "expo-screen-capture";
import { ActivityIndicator, AppState, Platform, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import AuthExperience from "./components/AuthExperience";
import MobileShell from "./components/MobileShell";
import OnboardingFlow from "./features/onboarding/OnboardingFlow";
import { ToastProvider } from "./components/Toast";
import { startConnectivityPolling, useConnectivityStore } from "./services/connectivity";
import { useDeepLink } from "./hooks/useDeepLink";
import { getOrCreateDeviceId } from "./local-db/deviceId";
import { enableDatabaseProtection } from "./local-db/databaseAccess";
import { supabase } from "./lib/supabase";
import PinAccessScreen from "./features/auth/components/PinAccessScreen";
import { installNativeAccessGuard, useAuthStore } from "./features/auth/stores/useAuthStore";
import { resetAccessClock } from "./features/auth/helpers/accessClock";

const googleWebClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
const googleIosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
type GoogleSignInResult = { idToken?: string | null; data?: { idToken?: string | null } | null };
type GoogleTokensResult = { idToken?: string | null };
enableDatabaseProtection();
installNativeAccessGuard();

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
  const phase = useAuthStore((state) => state.phase);
  const account = useAuthStore((state) => state.account);
  const authError = useAuthStore((state) => state.error);
  const online = useConnectivityStore((state) => state.online);
  const [deviceId, setDeviceId] = useState("");
  const [reassessing, setReassessing] = useState(false);
  const links = useDeepLink();

  useEffect(() => {
    startConnectivityPolling();
    GoogleSignin.configure({ webClientId: googleWebClientId, iosClientId: googleIosClientId });
    void useAuthStore.getState().hydrate();
    // Protect native snapshots as well as the React view during background transitions.
    if (Platform.OS === "ios") void ScreenCapture.enableAppSwitcherProtectionAsync(1).catch(() => {});
    else void ScreenCapture.preventScreenCaptureAsync("odin-financial-data").catch(() => {});
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") void useAuthStore.getState().lock();
      else {
        // Native monotonic clocks can pause during device sleep; re-anchor before
        // checking persisted observations to avoid treating sleep as clock tampering.
        resetAccessClock();
        void useAuthStore.getState().checkAccess();
      }
    });
    const interval = setInterval(() => { void useAuthStore.getState().checkAccess(); }, 1000);
    return () => { subscription.remove(); clearInterval(interval); };
  }, []);

  useEffect(() => {
    if (phase !== "unlocked") { setDeviceId(""); return; }
    let cancelled = false;
    getOrCreateDeviceId().then((id) => { if (!cancelled) setDeviceId(id); }).catch(() => {
      void useAuthStore.getState().lock();
    });
    return () => { cancelled = true; };
  }, [phase, account?.session.userId]);

  useEffect(() => {
    if (online && phase === "unlocked") void useAuthStore.getState().verifyOnline();
  }, [online, phase]);

  useEffect(() => {
    if (!links.isPasswordRecovery && !links.isResolvingRecoveryToken) return;
    void useAuthStore.getState().lock().then(() => {
      useAuthStore.setState({ phase: "recovery" });
    });
  }, [links.isPasswordRecovery, links.isResolvingRecoveryToken]);

  async function startGoogleSignIn() {
    if (Platform.OS === "android") await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const idToken = await getGoogleIdToken();
    const { data, error } = await supabase.auth.signInWithIdToken({ provider: "google", token: idToken });
    if (error || !data.session || !data.user) throw new Error("Google sign-in failed. Please try again.");
    return { accessToken: data.session.access_token, refreshToken: data.session.refresh_token, userId: data.user.id };
  }

  const loading = phase === "hydrating" || (phase === "unlocked" && !deviceId);
  const authenticated = phase === "unlocked" && deviceId && account;
  const showAuthentication = phase === "signed-out" || phase === "recovery";
  const content = loading ? <View className="flex-1 items-center justify-center bg-card"><ActivityIndicator color="#013220" /></View>
    : authenticated ? account.session.onboardingStatus === "submitted" && !reassessing
      ? <MobileShell accessToken={account.session.accessToken} userId={account.session.userId} deviceId={deviceId}
          onLoggedOut={() => { void useAuthStore.getState().finishLogout(); }}
          onRequestReassessment={() => setReassessing(true)} onLock={() => { void useAuthStore.getState().lock(); }}
          signOut={async () => { await GoogleSignin.signOut(); }} />
      : <OnboardingFlow accessToken={account.session.accessToken} userId={account.session.userId}
          onComplete={() => { setReassessing(false); void useAuthStore.getState().updateOnboarding(); }} restart={reassessing} />
    : showAuthentication ? <View className="flex-1">
      <AuthExperience
        authError={authError}
        google={{ signIn: startGoogleSignIn, signOut: async () => { await GoogleSignin.signOut(); } }}
        isPasswordRecovery={links.isPasswordRecovery} isResolvingRecoveryToken={links.isResolvingRecoveryToken}
        recoveryRefreshToken={links.recoveryRefreshToken ?? undefined} recoveryToken={links.recoveryToken ?? undefined}
        verificationToken={links.verificationToken ?? undefined}
        onAuthenticated={useAuthStore.getState().acceptLogin}
        onLoggedOut={() => { void useAuthStore.getState().lock(); }} /></View>
    : <PinAccessScreen key={phase} />;

  return <SafeAreaProvider><ToastProvider>{content}<StatusBar style="dark" /></ToastProvider></SafeAreaProvider>;
}
