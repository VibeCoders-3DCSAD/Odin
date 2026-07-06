import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  Text,
  View,
} from "react-native";
import { CheckCircle, DownloadSimple, FileText, ShieldCheck } from "phosphor-react-native";
import { requestDataExport } from "./api";

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
};

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.name === "AbortError") {
    return "The request timed out. Check your connection and try again.";
  }
  return error instanceof Error ? error.message : "Something went wrong.";
}

export default function UserProfileScreen({ accessToken }: UserProfileScreenProps) {
  const [exporting, setExporting] = useState(false);
  const [exported, setExported] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
              We'll notify you when your data is ready to download.
            </Text>
          </View>
        </View>
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
