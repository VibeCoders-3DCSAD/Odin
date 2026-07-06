import { useState } from "react";
import "./global.css";

import { GoogleSignin } from "@react-native-google-signin/google-signin";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { Platform } from "react-native";
import AuthExperience, { type AuthenticatedState } from "./components/AuthExperience";
import MobileShell from "./components/MobileShell";
import { useDeepLink } from "./hooks/useDeepLink";
import { supabase } from "./lib/supabase";

const googleWebClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
const googleIosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;

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
  const { isPasswordRecovery, isResolvingRecoveryToken, recoveryRefreshToken, recoveryToken } = useDeepLink();

  useEffect(() => {
    GoogleSignin.configure({
      webClientId: googleWebClientId,
      iosClientId: googleIosClientId,
    });
  }, []);

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

  if (authenticated) {
    return (
      <>
        <MobileShell
          accessToken={authenticated.accessToken}
          onLoggedOut={() => setAuthenticated(null)}
        />
        <StatusBar style="dark" />
      </>
    );
  }

  return (
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
        onAuthenticated={(state) => setAuthenticated(state)}
        onLoggedOut={() => setAuthenticated(null)}
      />
      <StatusBar style="dark" />
    </>
  );
}
