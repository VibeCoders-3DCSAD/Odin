import "./global.css";

import { GoogleSignin } from "@react-native-google-signin/google-signin";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { Platform } from "react-native";
import AuthExperience from "./components/AuthExperience";
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

  return (
    <>
      <AuthExperience
        google={{
          enabled: true,
          helperText: "Google sign-in works on native dev builds. Email and password stay available here too.",
          signIn: startGoogleSignIn,
          signOut: async () => {
            await GoogleSignin.signOut();
          },
        }}
      />
      <StatusBar style="dark" />
    </>
  );
}
