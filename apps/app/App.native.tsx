import { GoogleSignin } from "@react-native-google-signin/google-signin";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { Platform, SafeAreaView, ScrollView, Text, View } from "react-native";
import { Button, PaperProvider, TextInput } from "react-native-paper";

const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://localhost:3001";
const googleWebClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
const googleIosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
const googleAuthTimeoutMs = 10_000;

type GoogleSignInResult = {
  idToken?: string | null;
  data?: {
    idToken?: string | null;
  } | null;
};

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
  };
  error?: string;
  message?: string;
};

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.name === "AbortError") {
    return "Google auth request timed out. Check the API and try again.";
  }

  return error instanceof Error ? error.message : "Something went wrong";
}

export default function App() {
  const [isLoading, setIsLoading] = useState(false);
  const [apiUrl, setApiUrl] = useState(apiBaseUrl);
  const [status, setStatus] = useState("Ready to test Google auth.");
  const [authResponse, setAuthResponse] = useState<AuthResponse | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  useEffect(() => {
    GoogleSignin.configure({
      webClientId: googleWebClientId,
      iosClientId: googleIosClientId,
    });
  }, []);

  async function signInWithGoogle() {
    setIsLoading(true);
    setStatus("Opening Google sign-in...");
    setAuthResponse(null);
    setAccessToken(null);

    try {
      if (Platform.OS === "android") {
        await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      }

      const googleResult = await GoogleSignin.signIn() as GoogleSignInResult;
      const googleIdToken = googleResult.data?.idToken ?? googleResult.idToken;

      if (!googleIdToken) {
        throw new Error("Google did not return an ID token.");
      }

      setStatus("Sending Google token to Odin API...");

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), googleAuthTimeoutMs);

      try {
        const response = await fetch(`${apiUrl}/odin/api/auth/google`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ payload: { googleIdToken } }),
          signal: controller.signal,
        });

        const body = await response.json() as AuthResponse;
        setAccessToken(body.payload?.session?.access_token ?? null);
        setAuthResponse(body);

        if (!response.ok) {
          throw new Error(body.message ?? "Backend Google sign-in failed.");
        }
      } finally {
        clearTimeout(timeoutId);
      }

      setStatus("Google auth succeeded.");
    } catch (error) {
      setStatus(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }

  async function logout() {
    if (!accessToken) {
      return;
    }

    setIsLoading(true);
    setStatus("Logging out...");

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), googleAuthTimeoutMs);

    try {
      const response = await fetch(`${apiUrl}/odin/api/auth/logout`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        signal: controller.signal,
      });
      const body = await response.json() as AuthResponse;

      if (!response.ok) {
        throw new Error(body.message ?? "Logout failed.");
      }

      await GoogleSignin.signOut();
      setAccessToken(null);
      setAuthResponse(null);
      setStatus("Logged out.");
    } catch (error) {
      setStatus(getErrorMessage(error));
    } finally {
      clearTimeout(timeoutId);
      setIsLoading(false);
    }
  }

  return (
    <PaperProvider>
      <SafeAreaView className="flex-1 bg-canvas">
        <ScrollView contentContainerClassName="flex-grow justify-between px-6 py-10">
          <View className="gap-4">
            <Text className="text-sm font-medium uppercase tracking-[2px] text-accent">
              Odin QA
            </Text>
            <Text className="text-4xl font-bold leading-tight text-ink">
              Google auth smoke test
            </Text>
            <Text className="text-base leading-6 text-slate-600">
              This page calls native Google Sign-In, sends the Google ID token
              to the API, and shows the Supabase auth bootstrap result.
            </Text>

            <View className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
              <Text className="mb-2 text-sm font-semibold text-ink">
                API Base URL
              </Text>
              <TextInput
                autoCapitalize="none"
                autoCorrect={false}
                mode="outlined"
                onChangeText={setApiUrl}
                value={apiUrl}
              />
              <Text className="mt-3 text-xs leading-5 text-slate-500">
                Expo Go will not run this native Google Sign-In flow. Use a dev
                build. Android emulator users may need http://10.0.2.2:3001.
              </Text>
            </View>

            <View className="rounded-3xl bg-slate-900 p-4">
              <Text className="text-xs font-medium uppercase tracking-[1.5px] text-slate-400">
                Status
              </Text>
              <Text className="mt-2 text-base leading-6 text-white">{status}</Text>
            </View>

            {authResponse ? (
              <View className="rounded-3xl border border-slate-200 bg-white p-4">
                <Text className="text-sm font-semibold text-ink">
                  Backend Response
                </Text>
                <Text className="mt-3 font-mono text-xs leading-5 text-slate-700">
                  {JSON.stringify(authResponse, null, 2)}
                </Text>
              </View>
            ) : null}
          </View>

          {accessToken ? (
            <Button
              disabled={isLoading}
              loading={isLoading}
              mode="contained"
              onPress={logout}
            >
              Logout
            </Button>
          ) : (
            <Button
              disabled={isLoading}
              loading={isLoading}
              mode="contained"
              onPress={signInWithGoogle}
            >
              Continue with Google
            </Button>
          )}
        </ScrollView>
        <StatusBar style="dark" />
      </SafeAreaView>
    </PaperProvider>
  );
}
