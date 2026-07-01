import * as Linking from "expo-linking";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type DeepLinkState = {
  isPasswordRecovery: boolean;
  isResolvingRecoveryToken: boolean;
  recoveryToken: string | null;
  recoveryRefreshToken: string | null;
};

type RecoverySession = {
  accessToken: string;
  refreshToken: string;
};

function extractFragment(url: string): string | null {
  const hashIndex = url.indexOf("#");
  return hashIndex >= 0 ? url.slice(hashIndex + 1) : null;
}

function extractQuery(url: string): string | null {
  const queryIndex = url.indexOf("?");

  if (queryIndex < 0) return null;

  const hashIndex = url.indexOf("#", queryIndex);
  return url.slice(queryIndex + 1, hashIndex >= 0 ? hashIndex : undefined);
}

function getUrlParam(url: string, name: string): string | null {
  const parsed = Linking.parse(url);
  const parsedParam = parsed.queryParams?.[name];

  if (typeof parsedParam === "string") {
    return parsedParam;
  }

  const query = extractQuery(url);
  const queryParam = query ? new URLSearchParams(query).get(name) : null;

  if (queryParam) {
    return queryParam;
  }

  const fragment = extractFragment(url);
  return fragment ? new URLSearchParams(fragment).get(name) : null;
}

function isResetPasswordUrl(url: string): boolean {
  const parsed = Linking.parse(url);

  return parsed.hostname === "auth" && parsed.path === "reset";
}

async function getRecoverySession(url: string): Promise<RecoverySession | null> {
  const accessToken = getUrlParam(url, "access_token");

  if (accessToken) {
    const refreshToken = getUrlParam(url, "refresh_token");

    if (!refreshToken) {
      return null;
    }

    return { accessToken, refreshToken };
  }

  const code = getUrlParam(url, "code");

  if (!code) {
    return null;
  }

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return null;
  }

  if (!data.session?.access_token || !data.session.refresh_token) {
    return null;
  }

  return {
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token,
  };
}

export function useDeepLink(): DeepLinkState {
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
  const [isResolvingRecoveryToken, setIsResolvingRecoveryToken] = useState(false);
  const [recoveryToken, setRecoveryToken] = useState<string | null>(null);
  const [recoveryRefreshToken, setRecoveryRefreshToken] = useState<string | null>(null);

  async function parseRecoveryLink(url: string | null) {
    if (!url) return;

    if (!isResetPasswordUrl(url)) {
      return;
    }

    setIsPasswordRecovery(true);
    setIsResolvingRecoveryToken(true);

    try {
      const session = await getRecoverySession(url);

      if (session) {
        setRecoveryToken(session.accessToken);
        setRecoveryRefreshToken(session.refreshToken);
      }
    } finally {
      setIsResolvingRecoveryToken(false);
    }
  }

  useEffect(() => {
    Linking.getInitialURL().then(parseRecoveryLink);

    const sub = Linking.addEventListener("url", (event) => {
      parseRecoveryLink(event.url);
    });

    return () => sub.remove();
  }, []);

  return { isPasswordRecovery, isResolvingRecoveryToken, recoveryToken, recoveryRefreshToken };
}
