import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  Text,
  View,
} from "react-native";
import { CheckCircle, DownloadSimple, FileText, ShieldCheck } from "phosphor-react-native";
import { getDataExports, requestDataExport } from "./api";

const MUTED = "#6B7A6F";
const LINE = "#EAEAE6";
const LINE2 = "#F1F0EB";
const INK = "#1B1C1A";
const INK2 = "#414942";
const AQUA50 = "#EFFEF7";
const AQUA600 = "#08B16A";
const AQUA700 = "#0B8A55";
const AQUA950 = "#013220";
const CARD = "#FCF8F0";
const CANVAS = "#F8EFDC";

type UserProfileScreenProps = {
  accessToken: string;
  alreadyExported?: boolean;
  onExported?: () => void;
  onDone?: () => void;
};

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.name === "AbortError") {
    return "The request timed out. Check your connection and try again.";
  }
  return error instanceof Error ? error.message : "Something went wrong.";
}

export default function UserProfileScreen({ accessToken, alreadyExported, onExported, onDone }: UserProfileScreenProps) {
  const [exporting, setExporting] = useState(false);
  const [exported, setExported] = useState(alreadyExported ?? false);
  const [reRequesting, setReRequesting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchedExports = useRef(false);

  useEffect(() => {
    if (fetchedExports.current) return;
    fetchedExports.current = true;

    let cancelled = false;
    getDataExports(accessToken)
      .then((res) => {
        if (cancelled) return;
        if (!res.response.ok) return;
        const requests = (res.body as { payload?: { requests?: { status: string }[] } }).payload?.requests;
        if (requests?.some((r) => r.status === "requested" || r.status === "processing")) {
          setExported(true);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [accessToken]);

  async function handleExport() {
    setExporting(true);
    setError(null);
    try {
      const { response } = await requestDataExport(accessToken);
      if (!response.ok) {
        setError("Export service is unavailable. Please try again.");
        setExporting(false);
        return;
      }
      setExported(true);
      onExported?.();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setExporting(false);
    }
  }

  return (
    <View>
      <View
        style={{
          borderRadius: 16, borderWidth: 1, borderColor: LINE, overflow: "hidden",
          backgroundColor: CARD,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 15 }}>
          <ShieldCheck size={20} color={AQUA700} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 13.5, color: INK }}>
              Your data
            </Text>
            <Text style={{ fontFamily: "Manrope", fontWeight: "400", fontSize: 11, color: MUTED, marginTop: 1 }}>
              Export includes transactions, budgets, and profile
            </Text>
          </View>
        </View>
        <View style={{ borderTopWidth: 1, borderTopColor: LINE2 }} />
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 15 }}>
          <FileText size={20} color={MUTED} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 13.5, color: INK }}>
              Format
            </Text>
            <Text style={{ fontFamily: "Manrope", fontWeight: "400", fontSize: 11, color: MUTED, marginTop: 1 }}>
              JSON — all your data in a single archive
            </Text>
          </View>
        </View>
      </View>

      <View style={{ height: 20 }} />

      {exported ? (
        <>
          <View
            style={{
              flexDirection: "row", gap: 10, alignItems: "center",
              padding: 14, borderRadius: 14,
              backgroundColor: AQUA50, borderWidth: 1, borderColor: "#D9FFEE",
              marginBottom: 16,
            }}
          >
            <CheckCircle size={22} color={AQUA600} weight="fill" />
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 13, color: "#0E6D46" }}>
                Export requested
              </Text>
              <Text style={{ fontFamily: "Manrope", fontWeight: "400", fontSize: 11, color: AQUA700, marginTop: 1 }}>
                Your export is being prepared. Requesting again will cancel the previous one.
              </Text>
            </View>
          </View>
          {confirming ? (
            <View style={{ gap: 10, marginBottom: 12 }}>
              <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 13, color: INK2, textAlign: "center" }}>
                This will cancel your current export request and start a new one with the latest data.
              </Text>
              <Pressable
                onPress={async () => {
                  setReRequesting(true);
                  setConfirming(false);
                  setError(null);
                  try {
                    const { response } = await requestDataExport(accessToken);
                    if (!response.ok) {
                      setError("Export service is unavailable.");
                      setReRequesting(false);
                      return;
                    }
                    setReRequesting(false);
                    onExported?.();
                  } catch (err) {
                    setError(getErrorMessage(err));
                    setReRequesting(false);
                  }
                }}
                disabled={reRequesting}
                accessibilityRole="button"
                accessibilityLabel="Confirm new export"
                style={{
                  height: 54, borderRadius: 14,
                  backgroundColor: AQUA950,
                  justifyContent: "center", alignItems: "center",
                  opacity: reRequesting ? 0.5 : 1,
                }}
              >
                {reRequesting ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 15, color: "#FFFFFF" }}>
                    Yes, request new export
                  </Text>
                )}
              </Pressable>
              <Pressable
                onPress={() => setConfirming(false)}
                accessibilityRole="button"
                accessibilityLabel="Cancel"
                style={{ height: 50, borderRadius: 14, borderWidth: 1.5, borderColor: LINE, justifyContent: "center", alignItems: "center" }}
              >
                <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 14, color: INK2 }}>Cancel</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable
              onPress={() => setConfirming(true)}
              accessibilityRole="button"
              accessibilityLabel="Request new export"
              style={{
                height: 54, borderRadius: 14,
                backgroundColor: AQUA950,
                justifyContent: "center", alignItems: "center",
                marginBottom: 12,
                flexDirection: "row", gap: 8,
              }}
            >
              <DownloadSimple size={20} color="#FFFFFF" />
              <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 15, color: "#FFFFFF" }}>
                Request new export
              </Text>
            </Pressable>
          )}
          <Pressable
            onPress={onDone}
            accessibilityRole="button"
            accessibilityLabel="Back to settings"
            style={{
              height: 50, borderRadius: 14,
              borderWidth: 1.5, borderColor: LINE,
              justifyContent: "center", alignItems: "center",
              marginBottom: 16,
            }}
          >
            <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 14, color: INK2 }}>
              Back to Settings
            </Text>
          </Pressable>
        </>
      ) : (
        <Pressable
          onPress={handleExport}
          disabled={exporting}
          accessibilityRole="button"
          accessibilityLabel="Export my data"
          accessibilityState={{ disabled: exporting }}
          style={{
            height: 54, borderRadius: 14,
            backgroundColor: AQUA950,
            justifyContent: "center", alignItems: "center",
            flexDirection: "row", gap: 8,
            opacity: exporting ? 0.5 : 1,
            shadowColor: AQUA950,
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.28,
            shadowRadius: 20,
            elevation: 6,
            marginBottom: 16,
          }}
        >
          {exporting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <DownloadSimple size={20} color="#FFFFFF" />
              <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 15, color: "#FFFFFF" }}>
                Export my data
              </Text>
            </>
          )}
        </Pressable>
      )}

      <View
        style={{
          borderRadius: 14,
          borderWidth: 1.5, borderColor: LINE,
          padding: 15,
        }}
      >
        <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 11, color: MUTED, textTransform: "uppercase", letterSpacing: 0.55, marginBottom: 8 }}>
          What's included
        </Text>
        {[
          "Profile & account information",
          "All transaction history",
          "Budget plans & goals",
          "Debt management records",
          "Personalization preferences",
        ].map((item, i) => (
          <View
            key={item}
            style={{
              flexDirection: "row", alignItems: "center", gap: 10,
              paddingVertical: 8,
              borderTopWidth: i > 0 ? 1 : 0, borderTopColor: LINE2,
            }}
          >
            <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: AQUA600 }} />
            <Text style={{ fontFamily: "Manrope", fontWeight: "500", fontSize: 12.5, color: INK2 }}>
              {item}
            </Text>
          </View>
        ))}
      </View>

      {error ? (
        <Text
          style={{
            fontFamily: "Manrope", fontWeight: "500", fontSize: 11.5,
            color: "#D9001F", textAlign: "center", marginTop: 14,
          }}
        >
          {error}
        </Text>
      ) : null}
    </View>
  );
}
