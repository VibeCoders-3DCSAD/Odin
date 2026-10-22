import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import type { SeasonalPreferences } from "@odin/spending-insights/seasons";
import { useConnectivityStore } from "../../services/connectivity";
import { getPreferences } from "./api";
import { PREFERENCE_GROUPS, type SeasonalPreferenceKey } from "./helpers/preferenceDraft";
import { PreferencesContent } from "./components/PreferencesContent";

type Props = { accessToken: string; userId: string; onBack: () => void };
type LoadState = { userId: string; status: "loading" | "loaded" | "error"; preferences: SeasonalPreferences | null };

export default function PreferencesScreen({ accessToken, userId, onBack }: Props) {
  const online = useConnectivityStore((state) => state.online);
  const [selectedGroup, setSelectedGroup] = useState<SeasonalPreferenceKey | null>(null);
  const [saving, setSaving] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<LoadState>({ userId, status: "loading", preferences: null });
  useEffect(() => {
    setSelectedGroup(null);
    setSaving(false);
  }, [userId]);

  useEffect(() => {
    let cancelled = false;
    if (!online || (state.userId === userId && state.status === "loaded")) return;
    setState({ userId, status: "loading", preferences: null });
    getPreferences(accessToken).then(({ response, body }) => {
      if (cancelled) return;
      if (!response.ok || !body.payload) { setState({ userId, status: "error", preferences: null }); return; }
      setState({ userId, status: "loaded", preferences: body.payload.preferences });
    }).catch(() => {
      if (!cancelled) setState({ userId, status: "error", preferences: null });
    });
    return () => { cancelled = true; };
  }, [accessToken, userId, online, attempt]);

  const preferences = state.userId === userId && state.status === "loaded" ? state.preferences : null;
  return (
    <View style={{ gap: 16 }}>
      <Pressable accessibilityRole="button" accessibilityLabel={selectedGroup ? "Back to preferences" : "Back to settings"} disabled={saving} onPress={() => selectedGroup ? setSelectedGroup(null) : onBack()} style={{ paddingVertical: 12 }}><Text style={{ color: "#0B8A55", fontWeight: "700" }}>{selectedGroup ? "Back to preferences" : "Back to settings"}</Text></Pressable>
      <Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 20, color: "#1B1C1A" }}>{PREFERENCE_GROUPS.find((group) => group.key === selectedGroup)?.label ?? "Preferences"}</Text>
      <Text style={{ fontFamily: "Manrope", fontSize: 14, color: "#6B7A6F" }}>{selectedGroup ? "Choose the seasons that apply, or add a custom event." : "Manage your seasonal preferences and custom events."}</Text>
      {!online && !preferences ? <Text>Connect to the internet to view your saved preferences.</Text>
        : state.userId !== userId || state.status === "loading" ? <ActivityIndicator accessibilityLabel="Loading saved preferences" color="#08B16A" />
        : state.status === "error" ? (
          <View style={{ gap: 12 }}>
            <Text accessibilityRole="alert">Unable to load your saved preferences.</Text>
            <Pressable accessibilityRole="button" onPress={() => setAttempt((value) => value + 1)} style={{ paddingVertical: 12 }}><Text style={{ color: "#0B8A55", fontWeight: "700" }}>Retry</Text></Pressable>
          </View>
        ) : !preferences ? <Text>No submitted questionnaire yet. Your seasonal answers will appear here after you submit it.</Text>
        : <PreferencesContent key={userId} preferences={preferences} accessToken={accessToken} online={online} selectedGroup={selectedGroup} onSelectGroup={setSelectedGroup} onSavingChange={setSaving} />}
    </View>
  );
}
