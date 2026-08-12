import { Pressable, Text, TextInput, View } from "react-native";

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
  | "irregular"
  | "custom";

export type RecurringScheduleValue = {
  frequency: RecurringScheduleFrequency;
  intervalCount: string;
  dayOfMonth: string;
  secondDayOfMonth: string;
  dayOfWeek: number | null;
  secondDayOfWeek: number | null;
  monthOfYear: number | null;
  estimatedIntervalDays: string;
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
  estimatedIntervalError?: boolean;
};

function renderLabel(label: string) {
  return (
    <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 12, color: palette.ink2, marginBottom: 6 }}>
      {label}
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
  estimatedIntervalError = false,
}: Props) {
  const shouldShowInterval = showInterval || showIntervalCount;
  const showDayOfMonth = value.frequency === "monthly" || value.frequency === "semi_monthly" || value.frequency === "quarterly" || value.frequency === "yearly";
  const showDayOfWeek = value.frequency === "weekly" || value.frequency === "biweekly";
  const showEstimatedIntervalDays = value.frequency === "irregular";

  return (
    <View style={{ gap: 16 }}>
      <View>
        {renderLabel(frequencyLabel)}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {frequencies.map((frequency) => {
            const selected = value.frequency === frequency;
            const label = frequency === "semi_monthly" ? "semi monthly" : frequency;
            return (
              <Pressable
                key={frequency}
                onPress={() => onChange(updateValue(value, { frequency }))}
                accessibilityRole="radio"
                accessibilityLabel={label}
                accessibilityState={{ checked: selected }}
                style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, backgroundColor: selected ? palette.brand : palette.card }}
              >
                <Text style={{ fontSize: 13, fontFamily: "Manrope", fontWeight: "600", color: selected ? palette.white : palette.ink2 }}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {shouldShowInterval && value.frequency !== "semi_monthly" && value.frequency !== "biweekly" ? (
        <View>
          {renderLabel("REPEAT EVERY")}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <TextInput
              value={value.intervalCount}
              onChangeText={(intervalCount) => onChange(updateValue(value, { intervalCount }))}
              placeholder="1"
              placeholderTextColor={palette.muted}
              keyboardType="number-pad"
              accessibilityLabel="Repeat interval"
              style={{ width: 72, height: 46, borderRadius: 12, borderWidth: 1, borderColor: palette.line, paddingHorizontal: 14, fontFamily: "Manrope", fontSize: 14, color: palette.ink, backgroundColor: palette.card }}
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
          {renderLabel("DAY OF MONTH")}
          <TextInput
            value={value.dayOfMonth}
            onChangeText={(dayOfMonth) => onChange(updateValue(value, { dayOfMonth }))}
            placeholder="15"
            placeholderTextColor={palette.muted}
            keyboardType="number-pad"
            style={{ height: 46, borderRadius: 12, borderWidth: 1, borderColor: dayOfMonthError ? palette.error : palette.line, paddingHorizontal: 14, fontFamily: "Manrope", fontSize: 14, color: palette.ink, backgroundColor: palette.card }}
          />
        </View>
      ) : null}

      {value.frequency === "semi_monthly" ? (
        <>
          <View>
            {renderLabel("1ST DAY OF MONTH")}
            <TextInput
              value={value.dayOfMonth}
              onChangeText={(dayOfMonth) => onChange(updateValue(value, { dayOfMonth }))}
              placeholder="15"
              placeholderTextColor={palette.muted}
              keyboardType="number-pad"
              style={{ height: 46, borderRadius: 12, borderWidth: 1, borderColor: dayOfMonthError ? palette.error : palette.line, paddingHorizontal: 14, fontFamily: "Manrope", fontSize: 14, color: palette.ink, backgroundColor: palette.card }}
            />
          </View>
          <View>
            {renderLabel("2ND DAY OF MONTH")}
            <TextInput
              value={value.secondDayOfMonth}
              onChangeText={(secondDayOfMonth) => onChange(updateValue(value, { secondDayOfMonth }))}
              placeholder="30"
              placeholderTextColor={palette.muted}
              keyboardType="number-pad"
              style={{ height: 46, borderRadius: 12, borderWidth: 1, borderColor: secondDayOfMonthError ? palette.error : palette.line, paddingHorizontal: 14, fontFamily: "Manrope", fontSize: 14, color: palette.ink, backgroundColor: palette.card }}
            />
          </View>
        </>
      ) : null}

      {showDayOfWeek ? (
        <>
          <View>
            {renderLabel(value.frequency === "biweekly" ? "1ST DAY OF WEEK" : "DAY OF WEEK")}
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {WEEKDAYS.map((day, index) => {
                const selected = value.dayOfWeek === index;
                return (
                  <Pressable
                    key={day}
                    onPress={() => onChange(updateValue(value, { dayOfWeek: index }))}
                    accessibilityRole="radio"
                    accessibilityLabel={day}
                    accessibilityState={{ checked: selected }}
                    style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, backgroundColor: selected ? palette.brand : palette.card }}
                  >
                    <Text style={{ fontSize: 13, fontFamily: "Manrope", fontWeight: "600", color: selected ? palette.white : palette.ink2 }}>{day}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {value.frequency === "biweekly" ? (
            <View>
              {renderLabel("2ND DAY OF WEEK")}
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {WEEKDAYS.map((day, index) => {
                  const disabled = value.dayOfWeek === index;
                  const selected = value.secondDayOfWeek === index;
                  return (
                    <Pressable
                      key={day}
                      onPress={() => {
                        if (!disabled) onChange(updateValue(value, { secondDayOfWeek: index }));
                      }}
                      accessibilityRole="radio"
                      accessibilityLabel={day}
                      accessibilityState={{ checked: selected, disabled }}
                      style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, backgroundColor: selected ? palette.brand : palette.card, opacity: disabled ? 0.35 : 1 }}
                    >
                      <Text style={{ fontSize: 13, fontFamily: "Manrope", fontWeight: "600", color: selected ? palette.white : palette.ink2 }}>{day}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}
        </>
      ) : null}

      {value.frequency === "quarterly" ? (
        <View>
          {renderLabel("DAY OF MONTH")}
          <TextInput
            value={value.dayOfMonth}
            onChangeText={(dayOfMonth) => onChange(updateValue(value, { dayOfMonth }))}
            placeholder="15"
            placeholderTextColor={palette.muted}
            keyboardType="number-pad"
            style={{ height: 46, borderRadius: 12, borderWidth: 1, borderColor: dayOfMonthError ? palette.error : palette.line, paddingHorizontal: 14, fontFamily: "Manrope", fontSize: 14, color: palette.ink, backgroundColor: palette.card }}
          />
        </View>
      ) : null}

      {value.frequency === "yearly" ? (
        <>
          <View>
            {renderLabel("MONTH")}
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
                    style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, backgroundColor: selected ? palette.brand : palette.card }}
                  >
                    <Text style={{ fontSize: 13, fontFamily: "Manrope", fontWeight: "600", color: selected ? palette.white : palette.ink2 }}>{month}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
          <View>
            {renderLabel("DAY OF MONTH")}
            <TextInput
              value={value.dayOfMonth}
              onChangeText={(dayOfMonth) => onChange(updateValue(value, { dayOfMonth }))}
              placeholder="15"
              placeholderTextColor={palette.muted}
              keyboardType="number-pad"
              style={{ height: 46, borderRadius: 12, borderWidth: 1, borderColor: dayOfMonthError ? palette.error : palette.line, paddingHorizontal: 14, fontFamily: "Manrope", fontSize: 14, color: palette.ink, backgroundColor: palette.card }}
            />
          </View>
        </>
      ) : null}

      {showEstimatedIntervalDays ? (
        <View>
          {renderLabel("ESTIMATED EVERY (DAYS)")}
          <TextInput
            value={value.estimatedIntervalDays}
            onChangeText={(estimatedIntervalDays) => onChange(updateValue(value, { estimatedIntervalDays }))}
            placeholder="45"
            placeholderTextColor={palette.muted}
            keyboardType="number-pad"
            style={{ height: 46, borderRadius: 12, borderWidth: 1, borderColor: estimatedIntervalError ? palette.error : palette.line, paddingHorizontal: 14, fontFamily: "Manrope", fontSize: 14, color: palette.ink, backgroundColor: palette.card }}
          />
        </View>
      ) : null}
    </View>
  );
}
