import * as Linking from "expo-linking";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type DeepLinkState = {
  isPasswordRecovery: boolean;
  isResolvingRecoveryToken: boolean;
  recoveryToken: string | null;
  recoveryRefreshToken: string | null;
  verificationToken: string | null;
};

function isAuthUrl(url: string, path: string): boolean {
  const parsed = Linking.parse(url);
  return parsed.hostname === "auth" && parsed.path === path;
}

function getUrlParam(url: string, name: string): string | null {
  const parsed = Linking.parse(url);
  const qp = parsed.queryParams?.[name];
  if (typeof qp === "string") return qp;

  const hashIdx = url.indexOf("#");
  if (hashIdx >= 0) {
    const fragment = url.slice(hashIdx + 1);
    const params = new URLSearchParams(fragment);
    if (params.has(name)) return params.get(name);
  }

  const qIdx = url.indexOf("?");
  if (qIdx >= 0) {
    const endIdx = url.indexOf("#", qIdx);
    const query = url.slice(qIdx + 1, endIdx >= 0 ? endIdx : undefined);
    const params = new URLSearchParams(query);
    if (params.has(name)) return params.get(name);
  }

  return null;
}

export function useDeepLink(): DeepLinkState {
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
  const [isResolvingRecoveryToken, setIsResolvingRecoveryToken] = useState(false);
  const [recoveryToken, setRecoveryToken] = useState<string | null>(null);
  const [recoveryRefreshToken, setRecoveryRefreshToken] = useState<string | null>(null);
  const [verificationToken, setVerificationToken] = useState<string | null>(null);

  const processVerifyUrl = useCallback(async (url: string) => {
    const accessToken = getUrlParam(url, "access_token");
    if (accessToken) {
      const refreshToken = getUrlParam(url, "refresh_token");
      if (refreshToken) {
        setVerificationToken(accessToken);
        return;
      }
    }

    const code = getUrlParam(url, "code");
    if (code) {
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error && data.session?.access_token) {
        setVerificationToken(data.session.access_token);
      }
    }
  }, []);

  const parseLink = useCallback(async (url: string | null) => {
    if (!url) return;

    if (isAuthUrl(url, "reset")) {
      setIsPasswordRecovery(true);
      setIsResolvingRecoveryToken(true);
      try {
        const accessToken = getUrlParam(url, "access_token");
        const refreshToken = getUrlParam(url, "refresh_token");
        if (accessToken && refreshToken) {
          setRecoveryToken(accessToken);
          setRecoveryRefreshToken(refreshToken);
        } else {
          const code = getUrlParam(url, "code");
          if (code) {
            const { data, error } = await supabase.auth.exchangeCodeForSession(code);
            if (!error && data.session?.access_token && data.session.refresh_token) {
              setRecoveryToken(data.session.access_token);
              setRecoveryRefreshToken(data.session.refresh_token);
            }
          }
        }
      } finally {
        setIsResolvingRecoveryToken(false);
      }
      return;
    }

    if (isAuthUrl(url, "verify")) {
      await processVerifyUrl(url);
    }
  }, [processVerifyUrl]);

  useEffect(() => {
    Linking.getInitialURL().then(parseLink);
    const sub = Linking.addEventListener("url", (event) => parseLink(event.url));
    return () => sub.remove();
  }, [parseLink]);

  return {
    isPasswordRecovery,
    isResolvingRecoveryToken,
    recoveryToken,
    recoveryRefreshToken,
    verificationToken,
  };
}
