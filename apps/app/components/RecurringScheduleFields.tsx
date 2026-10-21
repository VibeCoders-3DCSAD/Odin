import { Pressable, Text, TextInput, View } from "react-native";
import FrequencySelector from "./FrequencySelector";

const palette = {
  brand: "#013220",
  ink: "#1B1C1A",
  ink2: "#414942",
  muted: "#6B7A6F",
  line: "#EAEAE6",
  card: "#F1F0EB",
  white: "#FFFFFF",
  error: "#D9001F",
} as const;

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

export type RecurringScheduleFrequency =
  | "daily"
  | "weekly"
  | "biweekly"
  | "semi_monthly"
  | "monthly"
  | "quarterly"
  | "yearly"
  | "custom";

export type RecurringScheduleValue = {
  frequency: RecurringScheduleFrequency;
  intervalCount: string;
  dayOfMonth: string;
  secondDayOfMonth: string;
  dayOfWeek: number | null;
  monthOfYear: number | null;
  timeOfDay?: string;
};

type Props = {
  frequencies: readonly RecurringScheduleFrequency[];
  value: RecurringScheduleValue;
  onChange: (next: RecurringScheduleValue) => void;
  showInterval?: boolean;
  showIntervalCount?: boolean;
  frequencyLabel?: string;
  dayOfMonthError?: boolean;
  secondDayOfMonthError?: boolean;
  hideYearlyDetails?: boolean;
  showFrequencySelector?: boolean;
  weekdayLabels?: readonly string[];
  appearance?: "default" | "form";
};

function renderLabel(label: string, formAppearance: boolean) {
  return (
    <Text style={{ fontFamily: "Manrope", fontWeight: formAppearance ? "700" : "600", fontSize: 12, color: formAppearance ? palette.ink : palette.ink2, marginBottom: formAppearance ? 5 : 6 }}>
      {formAppearance ? label.charAt(0) + label.slice(1).toLowerCase() : label}
    </Text>
  );
}

function updateValue(value: RecurringScheduleValue, patch: Partial<RecurringScheduleValue>): RecurringScheduleValue {
  return { ...value, ...patch };
}

