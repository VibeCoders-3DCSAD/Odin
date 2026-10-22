import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { customEventsError, MAX_CUSTOM_EVENTS, MAX_EVENT_NAME_LENGTH, MONTH_NAMES, normalizeCustomEvents, type CustomSeasonalEvent } from "@odin/spending-insights/seasons";
import { randomUUID } from "../../../local-db/uuid";

type Props = { addLabel?: string; events: CustomSeasonalEvent[]; onAdd: (event: CustomSeasonalEvent) => void; event?: CustomSeasonalEvent; onCancel?: () => void; onEditingChange?: (open: boolean) => void };

export function CustomSeasonalEventForm({ addLabel = "Add custom event", events, onAdd, event: existingEvent, onCancel, onEditingChange }: Props) {
  const [open, setOpen] = useState(Boolean(existingEvent));
  const [name, setName] = useState(existingEvent?.name ?? "");
  const [months, setMonths] = useState<number[]>(existingEvent?.months ?? []);
  const [error, setError] = useState<string | null>(null);
  function addEvent() {
    const event = { id: existingEvent?.id ?? `custom_${randomUUID()}`, name, months };
    const validationError = customEventsError([...events.filter((item) => item.id !== event.id), event]);
    if (validationError) { setError(validationError); return; }
    onAdd(normalizeCustomEvents([event])[0]!);
    onEditingChange?.(false);
    setName(""); setMonths([]); setError(null); setOpen(false);
  }
  if (!open) return (
    <Pressable accessibilityRole="button" disabled={events.length >= MAX_CUSTOM_EVENTS} onPress={() => { setOpen(true); onEditingChange?.(true); }} style={{ paddingVertical: 16 }}>
      <Text style={{ color: "#08B16A", fontWeight: "700" }}>{events.length >= MAX_CUSTOM_EVENTS ? "Custom event limit reached" : addLabel}</Text>
    </Pressable>
  );
  return (
    <View style={{ gap: 12, marginTop: 16 }}>
      <Text>Event name</Text>
      <TextInput accessibilityLabel="Event name" value={name} onChangeText={setName} maxLength={MAX_EVENT_NAME_LENGTH} placeholder="e.g. Tuition payment" style={{ borderWidth: 1, borderColor: "#6B7A6F", borderRadius: 12, padding: 12 }} />
      <Text>Month(s) — select all that apply</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {MONTH_NAMES.map((month, index) => {
          const number = index + 1;
          const selected = months.includes(number);
          return (
            <Pressable key={month} accessibilityRole="checkbox" accessibilityLabel={month} accessibilityState={{ checked: selected }} onPress={() => setMonths((previous) => selected ? previous.filter((value) => value !== number) : [...previous, number])} style={{ borderWidth: 1, borderColor: selected ? "#08B16A" : "#6B7A6F", backgroundColor: selected ? "#EFFEF7" : "#FCF8F0", borderRadius: 12, padding: 12 }}>
              <Text>{month}</Text>
            </Pressable>
          );
        })}
      </View>
      {error ? <Text accessibilityRole="alert" style={{ color: "#D9001F" }}>{error}</Text> : null}
      <View style={{ flexDirection: "row", gap: 24 }}>
        <Pressable accessibilityRole="button" onPress={addEvent} style={{ paddingVertical: 12 }}><Text style={{ color: "#08B16A", fontWeight: "700" }}>{existingEvent ? "Save event" : "Add event"}</Text></Pressable>
        <Pressable accessibilityRole="button" onPress={() => { setOpen(false); setError(null); onEditingChange?.(false); onCancel?.(); }} style={{ paddingVertical: 12 }}><Text>Cancel</Text></Pressable>
      </View>
    </View>
  );
}
