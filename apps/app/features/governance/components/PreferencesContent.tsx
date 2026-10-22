import { useEffect, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import type { SeasonalPreferences } from "@odin/spending-insights/seasons";
import { CaretRight } from "phosphor-react-native";
import { savePreferences } from "../api";
import { seasonalPreferenceLabels } from "../helpers/seasonalPreferenceLabels";
import { PREFERENCE_GROUPS, type SeasonalPreferenceKey } from "../helpers/preferenceDraft";
import { PreferencesEditor } from "./PreferencesEditor";

type Props = {
  preferences: SeasonalPreferences;
  accessToken: string;
  online: boolean;
  onSavingChange: (saving: boolean) => void;
  selectedGroup: SeasonalPreferenceKey | null;
  onSelectGroup: (group: SeasonalPreferenceKey | null) => void;
};

export function PreferencesContent({ preferences: initialPreferences, accessToken, online, selectedGroup, onSelectGroup, onSavingChange }: Props) {
  const [preferences, setPreferences] = useState(initialPreferences);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const mounted = useRef(true);
  const inFlight = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  async function save(draft: SeasonalPreferences) {
    if (!online || inFlight.current) return;
    inFlight.current = true;
    setSaving(true); onSavingChange(true); setError(null); setSaved(false);
    try {
      const { response, body } = await savePreferences(accessToken, draft);
      if (!mounted.current) return;
      if (!response.ok || !body.payload) { setError(body.message ?? "Unable to save preferences. Please try again."); return; }
      setPreferences(body.payload.preferences);
      onSelectGroup(null); setSaved(true);
    } catch {
      if (mounted.current) setError("Unable to save preferences. Please try again.");
    } finally {
      inFlight.current = false;
      if (mounted.current) { setSaving(false); onSavingChange(false); }
    }
  }

  if (selectedGroup) return <PreferencesEditor key={selectedGroup} group={selectedGroup} preferences={preferences} online={online} saving={saving} error={error} onSave={save} onCancel={() => { onSelectGroup(null); setError(null); }} />;
  return (
    <View style={{ gap: 16 }}>
      {saved ? <Text accessibilityRole="alert" style={{ color: "#0B8A55" }}>Preferences saved</Text> : null}
      <View style={{ borderWidth: 1, borderColor: "#EAEAE6", borderRadius: 16, overflow: "hidden" }}>
        {PREFERENCE_GROUPS.map(({ key, label }, index) => (
          <Pressable key={key} accessibilityRole="button" accessibilityLabel={label}
            onPress={() => { onSelectGroup(key); setSaved(false); setError(null); }}
            style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 16, borderTopWidth: index ? 1 : 0, borderTopColor: "#EAEAE6" }}>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 14, color: "#1B1C1A" }}>{label}</Text>
              <Text style={{ fontFamily: "Manrope", fontSize: 12, color: "#6B7A6F" }}>
                {seasonalPreferenceLabels(preferences[key], preferences).join(" · ") || "Not answered"}
              </Text>
            </View>
            <CaretRight size={16} color="#6B7A6F" weight="bold" />
          </Pressable>
        ))}
      </View>
    </View>
  );
}