export default function RecurringScheduleFields({
  frequencies,
  value,
  onChange,
  showInterval = false,
  showIntervalCount = false,
  frequencyLabel = "FREQUENCY",
  dayOfMonthError = false,
  secondDayOfMonthError = false,
  hideYearlyDetails = false,
  showFrequencySelector = true,
  weekdayLabels = WEEKDAYS,
  appearance = "default",
}: Props) {
  const formAppearance = appearance === "form";
  const inputAppearance = formAppearance ? { backgroundColor: palette.white, borderRadius: 10, paddingHorizontal: 12, minHeight: 46 } : {};
  const shouldShowInterval = showInterval || showIntervalCount;
  const showDayOfWeek = value.frequency === "weekly" || value.frequency === "biweekly";

  return (
    <View style={{ gap: 16 }}>
      {showFrequencySelector ? <FrequencySelector frequencies={frequencies} value={value.frequency} onChange={(frequency) => onChange(updateValue(value, { frequency }))} label={frequencyLabel} /> : null}

      {shouldShowInterval && value.frequency !== "semi_monthly" && value.frequency !== "biweekly" ? (
        <View>
          {renderLabel("REPEAT EVERY", formAppearance)}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <TextInput
              value={value.intervalCount}
              onChangeText={(intervalCount) => onChange(updateValue(value, { intervalCount }))}
              placeholder="1"
              placeholderTextColor={palette.muted}
              keyboardType="number-pad"
              accessibilityLabel="Repeat interval"
              style={{ width: 72, height: 46, borderRadius: 12, borderWidth: 1, borderColor: palette.line, paddingHorizontal: 14, fontFamily: "Manrope", fontSize: 14, color: palette.ink, backgroundColor: palette.card, ...inputAppearance }}
            />
            <Text style={{ fontFamily: "Manrope", fontSize: 14, color: palette.ink2 }}>
              {value.frequency === "daily" ? "day(s)" : value.frequency === "weekly" ? "week(s)" : value.frequency === "monthly" ? "month(s)" : value.frequency === "quarterly" ? "quarter(s)" : "year(s)"}
            </Text>
          </View>
        </View>
      ) : null}

      {shouldShowInterval && value.frequency === "biweekly" ? (
        <Text style={{ fontFamily: "Manrope", fontSize: 13, color: palette.muted }}>
          Repeats every 2 weeks
        </Text>
      ) : null}

      {value.frequency === "monthly" ? (
        <View>
          {renderLabel("DAY OF MONTH", formAppearance)}
          <TextInput
            accessibilityLabel="Day of month"
            value={value.dayOfMonth}
            onChangeText={(dayOfMonth) => onChange(updateValue(value, { dayOfMonth }))}
            placeholder="15"
            placeholderTextColor={palette.muted}
            keyboardType="number-pad"
            style={{ height: 46, borderRadius: 12, borderWidth: 1, borderColor: dayOfMonthError ? palette.error : palette.line, paddingHorizontal: 14, fontFamily: "Manrope", fontSize: 14, color: palette.ink, backgroundColor: palette.card, ...inputAppearance }}
          />
        </View>
      ) : null}

      {value.frequency === "semi_monthly" ? (
        <>
          <View>
            {renderLabel("1ST DAY OF MONTH", formAppearance)}
            <TextInput
              accessibilityLabel="First day of month"
              value={value.dayOfMonth}
              onChangeText={(dayOfMonth) => onChange(updateValue(value, { dayOfMonth }))}
              placeholder="15"
              placeholderTextColor={palette.muted}
              keyboardType="number-pad"
              style={{ height: 46, borderRadius: 12, borderWidth: 1, borderColor: dayOfMonthError ? palette.error : palette.line, paddingHorizontal: 14, fontFamily: "Manrope", fontSize: 14, color: palette.ink, backgroundColor: palette.card, ...inputAppearance }}
            />
          </View>
          <View>
            {renderLabel("2ND DAY OF MONTH", formAppearance)}
            <TextInput
              accessibilityLabel="Second day of month"
              value={value.secondDayOfMonth}
              onChangeText={(secondDayOfMonth) => onChange(updateValue(value, { secondDayOfMonth }))}
              placeholder="30"
              placeholderTextColor={palette.muted}
              keyboardType="number-pad"
              style={{ height: 46, borderRadius: 12, borderWidth: 1, borderColor: secondDayOfMonthError ? palette.error : palette.line, paddingHorizontal: 14, fontFamily: "Manrope", fontSize: 14, color: palette.ink, backgroundColor: palette.card, ...inputAppearance }}
            />
          </View>
        </>
      ) : null}

      {showDayOfWeek ? (
        <View>
          {renderLabel("DAY OF WEEK", formAppearance)}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {weekdayLabels.map((day, index) => {
              const selected = value.dayOfWeek === index;
              return (
                <Pressable
                  key={day}
                  onPress={() => onChange(updateValue(value, { dayOfWeek: index }))}
                  accessibilityRole="radio"
                  accessibilityLabel={day}
                  accessibilityState={{ checked: selected }}
                  style={{ paddingVertical: formAppearance ? 10 : 8, paddingHorizontal: 12, borderRadius: formAppearance ? 10 : 8, ...(formAppearance ? { borderWidth: 1, borderColor: selected ? palette.brand : palette.line } : {}), backgroundColor: selected ? palette.brand : formAppearance ? palette.white : palette.card }}
                >
                  <Text style={{ fontSize: 13, fontFamily: "Manrope", fontWeight: formAppearance ? "700" : "600", color: selected ? palette.white : formAppearance ? palette.ink : palette.ink2 }}>{day}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}

      {value.frequency === "quarterly" ? (
        <View>
          {renderLabel("DAY OF MONTH", formAppearance)}
          <TextInput
            accessibilityLabel="Day of month"
            value={value.dayOfMonth}
            onChangeText={(dayOfMonth) => onChange(updateValue(value, { dayOfMonth }))}
            placeholder="15"
            placeholderTextColor={palette.muted}
            keyboardType="number-pad"
            style={{ height: 46, borderRadius: 12, borderWidth: 1, borderColor: dayOfMonthError ? palette.error : palette.line, paddingHorizontal: 14, fontFamily: "Manrope", fontSize: 14, color: palette.ink, backgroundColor: palette.card, ...inputAppearance }}
          />
        </View>
      ) : null}

      {value.frequency === "yearly" && !hideYearlyDetails ? (
        <>
          <View>
            {renderLabel("MONTH", formAppearance)}
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {MONTHS.map((month, index) => {
                const monthValue = index + 1;
                const selected = value.monthOfYear === monthValue;
                return (
                  <Pressable
                    key={month}
                    onPress={() => onChange(updateValue(value, { monthOfYear: monthValue }))}
                    accessibilityRole="radio"
                    accessibilityLabel={month}
                    accessibilityState={{ checked: selected }}
                    style={{ paddingVertical: formAppearance ? 10 : 8, paddingHorizontal: 12, borderRadius: formAppearance ? 10 : 8, ...(formAppearance ? { borderWidth: 1, borderColor: selected ? palette.brand : palette.line } : {}), backgroundColor: selected ? palette.brand : formAppearance ? palette.white : palette.card }}
                  >
                    <Text style={{ fontSize: 13, fontFamily: "Manrope", fontWeight: formAppearance ? "700" : "600", color: selected ? palette.white : formAppearance ? palette.ink : palette.ink2 }}>{month}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
          <View>
            {renderLabel("DAY OF MONTH", formAppearance)}
            <TextInput
              accessibilityLabel="First day of month"
              value={value.dayOfMonth}
              onChangeText={(dayOfMonth) => onChange(updateValue(value, { dayOfMonth }))}
              placeholder="15"
              placeholderTextColor={palette.muted}
              keyboardType="number-pad"
              style={{ height: 46, borderRadius: 12, borderWidth: 1, borderColor: dayOfMonthError ? palette.error : palette.line, paddingHorizontal: 14, fontFamily: "Manrope", fontSize: 14, color: palette.ink, backgroundColor: palette.card, ...inputAppearance }}
            />
          </View>
        </>
      ) : null}

    </View>
  );
}
