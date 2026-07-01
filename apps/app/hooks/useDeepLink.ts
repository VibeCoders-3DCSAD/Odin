import * as Linking from "expo-linking";
import { useEffect, useState } from "react";

function extractFragment(url: string): string | null {
  const hashIndex = url.indexOf("#");
  return hashIndex >= 0 ? url.slice(hashIndex + 1) : null;
}

export function useDeepLink(): { recoveryToken: string | null } {
  const [recoveryToken, setRecoveryToken] = useState<string | null>(null);

  function parseRecoveryToken(url: string | null) {
    if (!url) return;
    const parsed = Linking.parse(url);
    const fragment = extractFragment(url);
    const token =
      parsed.queryParams?.access_token as string | undefined
      ?? (fragment
        ? new URLSearchParams(fragment).get("access_token")
        : undefined);

    if (token) {
      setRecoveryToken(token);
    }
  }

  useEffect(() => {
    Linking.getInitialURL().then(parseRecoveryToken);

    const sub = Linking.addEventListener("url", (event) => {
      parseRecoveryToken(event.url);
    });

    return () => sub.remove();
  }, []);

  return { recoveryToken };
}
