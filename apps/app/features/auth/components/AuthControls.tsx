import { MaterialCommunityIcons } from "@expo/vector-icons";
import { type ReactNode, useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import { isValidEmail, type PasswordChecks } from "../helpers/credentialRules";

export const authPalette = {
  brand: "#12D583",
  heading: "#1B1C1A",
  subtle: "#6B7A6F",
  white: "#FFFFFF",
  error: "#D9001F",
};

const monza100 = "#FFDEE2";
const monza700 = "#B71C1C";

type FieldTone = "default" | "error" | "success";
type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

type AuthFieldProps = {
  label: string;
  value: string;
  placeholder: string;
  icon: IconName;
  secureTextEntry?: boolean;
  keyboardType?: "default" | "email-address";
  autoCapitalize?: "none" | "words";
  onChangeText: (value: string) => void;
  onFocus: () => void;
  onBlur: () => void;
  focused: boolean;
  tone?: FieldTone;
  trailing?: ReactNode;
};

function AuthField({
  label, value, placeholder, icon, secureTextEntry, keyboardType = "default", autoCapitalize = "none",
  onChangeText, onFocus, onBlur, focused, tone = "default", trailing,
}: AuthFieldProps) {
  let borderBg = "border-line bg-surface";
  if (tone === "error") borderBg = "border-[#E53935] bg-errorSoft";
  else if (focused) borderBg = "border-aqua500 bg-card";

  return (
    <View className="gap-2">
      <Text className="text-ink2 text-[12.5px] font-semibold">{label}</Text>
      <View className={`min-h-[52px] rounded-[14px] border px-4 flex-row items-center gap-3 ${borderBg}`}>
        <MaterialCommunityIcons color={authPalette.brand} name={icon} size={18} />
        <TextInput
          autoCapitalize={autoCapitalize}
          autoCorrect={false}
          keyboardType={keyboardType}
          onBlur={onBlur}
          onChangeText={onChangeText}
          onFocus={onFocus}
          placeholder={placeholder}
          placeholderTextColor={authPalette.subtle}
          secureTextEntry={secureTextEntry}
          className="flex-1 text-heading text-base leading-[20px] font-medium py-4"
          value={value}
        />
        {trailing}
      </View>
    </View>
  );
}

// Shared shape of the email, password and name fields: `error` is a server- or submit-time
// error for this field, and `onEdit` fires on focus or change so the screen can clear it.
type InputProps = { value: string; onChangeText: (value: string) => void; error?: boolean; onEdit?: () => void };

export function TextField({ label, placeholder, icon, value, onChangeText }: InputProps & { label: string; placeholder: string; icon: IconName }) {
  const [focused, setFocused] = useState(false);
  return <AuthField autoCapitalize="words" focused={focused} icon={icon} label={label} onBlur={() => setFocused(false)}
    onChangeText={onChangeText} onFocus={() => setFocused(true)} placeholder={placeholder} value={value} />;
}

export function EmailField({ value, onChangeText, error, onEdit, placeholder = "you@example.com" }: InputProps & { placeholder?: string }) {
  const [focused, setFocused] = useState(false);
  const [touched, setTouched] = useState(false);
  let tone: FieldTone = "default";
  if (error || (touched && value.length > 0 && !isValidEmail(value))) tone = "error";
  else if (touched && value.length > 0 && focused) tone = "success";

  return <AuthField focused={focused} icon="email-outline" keyboardType="email-address" label="Email"
    onBlur={() => setFocused(false)}
    onChangeText={(next) => { onChangeText(next); onEdit?.(); setTouched(true); }}
    onFocus={() => { setFocused(true); onEdit?.(); }}
    placeholder={placeholder} tone={tone} value={value} />;
}

type PasswordFieldProps = InputProps & {
  label: string;
  placeholder: string;
  icon?: IconName;
  // Omit to skip live validation (sign-in only checks the password on submit).
  valid?: boolean;
};

export function PasswordField({ label, placeholder, icon = "lock-outline", value, onChangeText, error, onEdit, valid }: PasswordFieldProps) {
  const [focused, setFocused] = useState(false);
  const [touched, setTouched] = useState(false);
  const [visible, setVisible] = useState(false);
  let tone: FieldTone = "default";
  if (error) tone = "error";
  else if (valid !== undefined && touched) tone = valid ? "success" : "error";

  return <AuthField focused={focused} icon={icon} label={label} onBlur={() => setFocused(false)}
    onChangeText={(next) => { onChangeText(next); onEdit?.(); setTouched(true); }}
    onFocus={() => { setFocused(true); onEdit?.(); }}
    placeholder={placeholder} secureTextEntry={!visible} tone={tone} value={value}
    trailing={
      <Pressable accessibilityLabel={visible ? "Hide password" : "Show password"} accessibilityState={{ selected: visible }}
        onPress={() => setVisible((current) => !current)}>
        <MaterialCommunityIcons color={authPalette.subtle} name={visible ? "eye-off-outline" : "eye-outline"} size={18} />
      </Pressable>
    } />;
}

type AuthButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  tone?: "primary" | "secondary";
  icon?: IconName;
};

