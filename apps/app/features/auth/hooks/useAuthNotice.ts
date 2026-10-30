import { useEffect, useState } from "react";
import { isOnline } from "../../../lib/network";
import { useAuthStore } from "../stores/useAuthStore";
import type { NoticeProps } from "../components/AuthControls";

const noticeLifetimeMs = 5000;

// A screen's status banner: clears itself after a few seconds and surfaces auth store errors.
export function useAuthNotice(initial: NoticeProps | null = null) {
  const [notice, setNotice] = useState<NoticeProps | null>(initial);
  const authError = useAuthStore((state) => state.error);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), noticeLifetimeMs);
    return () => clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (authError) setNotice({ tone: "error", message: authError });
  }, [authError]);

  // Every auth request needs the network; say so up front instead of waiting for a timeout.
  async function ensureOnline() {
    if (await isOnline()) return true;
    setNotice({ tone: "error", message: "No internet connection. Please check your network and try again." });
    return false;
  }

  return { notice, setNotice, ensureOnline };
}
