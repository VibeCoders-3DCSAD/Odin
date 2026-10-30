import { useState } from "react";
import { getCurrentTermsConsent } from "../../governance/api";
import PrivacyConsentScreen from "../../governance/PrivacyConsentScreen";
import { useAuthStore } from "../stores/useAuthStore";
import type { AuthenticatedState } from "../types";

// Hands a fresh login to the auth store, asking for the current terms consent first when it's missing.
export function useCompleteSignIn() {
  const [pending, setPending] = useState<AuthenticatedState | null>(null);

  async function complete(authState: AuthenticatedState) {
    const consents = await getCurrentTermsConsent(authState.accessToken);
    if (!consents.response.ok) throw new Error("Failed to check consent status. Please try again.");
    if (consents.hasCurrentTermsConsent) await useAuthStore.getState().acceptLogin(authState);
    else setPending(authState);
  }

  const consentScreen = pending ? (
    <PrivacyConsentScreen
      visible
      accessToken={pending.accessToken}
      onComplete={async () => {
        setPending(null);
        await useAuthStore.getState().acceptLogin(pending);
      }}
      onDismiss={() => {
        setPending(null);
        void useAuthStore.getState().lock();
      }}
    />
  ) : null;

  return { complete, consentScreen };
}
