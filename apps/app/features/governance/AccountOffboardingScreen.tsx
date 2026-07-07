import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  ArrowLeft,
  Brain,
  ChartPieSlice,
  Check,
  DownloadSimple,
  LockSimple,
  Receipt,
  Warning,
} from "phosphor-react-native";
import { confirmAccountDeletion, requestAccountDeletion } from "./api";
import type { AccountDeletionRequest } from "./types";
import { ERRORS } from "./constants";
import { getErrorMessage } from "./helpers";

type AccountOffboardingScreenProps = {
  accessToken: string;
  onDeletionRequested: (request: AccountDeletionRequest) => void;
  onBack: () => void;
  onGoToExport?: () => void;
};

const MUTED = "#6B7A6F";
const LINE = "#EAEAE6";
const CANVAS = "#F8EFDC";
const INK = "#1B1C1A";
const INK2 = "#414942";
const AQUA50 = "#EFFEF7";
const AQUA600 = "#08B16A";
const AQUA700 = "#0B8A55";
const AQUA100 = "#D9FFEE";
const AQUA800 = "#0E6D46";
const MONZA50 = "#FFF0F2";
const MONZA500 = "#E53935";
const MONZA600 = "#D9001F";
const MONZA300 = "#FFCDD2";

export default function AccountOffboardingScreen({ accessToken, onDeletionRequested, onBack, onGoToExport }: AccountOffboardingScreenProps) {
  const [checked, setChecked] = useState(false);
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = checked && password.length > 0 && !submitting;

  async function handleDelete() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const { response, body } = await requestAccountDeletion(accessToken);
      if (!response.ok) {
        if (response.status === 409 || body.message?.includes("active")) {
          setError(ERRORS.ACTIVE_DELETION_REQUEST);
        } else {
          setError(body.message ?? "Failed to create deletion request.");
        }
        setSubmitting(false);
        return;
      }
      const delRequest = (body as { payload?: { request: AccountDeletionRequest } }).payload?.request;
      if (!delRequest) {
        setError(ERRORS.UNEXPECTED_RESPONSE);
        setSubmitting(false);
        return;
      }
      const { response: confirmRes, body: confirmBody } = await confirmAccountDeletion(accessToken, delRequest.id);
      if (!confirmRes.ok) {
        setError(confirmBody.message ?? "Failed to confirm deletion.");
        setSubmitting(false);
        return;
      }
      const confirmed = (confirmBody as { payload?: { request: AccountDeletionRequest } }).payload?.request;
      onDeletionRequested(confirmed ?? { ...delRequest, status: "processing" });
    } catch (err) {
      setError(getErrorMessage(err));
      setSubmitting(false);
    }
  }

  return (
    <View>
      <View style={{ paddingHorizontal: 22, paddingTop: 12, flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel="Go back">
          <ArrowLeft size={21} color={INK} />
        </Pressable>
        <Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 20, color: INK }}>
          Delete account
        </Text>
      </View>

      <View style={{ flexDirection: "row", gap: 6, paddingHorizontal: 22, paddingTop: 14, marginBottom: 6 }}>
        <View style={{ flex: 1, height: 5, borderRadius: 5, backgroundColor: MONZA500 }} />
        <View style={{ flex: 1, height: 5, borderRadius: 5, backgroundColor: MONZA500 }} />
        <View style={{ flex: 1, height: 5, borderRadius: 5, backgroundColor: MONZA500 }} />
      </View>

      <View style={{ paddingHorizontal: 22, paddingVertical: 16 }}>
        <View style={{ alignItems: "center", marginBottom: 18 }}>
          <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: MONZA50, justifyContent: "center", alignItems: "center", marginBottom: 12 }}>
            <Warning size={28} color={MONZA600} weight="fill" />
          </View>
          <Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 19, color: INK }}>
            This can't be undone
          </Text>
          <Text style={{ fontFamily: "Manrope", fontWeight: "400", fontSize: 13, lineHeight: 19.5, color: MUTED, marginTop: 6, textAlign: "center" }}>
            Deleting your account permanently removes:
          </Text>
        </View>

        <View style={{ gap: 9, marginBottom: 16 }}>
          {([
            { icon: Receipt, text: "All transactions & history" },
            { icon: ChartPieSlice, text: "Budgets, goals & debt plans" },
            { icon: Brain, text: "Your behavioral profile" },
          ] as const).map(({ icon: Icon, text }) => (
            <View
              key={text}
              style={{
                flexDirection: "row", alignItems: "center", gap: 10,
                padding: 11, borderRadius: 11,
                backgroundColor: CANVAS, borderWidth: 1, borderColor: LINE,
              }}
            >
              <Icon size={16} color={MONZA600} />
              <Text style={{ fontFamily: "Manrope", fontWeight: "500", fontSize: 12.5, color: INK2, flex: 1 }}>
                {text}
              </Text>
            </View>
          ))}
        </View>

        <Pressable
          onPress={onGoToExport}
          accessibilityRole="button"
          accessibilityLabel="Export your data"
          style={{
            flexDirection: "row", alignItems: "center", gap: 10,
            padding: 13, borderRadius: 12, marginBottom: 16,
            backgroundColor: AQUA50, borderWidth: 1, borderColor: AQUA100,
          }}
        >
          <DownloadSimple size={18} color={AQUA700} weight="fill" />
          <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 12.5, color: AQUA800, flex: 1 }}>
            Export your data first
          </Text>
          <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 12, color: AQUA700 }}>
            Export
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setChecked(!checked)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked }}
          accessibilityLabel="I understand this permanently deletes my account and all data."
          style={{
            flexDirection: "row", gap: 11, alignItems: "flex-start",
            padding: 12, borderRadius: 12, marginBottom: 12,
            borderWidth: 1.5, borderColor: MONZA300,
          }}
        >
          <View
            style={{
              width: 22, height: 22, borderRadius: 6,
              backgroundColor: checked ? MONZA500 : "transparent",
              justifyContent: "center", alignItems: "center",
              flexShrink: 0,
            }}
          >
            {checked ? <Check size={14} color="#FFFFFF" weight="bold" /> : null}
          </View>
          <Text style={{ fontFamily: "Manrope", fontWeight: "500", fontSize: 12.5, lineHeight: 17.5, color: INK2, flex: 1 }}>
            I understand this permanently deletes my account and all data.
          </Text>
        </Pressable>

        <View
          style={{
            height: 50, paddingHorizontal: 16,
            borderWidth: 1.5, borderColor: LINE, borderRadius: 13,
            backgroundColor: CANVAS,
            flexDirection: "row", alignItems: "center", gap: 10,
            marginBottom: 18,
          }}
        >
          <LockSimple size={17} color={MUTED} />
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="Enter your password"
            placeholderTextColor={MUTED}
            secureTextEntry
            editable={!submitting}
            style={{
              flex: 1, fontFamily: "Manrope", fontWeight: "500", fontSize: 14,
              color: INK, letterSpacing: password.length > 0 ? 2 : 0,
            }}
            accessibilityLabel="Enter your password to confirm"
          />
        </View>

        <View style={{ gap: 10 }}>
          <Pressable
            onPress={handleDelete}
            disabled={!canSubmit}
            accessibilityRole="button"
            accessibilityLabel="Delete my account"
            accessibilityState={{ disabled: !canSubmit }}
            style={{
              height: 52, borderRadius: 14,
              backgroundColor: MONZA600,
              justifyContent: "center", alignItems: "center",
              opacity: canSubmit ? 1 : 0.4,
            }}
          >
            {submitting ? (
              <ActivityIndicator color="#FFFFFF" accessibilityLabel="Processing deletion request" />
            ) : (
              <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 15, color: "#FFFFFF" }}>
                Delete my account
              </Text>
            )}
          </Pressable>
          <Pressable
            onPress={onBack}
            disabled={submitting}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
            style={{
              height: 50, borderRadius: 14,
              borderWidth: 1.5, borderColor: LINE,
              justifyContent: "center", alignItems: "center",
              opacity: submitting ? 0.4 : 1,
            }}
          >
            <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 14, color: INK2 }}>
              Cancel
            </Text>
          </Pressable>
        </View>

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
    </View>
  );
}
