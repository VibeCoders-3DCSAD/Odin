import { useEffect, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { useConnectivityStore } from "../../services/connectivity";
import { getCurrentSession } from "./api";

type OnboardingFlowProps = {
  accessToken: string;
  userId: string;
  onComplete: () => void;
};

export default function OnboardingFlow({ accessToken, userId, onComplete }: OnboardingFlowProps) {
  const online = useConnectivityStore((state) => state.online);
  const [checking, setChecking] = useState(true);
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);

  useEffect(() => {
    if (!online) return;
    let cancelled = false;
    async function check() {
      try {
        const { response, body } = await getCurrentSession(accessToken);
        if (!cancelled && response.ok && body.payload?.session?.status === "submitted") {
          setAlreadySubmitted(true);
          onComplete();
          return;
        }
      } catch {}
      if (!cancelled) setChecking(false);
    }
    check();
    return () => { cancelled = true; };
  }, [accessToken, onComplete, online]);

  if (!online) {
    return (
      <View className="flex-1 items-center justify-center bg-card px-6">
        <Text className="text-lg font-semibold text-foreground text-center mb-4">
          Internet Required
        </Text>
        <Text className="text-base text-muted-foreground text-center mb-6">
          Onboarding requires an internet connection. Please connect and try again.
        </Text>
      </View>
    );
  }

  if (checking) {
    return (
      <View className="flex-1 items-center justify-center bg-card">
        <ActivityIndicator color="#013220" />
      </View>
    );
  }

  if (alreadySubmitted) {
    return (
      <View className="flex-1 items-center justify-center bg-card px-6">
        <Text className="text-lg font-semibold text-foreground text-center mb-4">
          Onboarding Complete
        </Text>
        <Text className="text-base text-muted-foreground text-center mb-6">
          No onboarding session in progress. Continuing to Odin.
        </Text>
        <Text className="text-sm text-muted-foreground text-center mb-6">
          Full onboarding questionnaire coming in next update.
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-1 items-center justify-center bg-card px-6">
      <Text className="text-lg font-semibold text-foreground text-center mb-4">
        Financial Profile Assessment
      </Text>
      <Text className="text-base text-muted-foreground text-center mb-6">
        The onboarding questionnaire will appear here in the next update.
      </Text>
    </View>
  );
}
