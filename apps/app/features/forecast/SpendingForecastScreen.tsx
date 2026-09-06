import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { ArrowLeft, Sparkle } from "phosphor-react-native";
import { getSnapshot, upsertSnapshot } from "../../local-db/repositories/dashboardSnapshots";
import type { DashboardSnapshotWithMeta } from "../../local-db/repositories/dashboardSnapshots";
import { getForecastContent } from "../dashboard/dashboardSnapshotContent";
import { ForecastPanel } from "../dashboard/components/ForecastPanel";
import { getForecast } from "./api";
import { ForecastLineChart } from "./ForecastLineChart";
import type { ForecastHorizon } from "./types";

type Props = { userId: string; accessToken: string; onBack: () => void };

const palette = {
  ink: "#1B1C1A",
  ink2: "#414942",
  mut: "#6B7A6F",
  brand: "#013220",
  aqua600: "#08B16A",
  aqua700: "#0B8A55",
  aqua50: "#EFFEF7",
  sun50: "#FFF8F0",
  sun800: "#8A4A00",
  slate50: "#EAEFF4",
  slate800: "#415164",
  line: "#EAEAE6",
  error: "#D9001F",
  errorBg: "#FFF0F2",
} as const;

type TrustBadge = { label: string; background: string; color: string } | null;

function trustBadge(confidence: string | null): TrustBadge {
  if (!confidence) return null;
  if (/personalized/i.test(confidence)) return { label: "Personalized estimate", background: palette.aqua50, color: palette.aqua700 };
  if (/fallback/i.test(confidence)) return { label: "Fallback estimate", background: palette.sun50, color: palette.sun800 };
  if (/cold.start/i.test(confidence)) return { label: "Cold-start estimate", background: palette.slate50, color: palette.slate800 };
  return null;
}

function formatUpdatedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
}

export default function SpendingForecastScreen({ userId, accessToken, onBack }: Props) {
  const [snapshot, setSnapshot] = useState<DashboardSnapshotWithMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedHorizon, setSelectedHorizon] = useState<ForecastHorizon>("monthly");

  const load = useCallback(async () => {
    try {
      const stored = await getSnapshot(userId, "forecast");
      setSnapshot(stored);
      setError(null);
    } catch {
      setError("Forecast information is unavailable. Refresh to try again.");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { void load(); }, [load]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const result = await getForecast(accessToken);
      if (!result.response.ok || !result.body.payload) throw new Error("forecast_fetch_failed");
      await upsertSnapshot(userId, "forecast", result.body.payload);
      await load();
    } catch {
      await load();
      setError("Forecast information is unavailable. Refresh to try again.");
    } finally {
      setRefreshing(false);
    }
  }, [accessToken, load, userId]);

  const forecast = getForecastContent(snapshot);
  const badge = trustBadge(forecast.confidence);
  const lastUpdate = snapshot ? formatUpdatedAt(snapshot.updated_at) : null;
  const activeHorizon = forecast.horizons.find((horizon) => horizon.key === selectedHorizon) ?? forecast.horizons[0];

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }}>
      <View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to dashboard"
          onPress={onBack}
          style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 14 }}
        >
          <ArrowLeft size={18} color={palette.ink} weight="bold" />
          <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 14, color: palette.mut }}>Dashboard</Text>
        </Pressable>

        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: palette.aqua600, justifyContent: "center", alignItems: "center" }}>
            <Sparkle size={18} color="#FFFFFF" weight="fill" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 20, color: palette.ink }}>Spending Forecast</Text>
            <Text style={{ fontFamily: "Manrope", fontSize: 12, color: palette.mut, marginTop: 2 }}>Predictive insights</Text>
          </View>
        </View>

        {loading && !snapshot ? (
          <ActivityIndicator color={palette.aqua700} style={{ marginTop: 48 }} />
        ) : (
          <>
            {badge || lastUpdate ? (
              <View style={{ marginTop: 18 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  {badge ? (
                    <View style={{ paddingVertical: 5, paddingHorizontal: 12, borderRadius: 999, backgroundColor: badge.background }}>
                      <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 12, color: badge.color }}>{badge.label}</Text>
                    </View>
                  ) : null}
                  <Text style={{ flex: 1, fontFamily: "Manrope", fontSize: 12, color: palette.mut }}>
                    {[forecast.freshness, lastUpdate ? `Last update ${lastUpdate}` : null].filter(Boolean).join(" · ")}
                  </Text>
                </View>
              </View>
            ) : null}

            {error ? (
              <View style={{ marginTop: 16, padding: 16, borderRadius: 16, backgroundColor: palette.errorBg }}>
                <Text style={{ fontFamily: "Manrope", fontSize: 13, lineHeight: 20, color: palette.error }}>{error}</Text>
                <Pressable accessibilityRole="button" accessibilityLabel="Retry forecast refresh" onPress={refresh} style={{ marginTop: 8 }}>
                  <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 13, color: palette.error }}>Try again</Text>
                </Pressable>
              </View>
            ) : null}

            {refreshing ? <ActivityIndicator size="small" color={palette.aqua700} style={{ marginTop: 16 }} /> : null}

            {forecast.horizons.length > 0 ? (
              <>
                <View accessibilityRole="tablist" style={{ flexDirection: "row", gap: 8, marginTop: 20 }}>
                  {forecast.horizons.map((horizon) => (
                    <Pressable
                      key={horizon.key}
                      accessibilityRole="tab"
                      accessibilityState={{ selected: activeHorizon?.key === horizon.key }}
                      accessibilityLabel={`${horizon.label} forecast`}
                      onPress={() => setSelectedHorizon(horizon.key)}
                      style={{ flex: 1, paddingVertical: 9, borderRadius: 10, backgroundColor: activeHorizon?.key === horizon.key ? palette.brand : palette.aqua50, alignItems: "center" }}
                    >
                      <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 11, color: activeHorizon?.key === horizon.key ? "#FFFFFF" : palette.aqua700 }}>{horizon.label}</Text>
                    </Pressable>
                  ))}
                </View>
                {activeHorizon ? <ForecastLineChart horizon={activeHorizon} /> : null}
              </>
            ) : null}

            <ForecastPanel
              forecast={forecast}
              stale={snapshot?.stale ?? false}
              unavailable={!!error}
              refreshable
              onRefresh={refresh}
              onNavigate={onBack}
            />
          </>
        )}
      </View>
    </ScrollView>
  );
}
