import { useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { eventMonthLabel, seasonalPreferencesError, type CustomSeasonalEvent, type SeasonalPreferences } from "@odin/spending-insights/seasons";
import { CustomSeasonalEventForm } from "../../onboarding/components/CustomSeasonalEventForm";
import { PREFERENCE_GROUPS, preferenceChoices, removeCustomEvent, togglePreference, type SeasonalPreferenceKey } from "../helpers/preferenceDraft";

type Props = { group: SeasonalPreferenceKey; preferences: SeasonalPreferences; online: boolean; saving: boolean; error: string | null; onSave: (draft: SeasonalPreferences) => void; onCancel: () => void };

export function PreferencesEditor({ group, preferences, online, saving, error, onSave, onCancel }: Props) {
  const [draft, setDraft] = useState(preferences);
  const [editingEvent, setEditingEvent] = useState<string | null>(null);
  const [addingEvent, setAddingEvent] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const choices = preferenceChoices(draft);
  const upsertEvent = (event: CustomSeasonalEvent) => {
    setDraft((previous) => {
      const exists = previous.custom_seasonal_events.some((item) => item.id === event.id);
      const next = { ...previous, custom_seasonal_events: exists
        ? previous.custom_seasonal_events.map((item) => item.id === event.id ? event : item)
        : [...previous.custom_seasonal_events, event] };
      return exists ? next : togglePreference(next, group, event.id);
    });
    setEditingEvent(null);
    setValidationError(null);
  };
  return (
    <View style={{ gap: 16 }}>
      <View pointerEvents={saving ? "none" : "auto"} accessibilityState={{ disabled: saving }} style={{ gap: 16, opacity: saving ? 0.5 : 1 }}>
        {PREFERENCE_GROUPS.filter((item) => item.key === group).map(({ key, label }) => (
          <View key={key} style={{ gap: 8 }}>
            {choices.filter((choice) => key !== "low_expense_seasons" || choice.key === "none" || !draft.high_expense_seasons.includes(choice.key)).map((choice) => {
              const checked = draft[key].includes(choice.key);
              return (
                <Pressable key={choice.key} accessibilityRole="checkbox" accessibilityLabel={`${label}: ${choice.label}`} accessibilityState={{ checked, disabled: saving }} disabled={saving} onPress={() => { setDraft((previous) => togglePreference(previous, key, choice.key)); setValidationError(null); }} style={{ padding: 12, borderWidth: 1, borderColor: checked ? "#08B16A" : "#EAEAE6", borderRadius: 12, backgroundColor: checked ? "#EFFEF7" : "#FCF8F0" }}>
                  <Text>{checked ? "✓ " : ""}{choice.label}</Text>
                  {choice.months ? <Text style={{ color: "#6B7A6F", marginTop: 4 }}>{choice.months}</Text> : null}
                </Pressable>
              );
            })}
          </View>
        ))}
        <Text style={{ fontWeight: "700", fontSize: 14 }}>Custom events</Text>
        {draft.custom_seasonal_events.map((event) => editingEvent === event.id ? (
          <CustomSeasonalEventForm key={event.id} events={draft.custom_seasonal_events} event={event} onAdd={upsertEvent} onCancel={() => setEditingEvent(null)} />
        ) : (
          <View key={event.id} style={{ gap: 8 }}>
            <Text>{event.name} · {eventMonthLabel(event.months)}</Text>
            <View style={{ flexDirection: "row", gap: 24 }}>
              <Pressable accessibilityRole="button" accessibilityLabel={`Edit event ${event.name}`} disabled={saving} onPress={() => setEditingEvent(event.id)} style={{ paddingVertical: 12 }}><Text style={{ color: "#0B8A55" }}>Edit event</Text></Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel={`Remove event ${event.name}`} disabled={saving} onPress={() => Alert.alert("Remove custom event?", `Remove ${event.name} and its seasonal selections when you save preferences. You can cancel editing to keep it.`, [{ text: "Cancel", style: "cancel" }, { text: "Remove", style: "destructive", onPress: () => setDraft((previous) => removeCustomEvent(previous, event.id)) }])} style={{ paddingVertical: 12 }}><Text style={{ color: "#D9001F" }}>Remove event</Text></Pressable>
            </View>
          </View>
        ))}
        <CustomSeasonalEventForm addLabel="Add event" events={draft.custom_seasonal_events} onAdd={upsertEvent} onEditingChange={setAddingEvent} />
      </View>
      {validationError || error ? <Text accessibilityRole="alert" style={{ color: "#D9001F" }}>{validationError ?? error}</Text> : null}
      {!online ? <Text>Connect to the internet to save preferences. Your edits are still here.</Text> : null}
      {editingEvent || addingEvent ? <Text>Save or cancel the event before saving preferences.</Text> : null}
      <Pressable accessibilityRole="button" accessibilityLabel="Save preferences" accessibilityState={{ disabled: saving || !online || addingEvent || Boolean(editingEvent), busy: saving }} disabled={saving || !online || addingEvent || Boolean(editingEvent)} onPress={() => { const next = group === "high_expense_seasons" && !draft.low_expense_seasons.length ? { ...draft, low_expense_seasons: ["none"] } : draft; const message = seasonalPreferencesError(next); setValidationError(message); if (!message) onSave(next); }} style={{ padding: 16, borderRadius: 12, backgroundColor: saving || !online || addingEvent || editingEvent ? "#6B7A6F" : "#0B8A55" }}><Text style={{ color: "white", fontWeight: "700" }}>{saving ? "Saving..." : "Save preferences"}</Text></Pressable>
      <Pressable accessibilityRole="button" disabled={saving} onPress={onCancel} style={{ paddingVertical: 12 }}><Text>Cancel changes</Text></Pressable>
    </View>
  );
}
