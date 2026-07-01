import * as Linking from "expo-linking";
import { useEffect, useState } from "react";

export function useDeepLink(): { recoveryToken: string | null } {
  const [recoveryToken, setRecoveryToken] = useState<string | null>(null);

  function parseRecoveryToken(url: string | null) {
    if (!url) return;
    const parsed = Linking.parse(url);
    const fragment = parsed.queryParams?.fragment as string | undefined;
    const token =
      parsed.queryParams?.access_token as string | undefined
      ?? (fragment
        ? new URLSearchParams(
            fragment.startsWith("#") ? fragment.slice(1) : fragment,
          ).get("access_token")
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
