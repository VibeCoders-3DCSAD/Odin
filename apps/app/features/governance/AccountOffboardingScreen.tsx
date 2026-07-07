import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  Text,
  View,
} from "react-native";
import { CaretRight, Check, WarningCircle } from "phosphor-react-native";
import { confirmAccountDeletion, requestAccountDeletion } from "./api";
import type { AccountDeletionRequest } from "./types";
import { getErrorMessage } from "./helpers";

type AccountOffboardingScreenProps = {
  accessToken: string;
  onDeletionRequested: (request: AccountDeletionRequest) => void;
  onBack: () => void;
};

const MUTED = "#6B7A6F";
const LINE = "#EAEAE6";
const INK = "#1B1C1A";
const INK2 = "#414942";
const AQUA600 = "#08B16A";
const CARD = "#FCF8F0";
const MONZA50 = "#FFF0F2";
const MONZA200 = "#FFCDD2";
const MONZA600 = "#D9001F";
const MONZA700 = "#B71C1C";

export default function AccountOffboardingScreen({ accessToken, onDeletionRequested, onBack }: AccountOffboardingScreenProps) {
  const [phase, setPhase] = useState<"initial" | "confirming" | "submitting">("initial");
  const [checked, setChecked] = useState(false);
  const [request, setRequest] = useState<AccountDeletionRequest | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleRequestDeletion() {
    setPhase("submitting");
    setError(null);
    try {
      const { response, body } = await requestAccountDeletion(accessToken);
      if (!response.ok) {
        if (body.message?.includes("active") || response.status === 409) {
          setError("You already have an active deletion request.");
        } else {
          setError(body.message ?? "Failed to create deletion request.");
        }
        setPhase("initial");
        return;
      }
      const delRequest = (body as { payload?: { request: AccountDeletionRequest } }).payload?.request;
      if (!delRequest) {
        setError("Unexpected response. Please try again.");
        setPhase("initial");
        return;
      }
      setRequest(delRequest);
      setPhase("confirming");
    } catch (err) {
      setError(getErrorMessage(err));
      setPhase("initial");
    }
  }

  async function handleConfirm() {
    if (!request) return;
    setPhase("submitting");
    setError(null);
    try {
      const { response, body } = await confirmAccountDeletion(accessToken, request.id);
      if (!response.ok) {
        setError(body.message ?? "Failed to confirm deletion.");
        setPhase("confirming");
        return;
      }
      const confirmed = (body as { payload?: { request: AccountDeletionRequest } }).payload?.request;
      onDeletionRequested(confirmed ?? { ...request, status: "processing" });
    } catch (err) {
      setError(getErrorMessage(err));
      setPhase("confirming");
    }
  }

  return (
    <View>
      <Pressable
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel="Back to settings"
        style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 }}
      >
        <CaretRight size={18} color={MUTED} weight="bold" style={{ transform: [{ rotate: "180deg" }] }} />
        <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 13, color: MUTED }}>
          Settings
        </Text>
      </Pressable>

      <Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 20, color: INK, marginBottom: 16 }}>
        Delete account
      </Text>

      <View
        style={{
          borderRadius: 14, borderWidth: 1.5, borderColor: MONZA200,
          backgroundColor: MONZA50, padding: 15, marginBottom: 16,
          flexDirection: "row", gap: 10,
        }}
      >
        <WarningCircle size={22} color={MONZA600} weight="fill" />
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 13, color: MONZA700, marginBottom: 4 }}>
            This action is irreversible
          </Text>
          <Text style={{ fontFamily: "Manrope", fontWeight: "400", fontSize: 12, lineHeight: 18, color: INK2 }}>
            Deleting your account will permanently remove all your data including transactions, budgets, goals, and settings. This cannot be undone.
          </Text>
        </View>
      </View>

      <View
        style={{
          borderRadius: 16, borderWidth: 1, borderColor: LINE, overflow: "hidden",
          backgroundColor: CARD, marginBottom: 16,
        }}
      >
        {[
          "Permanently delete all transaction history",
          "Remove all budget plans and goals",
          "Delete debt management records",
          "Erase personalization preferences",
          "Cancel any active data exports",
        ].map((item, i) => (
          <View
            key={item}
            style={{
              flexDirection: "row", alignItems: "center", gap: 10,
              paddingHorizontal: 15, paddingVertical: 11,
              borderTopWidth: i > 0 ? 1 : 0, borderTopColor: LINE,
            }}
          >
            <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: MONZA600 }} />
            <Text style={{ fontFamily: "Manrope", fontWeight: "500", fontSize: 12.5, color: INK2, flex: 1 }}>
              {item}
            </Text>
          </View>
        ))}
      </View>

      {phase === "confirming" && request ? (
        <View style={{ gap: 10, marginBottom: 16 }}>
          <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 13, color: INK2, textAlign: "center" }}>
            Your deletion request has been created. Confirm below to proceed.
          </Text>

          <Pressable
            onPress={() => setChecked(!checked)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked }}
            accessibilityLabel="I understand this action is permanent and cannot be undone"
            style={{ flexDirection: "row", gap: 10, alignItems: "flex-start", padding: 13 }}
          >
            <View
              style={{
                width: 22, height: 22, borderRadius: 6, marginTop: 1,
                borderWidth: 2, borderColor: checked ? AQUA600 : LINE,
                backgroundColor: checked ? AQUA600 : "transparent",
                justifyContent: "center", alignItems: "center",
              }}
            >
              {checked ? <Check size={14} color="#FFFFFF" weight="bold" /> : null}
            </View>
            <Text style={{ fontFamily: "Manrope", fontWeight: "500", fontSize: 13, lineHeight: 18, color: INK2, flex: 1 }}>
              I understand this action is permanent and cannot be undone
            </Text>
          </Pressable>

          <Pressable
            onPress={handleConfirm}
            disabled={!checked}
            accessibilityRole="button"
            accessibilityLabel="Permanently delete my account"
            accessibilityState={{ disabled: !checked }}
            style={{
              height: 54, borderRadius: 14,
              backgroundColor: MONZA600,
              justifyContent: "center", alignItems: "center",
              opacity: checked ? 1 : 0.4,
            }}
          >
            <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 15, color: "#FFFFFF" }}>
              Yes, permanently delete my account
            </Text>
          </Pressable>

          <Pressable
            onPress={() => { setPhase("initial"); setChecked(false); }}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={{
              height: 50, borderRadius: 14,
              borderWidth: 1.5, borderColor: LINE,
              justifyContent: "center", alignItems: "center",
            }}
          >
            <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 14, color: INK2 }}>
              Go back
            </Text>
          </Pressable>
        </View>
      ) : phase === "submitting" ? (
        <View style={{ height: 54, justifyContent: "center", alignItems: "center", marginBottom: 16 }}>
          <ActivityIndicator color={MONZA600} accessibilityLabel="Processing deletion request" />
        </View>
      ) : (
        <Pressable
          onPress={handleRequestDeletion}
          accessibilityRole="button"
          accessibilityLabel="Request account deletion"
          style={{
            height: 54, borderRadius: 14,
            backgroundColor: MONZA600,
            justifyContent: "center", alignItems: "center",
            marginBottom: 16, flexDirection: "row", gap: 8,
          }}
        >
          <WarningCircle size={20} color="#FFFFFF" />
          <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 15, color: "#FFFFFF" }}>
            Request account deletion
          </Text>
        </Pressable>
      )}

      {error ? (
        <Text
          style={{
            fontFamily: "Manrope", fontWeight: "500", fontSize: 11.5,
            color: MONZA600, textAlign: "center", marginTop: 4,
          }}
        >
          {error}
        </Text>
      ) : null}
    </View>
  );
}