export function AuthButton({ label, onPress, disabled, loading, tone = "primary", icon }: AuthButtonProps) {
  const primary = tone === "primary";

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      onPress={onPress}
      className={`min-h-[54px] rounded-[14px] border items-center justify-center px-4 ${
        primary ? "bg-aqua950 border-aqua950" : "bg-card border-line"
      } ${disabled || loading ? "opacity-50" : "active:opacity-90"}`}
      style={primary && !disabled && !loading ? { shadowColor: "rgba(1,50,32,0.28)", shadowOffset: { width: 0, height: 4 }, shadowRadius: 8, elevation: 4 } : undefined}
    >
      {loading ? (
        <ActivityIndicator color={primary ? authPalette.white : authPalette.brand} />
      ) : (
        <View className="flex-row items-center justify-center gap-2">
          {icon ? <MaterialCommunityIcons color={primary ? authPalette.white : authPalette.heading} name={icon} size={18} /> : null}
          <Text className={`${primary ? "text-white" : "text-heading"} text-base leading-[20px] font-bold`}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

export function TextLink({ label, onPress, align = "center" }: { label: string; onPress: () => void; align?: "center" | "right" }) {
  return <Pressable onPress={onPress}>
    <Text className={`text-brand text-xs font-bold ${align === "right" ? "text-right" : "text-center"}`}>{label}</Text>
  </Pressable>;
}

// "Remember your password? Sign in" style footer.
export function SwitchPrompt({ prompt, label, onPress }: { prompt: string; label: string; onPress: () => void }) {
  return <View className="flex-row flex-wrap items-center justify-center gap-2">
    <Text className="text-subtle text-xs">{prompt}</Text>
    <TextLink label={label} onPress={onPress} />
  </View>;
}

export function InfoCard({ icon, children, compact }: { icon: IconName; children: ReactNode; compact?: boolean }) {
  return <View className={`flex-row items-start gap-3 bg-accent ${compact ? "p-4 rounded-[16px]" : "p-5 rounded-[16px]"}`}>
    <MaterialCommunityIcons color={authPalette.brand} name={icon} size={compact ? 20 : 24} />
    <Text className={`flex-1 text-text font-medium ${compact ? "text-xs leading-[18px]" : "text-sm leading-[20px]"}`}>{children}</Text>
  </View>;
}

const passwordRules: { key: keyof PasswordChecks; label: string }[] = [
  { key: "length", label: "8+ characters" },
  { key: "upper", label: "Uppercase letter" },
  { key: "lower", label: "Lowercase letter" },
  { key: "number", label: "Number" },
  { key: "symbol", label: "Symbol" },
];

export function PasswordRules({ checks }: { checks: PasswordChecks }) {
  return (
    <View className="gap-1.5">
      {passwordRules.map((rule) => {
        const passed = checks[rule.key];
        return (
          <View key={rule.key} className="flex-row items-center gap-2">
            <MaterialCommunityIcons color={passed ? "#12D583" : monza700} name={passed ? "check-circle" : "close-circle"} size={14} />
            <Text style={{ color: passed ? "#12D583" : monza700, fontSize: 12, fontWeight: "500" }}>{rule.label}</Text>
          </View>
        );
      })}
    </View>
  );
}

export type NoticeTone = "default" | "success" | "error";
export type NoticeProps = { tone: NoticeTone; message: string };

export function Notice({ tone, message }: NoticeProps) {
  const isError = tone === "error";
  let iconName: IconName = "information-outline";
  if (isError) iconName = "alert-circle";
  else if (tone === "success") iconName = "check-circle-outline";

  return (
    <View
      className={`rounded-[13px] px-[15px] py-[13px] flex-row items-center gap-[10px] ${isError ? "bg-errorSoft border" : "bg-aqua50 border-0"}`}
      style={isError ? { borderColor: monza100 } : undefined}
    >
      <MaterialCommunityIcons color={isError ? authPalette.error : authPalette.brand} name={iconName} size={20} />
      <Text className={`flex-1 text-xs leading-[18px] ${isError ? "font-semibold" : "font-medium"}`}
        style={{ color: isError ? monza700 : authPalette.heading }}>{message}</Text>
    </View>
  );
}
