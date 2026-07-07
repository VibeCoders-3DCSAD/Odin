import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  Text,
  View,
} from "react-native";
import { CalendarBlank, CaretRight, Clock, ShieldCheck, XCircle } from "phosphor-react-native";
import { cancelAccountDeletion } from "./api";
import type { AccountDeletionRequest } from "./types";
import { getErrorMessage } from "./helpers";

type DeletionRequestedScreenProps = {
  accessToken: string;
  deletionRequest: AccountDeletionRequest;
  onCancelled: () => void;
  onBack: () => void;
};

const MUTED = "#6B7A6F";
const LINE = "#EAEAE6";
const INK = "#1B1C1A";
const INK2 = "#414942";
const AQUA50 = "#EFFEF7";
const AQUA600 = "#08B16A";
const AQUA700 = "#0B8A55";
const CARD = "#FCF8F0";
const MONZA50 = "#FFF0F2";
const MONZA600 = "#D9001F";

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });
}

export default function DeletionRequestedScreen({ accessToken, deletionRequest, onCancelled, onBack }: DeletionRequestedScreenProps) {
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cancelled, setCancelled] = useState(false);

  async function handleCancel() {
    setCancelling(true);
    setError(null);
    try {
      const { response, body } = await cancelAccountDeletion(accessToken, deletionRequest.id);
      if (!response.ok) {
        setError(body.message ?? "Failed to cancel deletion request.");
        setCancelling(false);
        return;
      }
      setCancelled(true);
      onCancelled();
    } catch (err) {
      setError(getErrorMessage(err));
      setCancelling(false);
    }
  }

  if (cancelled) {
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

        <View
          style={{
            borderRadius: 16, borderWidth: 1, borderColor: LINE, overflow: "hidden",
            backgroundColor: CARD, padding: 20, alignItems: "center", gap: 12, marginBottom: 16,
          }}
        >
          <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: AQUA50, justifyContent: "center", alignItems: "center" }}>
            <ShieldCheck size={28} color={AQUA600} weight="fill" />
          </View>
          <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 17, color: INK, textAlign: "center" }}>
            Deletion cancelled
          </Text>
          <Text style={{ fontFamily: "Manrope", fontWeight: "400", fontSize: 13, lineHeight: 19, color: INK2, textAlign: "center" }}>
            Your account deletion request has been cancelled. Your account and data are safe.
          </Text>
        </View>
      </View>
    );
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
        Deletion requested
      </Text>

      <View
        style={{
          borderRadius: 16, borderWidth: 1, borderColor: LINE, overflow: "hidden",
          backgroundColor: CARD, marginBottom: 16,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 15 }}>
          <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: AQUA600 }} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 13.5, color: INK }}>
              {deletionRequest.status === "processing" ? "Processing deletion" : "Deletion requested"}
            </Text>
            <Text style={{ fontFamily: "Manrope", fontWeight: "400", fontSize: 11, color: AQUA700, marginTop: 1 }}>
              Your request is being processed
            </Text>
          </View>
        </View>

        <View style={{ borderTopWidth: 1, borderTopColor: LINE }} />

        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 15 }}>
          <CalendarBlank size={20} color={MUTED} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 13.5, color: INK }}>
              Scheduled deletion
            </Text>
            <Text style={{ fontFamily: "Manrope", fontWeight: "400", fontSize: 11, color: MUTED, marginTop: 1 }}>
              {deletionRequest.scheduled_delete_at
                ? formatDate(deletionRequest.scheduled_delete_at)
                : "To be determined"}
            </Text>
          </View>
        </View>

        <View style={{ borderTopWidth: 1, borderTopColor: LINE }} />

        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 15 }}>
          <Clock size={20} color={MUTED} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 13.5, color: INK }}>
              Requested
            </Text>
            <Text style={{ fontFamily: "Manrope", fontWeight: "400", fontSize: 11, color: MUTED, marginTop: 1 }}>
              {formatDate(deletionRequest.requested_at)}
            </Text>
          </View>
        </View>
      </View>

      <Pressable
        onPress={handleCancel}
        disabled={cancelling}
        accessibilityRole="button"
        accessibilityLabel="Cancel deletion request"
        accessibilityState={{ disabled: cancelling }}
        style={{
          height: 54, borderRadius: 14,
          borderWidth: 1.5, borderColor: MONZA600,
          backgroundColor: MONZA50,
          justifyContent: "center", alignItems: "center",
          flexDirection: "row", gap: 8,
          opacity: cancelling ? 0.5 : 1,
          marginBottom: 16,
        }}
      >
        {cancelling ? (
          <ActivityIndicator color={MONZA600} />
        ) : (
          <>
            <XCircle size={20} color={MONZA600} />
            <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 15, color: MONZA600 }}>
              Cancel deletion request
            </Text>
          </>
        )}
      </Pressable>

      <Text
        style={{
          fontFamily: "Manrope", fontWeight: "400", fontSize: 11.5, lineHeight: 17,
          color: MUTED, textAlign: "center", paddingHorizontal: 8,
        }}
      >
        You can cancel this request at any time before the scheduled deletion date. After deletion, your data cannot be recovered.
      </Text>

      {error ? (
        <Text
          style={{
            fontFamily: "Manrope", fontWeight: "500", fontSize: 11.5,
            color: MONZA600, textAlign: "center", marginTop: 12,
          }}
        >
          {error}
        </Text>
      ) : null}
    </View>
  );
}
