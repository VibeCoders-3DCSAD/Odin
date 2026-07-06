import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Linking,
  Pressable,
  Text,
  View,
} from "react-native";
import { Check, ShieldCheck } from "phosphor-react-native";
import { submitConsent } from "./api";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

const CONSENT_VERSION = "2026-06";

const MUTED = "#6B7A6F";
const LINE = "#EAEAE6";
const INK = "#1B1C1A";
const INK2 = "#414942";
const AQUA50 = "#EFFEF7";
const AQUA600 = "#08B16A";
const AQUA700 = "#0B8A55";
const AQUA950 = "#013220";
const CARD = "#FCF8F0";

type PrivacyConsentScreenProps = {
  visible: boolean;
  accessToken: string;
  onComplete: () => void;
  onDismiss?: () => void;
  consentVersion?: string;
};

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.name === "AbortError") {
    return "The request timed out. Check your connection and try again.";
  }
  return error instanceof Error ? error.message : "Something went wrong.";
}

export default function PrivacyConsentScreen({
  visible,
  accessToken,
  onComplete,
  onDismiss,
  consentVersion = CONSENT_VERSION,
}: PrivacyConsentScreenProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [consented, setConsented] = useState(false);
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  const open = useCallback(() => {
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 350,
      useNativeDriver: true,
    }).start();
  }, [slideAnim]);

  const close = useCallback((cb?: () => void) => {
    Animated.timing(slideAnim, {
      toValue: SCREEN_HEIGHT,
      duration: 250,
      useNativeDriver: true,
    }).start(() => cb?.());
  }, [slideAnim]);

  useEffect(() => {
    if (visible && !submitting && !consented) open();
  }, [visible]);

  async function handleAgree() {
    setSubmitting(true);
    setError(null);
    try {
      const { response } = await submitConsent(accessToken, {
        consent_kind: "terms",
        status: "granted",
        version: consentVersion,
      });
      if (!response.ok) {
        setError("Consent service is unavailable. Please try again.");
        setSubmitting(false);
        return;
      }
      setConsented(true);
      setTimeout(() => close(onComplete), 600);
    } catch (err) {
      setError(getErrorMessage(err));
      setSubmitting(false);
    }
  }

  if (!visible && !consented) return null;

  if (consented) {
    return (
      <View
        style={{
          position: "absolute", inset: 0,
          backgroundColor: "rgba(1,50,32,0.5)",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <View
          style={{
            width: 72, height: 72, borderRadius: 36,
            backgroundColor: AQUA50,
            justifyContent: "center", alignItems: "center",
          }}
        >
          <Check size={40} color={AQUA600} weight="bold" />
        </View>
      </View>
    );
  }

  return (
    <View
      style={{
        position: "absolute", inset: 0,
        backgroundColor: "rgba(1,50,32,0.4)",
        justifyContent: "flex-end",
      }}
    >
      <Pressable
        style={{ flex: 1 }}
        onPress={() => { if (!submitting) close(onDismiss); }}
        accessibilityLabel="Dismiss consent"
        accessibilityRole="button"
      />
      <Animated.View
        style={{
          transform: [{ translateY: slideAnim }],
          backgroundColor: CARD,
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          borderBottomLeftRadius: 34,
          borderBottomRightRadius: 34,
          shadowColor: AQUA950,
          shadowOffset: { width: 0, height: -16 },
          shadowOpacity: 0.16,
          shadowRadius: 40,
          elevation: 16,
          padding: 22,
          paddingBottom: 30,
        }}
      >
        <View
          style={{
            width: 38, height: 4, borderRadius: 4,
            backgroundColor: LINE,
            alignSelf: "center",
            marginBottom: 18,
          }}
        />
        <View style={{ flexDirection: "row", gap: 10, alignItems: "center", marginBottom: 12 }}>
          <ShieldCheck size={22} color={AQUA700} />
          <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 17, color: INK }}>
            Privacy & consent
          </Text>
        </View>
        <Text
          style={{
            fontFamily: "Manrope", fontWeight: "400", fontSize: 13, lineHeight: 20.8,
            color: INK2, marginBottom: 16,
          }}
        >
          Odin processes your financial data to deliver budgeting insights and forecasts. We never
          sell your data.{" "}
        </Text>
        <Pressable
          onPress={() => Linking.openURL("https://vibecoders.com/privacy")}
          accessibilityRole="link"
          accessibilityLabel="Read full privacy policy"
          style={{ alignSelf: "flex-start", marginTop: -12, marginBottom: 16 }}
        >
          <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 13, color: AQUA700 }}>
            Read full policy
          </Text>
        </Pressable>
        <View
          style={{
            flexDirection: "row", gap: 11, alignItems: "flex-start",
            padding: 13, borderRadius: 13,
            backgroundColor: AQUA50, marginBottom: 10,
          }}
        >
          <View
            style={{
              width: 22, height: 22, borderRadius: 6,
              backgroundColor: AQUA600,
              justifyContent: "center", alignItems: "center",
            }}
          >
            <Check size={14} color="#FFFFFF" weight="bold" />
          </View>
          <Text
            style={{
              fontFamily: "Manrope", fontWeight: "500", fontSize: 13, lineHeight: 18.85,
              color: INK2, flex: 1,
            }}
          >
            I agree to the Terms of Service and Privacy Policy
          </Text>
        </View>
        <View
          style={{
            flexDirection: "row", justifyContent: "space-between",
            marginBottom: 16,
          }}
        >
          <Text style={{ fontFamily: "Manrope", fontWeight: "500", fontSize: 11, color: MUTED }}>
            Policy v{consentVersion}
          </Text>
          <Text style={{ fontFamily: "Manrope", fontWeight: "500", fontSize: 11, color: MUTED }}>
            Accepted {new Date().toLocaleDateString("en-US", {
              month: "short", day: "numeric", year: "numeric",
            })}, {new Date().toLocaleTimeString("en-US", {
              hour: "numeric", minute: "2-digit", hour12: true,
            }).toLowerCase()}
          </Text>
        </View>
        <Pressable
          onPress={handleAgree}
          disabled={submitting}
          accessibilityRole="button"
          accessibilityLabel="Agree and continue"
          accessibilityState={{ disabled: submitting }}
          style={{
            height: 54, borderRadius: 14,
            backgroundColor: AQUA950,
            justifyContent: "center", alignItems: "center",
            opacity: submitting ? 0.5 : 1,
            shadowColor: AQUA950,
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.28,
            shadowRadius: 20,
            elevation: 6,
          }}
        >
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 15.5, color: "#FFFFFF" }}>
              Agree & continue
            </Text>
          )}
        </Pressable>
        {error ? (
          <Text
            style={{
              fontFamily: "Manrope", fontWeight: "500", fontSize: 11.5,
              color: "#D9001F", textAlign: "center", marginTop: 12,
            }}
          >
            {error}
          </Text>
        ) : null}
      </Animated.View>
    </View>
  );
}
