import { GoogleSignin } from "@react-native-google-signin/google-signin";
import { Platform } from "react-native";
import { supabase } from "../../../lib/supabase";

const googleWebClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
const googleIosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
type GoogleSignInResult = { idToken?: string | null; data?: { idToken?: string | null } | null };
type GoogleTokensResult = { idToken?: string | null };

export function configureGoogleSignIn() {
  GoogleSignin.configure({ webClientId: googleWebClientId, iosClientId: googleIosClientId });
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

export async function startGoogleSignIn() {
  if (Platform.OS === "android") await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const idToken = await getGoogleIdToken();
  const { data, error } = await supabase.auth.signInWithIdToken({ provider: "google", token: idToken });
  if (error || !data.session || !data.user) throw new Error("Google sign-in failed. Please try again.");
  return { accessToken: data.session.access_token, refreshToken: data.session.refresh_token, userId: data.user.id };
}

export async function signOutGoogle() {
  await GoogleSignin.signOut();
}
