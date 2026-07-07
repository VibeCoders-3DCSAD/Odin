import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Animated, Pressable, Text, TextStyle, View } from "react-native";
import {
  Bell,
  Brain,
  CaretRight,
  ClockAfternoon,
  DownloadSimple,
  Flask,
  LockKey,
  ShieldCheck,
  Trash,
  User,
} from "phosphor-react-native";
import { getConsents, getPrivacySettings, updatePrivacySettings } from "./api";
import type { AccountDeletionRequest, ConsentRecord, PrivacySettings } from "./types";
import { ERRORS } from "./constants";
import UserProfileScreen from "./UserProfileScreen";
import AccountOffboardingScreen from "./AccountOffboardingScreen";
import DeletionRequestedScreen from "./DeletionRequestedScreen";

type PrivacySettingsScreenProps = {
  accessToken: string;
};

const MUTED = "#6B7A6F";
const LINE = "#EAEAE6";
const INK = "#1B1C1A";
const AQUA700 = "#0B8A55";
const AQUA600 = "#08B16A";
const CARD = "#FCF8F0";
const MONZA50 = "#FFF0F2";
const MONZA200 = "#FFCDD2";
const MONZA600 = "#D9001F";
const MONZA700 = "#B71C1C";
const MONZA500 = "#E53935";

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.name === "AbortError") {
    return "The request timed out. Check the API and try again.";
  }
  return error instanceof Error ? error.message : "Something went wrong.";
}

function SettingsToggle({
  value,
  onToggle,
  accessibilityLabel,
}: {
  value: boolean;
  onToggle: () => void;
  accessibilityLabel: string;
}) {
  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={accessibilityLabel}
    >
      <View
        style={{
          width: 44,
          height: 26,
          borderRadius: 100,
          backgroundColor: value ? AQUA600 : LINE,
          justifyContent: "center",
          paddingHorizontal: 3,
        }}
      >
        <View
          style={{
            width: 20,
            height: 20,
            borderRadius: 10,
            backgroundColor: CARD,
            alignSelf: value ? "flex-end" : "flex-start",
          }}
        />
      </View>
    </Pressable>
  );
}

function BorderedGroup({ children }: { children: React.ReactNode }) {
  return (
    <View
      style={{
        borderRadius: 16,
        borderWidth: 1,
        borderColor: LINE,
        overflow: "hidden",
      }}
    >
      {children}
    </View>
  );
}

function SectionHeader({ label }: { label: string }) {
  return (
    <Text
      style={{
        fontSize: 11,
        fontWeight: "700",
        color: MUTED,
        textTransform: "uppercase",
        letterSpacing: 0.55,
        marginBottom: 9,
      }}
    >
      {label}
    </Text>
  );
}

function Divider() {
  return <View style={{ borderTopWidth: 1, borderTopColor: LINE }} />;
}

function NavRow({
  icon,
  label,
  subtitle,
  onPress,
  trailing,
  iconColor = MUTED,
  labelColor = INK,
  labelWeight = "600",
}: {
  icon: React.ReactNode;
  label: string;
  subtitle?: string;
  onPress?: () => void;
  trailing?: React.ReactNode;
  iconColor?: string;
  labelColor?: string;
  labelWeight?: TextStyle["fontWeight"];
}) {
  const Wrapper = onPress ? Pressable : View;
  return (
    <Wrapper
      onPress={onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingHorizontal: 15,
        paddingVertical: 14,
      }}
    >
      {icon}
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 13.5, fontWeight: labelWeight, color: labelColor }}>
          {label}
        </Text>
        {subtitle ? (
          <Text style={{ fontSize: 10.5, color: AQUA700, marginTop: 1 }}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing ?? (onPress ? <CaretRight size={15} color={MUTED} weight="bold" /> : null)}
    </Wrapper>
  );
}

function SkeletonBar({ width, height = 12, style }: { width: number | string; height?: number; style?: object }) {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[{ width: width as any, height, borderRadius: 6, backgroundColor: LINE, opacity }, style]}
    />
  );
}

function SkeletonRow() {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 15, paddingVertical: 14 }}>
      <View style={{ width: 18, height: 18, borderRadius: 4, backgroundColor: LINE }} />
      <View style={{ flex: 1, gap: 4 }}>
        <SkeletonBar width="40%" height={11} />
        <SkeletonBar width="25%" height={9} />
      </View>
      <View style={{ width: 44, height: 26, borderRadius: 100, backgroundColor: LINE }} />
    </View>
  );
}

function SkeletonSimpleRow() {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 15, paddingVertical: 14 }}>
      <View style={{ width: 18, height: 18, borderRadius: 4, backgroundColor: LINE }} />
      <SkeletonBar width="35%" height={11} />
      <View style={{ flex: 1 }} />
      <View style={{ width: 15, height: 15, borderRadius: 4, backgroundColor: LINE }} />
    </View>
  );
}

function SettingsSkeleton() {
  return (
    <View>
      <SkeletonBar width="28%" height={11} style={{ marginBottom: 9 }} />
      <BorderedGroup>
        <SkeletonSimpleRow />
        <Divider />
        <SkeletonSimpleRow />
      </BorderedGroup>

      <View style={{ height: 20 }} />
      <SkeletonBar width="28%" height={11} style={{ marginBottom: 9 }} />
      <BorderedGroup>
        <SkeletonRow />
        <Divider />
        <SkeletonRow />
        <Divider />
        <SkeletonRow />
        <Divider />
        <SkeletonSimpleRow />
        <Divider />
        <SkeletonSimpleRow />
      </BorderedGroup>

      <View style={{ height: 20 }} />
      <SkeletonBar width="28%" height={11} style={{ marginBottom: 9 }} />
      <BorderedGroup>
        <SkeletonRow />
        <Divider />
        <SkeletonSimpleRow />
      </BorderedGroup>

      <View style={{ height: 20 }} />
      <View style={{ height: 54, borderRadius: 14, borderWidth: 1.5, borderColor: LINE, backgroundColor: MONZA50 }} />
    </View>
  );
}

export default function PrivacySettingsScreen({ accessToken }: PrivacySettingsScreenProps) {
  const [settings, setSettings] = useState<PrivacySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [subPage, setSubPage] = useState<string | null>(null);
  const [exported, setExported] = useState(false);
  const [consents, setConsents] = useState<ConsentRecord[]>([]);
  const [deletionRequest, setDeletionRequest] = useState<AccountDeletionRequest | null>(null);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fetched = useRef(false);

  useEffect(() => {
    if (fetched.current) return;
    fetched.current = true;

    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      getPrivacySettings(accessToken),
      getConsents(accessToken).catch(() => ({ body: {} })),
    ])
      .then(([settingsRes, consentsRes]) => {
        if (cancelled) return;
        if (settingsRes.body.payload) {
          setSettings(settingsRes.body.payload);
        } else {
          setError(settingsRes.body.message ?? ERRORS.FAILED_LOAD_PRIVACY);
        }
        const mePayload = consentsRes.body as { payload?: { consents?: ConsentRecord[] } };
        if (mePayload.payload?.consents) {
          setConsents(mePayload.payload.consents);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(getErrorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [accessToken]);

  const save = useCallback(
    async (payload: Partial<PrivacySettings>, previous?: PrivacySettings) => {
      setSaving(true);
      setError(null);
      try {
        const { response, body } = await updatePrivacySettings(accessToken, payload);
        if (!response.ok) {
          if (previous) setSettings(previous);
          setError(body.message ?? ERRORS.FAILED_SAVE);
          return;
        }
        setSaved(true);
        if (savedTimer.current) clearTimeout(savedTimer.current);
        savedTimer.current = setTimeout(() => setSaved(false), 2000);
      } catch (err) {
        if (previous) setSettings(previous);
        setError(getErrorMessage(err));
      } finally {
        setSaving(false);
      }
    },
    [accessToken],
  );

  function toggle(key: keyof PrivacySettings) {
    if (!settings) return;
    const current = settings[key];
    if (typeof current !== "boolean") return;
    const previous = settings;
    setSettings({ ...settings, [key]: !current });
    save({ [key]: !current }, previous);
  }

  if (loading) {
    return <SettingsSkeleton />;
  }

  if (error && !settings) {
    return (
      <View style={{ alignItems: "center", gap: 16, paddingVertical: 80 }}>
        <Text style={{ color: MUTED, fontSize: 14, textAlign: "center", paddingHorizontal: 16 }}>
          {error}
        </Text>
        <Pressable
          onPress={() => {
            setLoading(true);
            setError(null);
            getPrivacySettings(accessToken)
              .then(({ body }) => {
                if (body.payload) setSettings(body.payload);
                else setError(body.message ?? ERRORS.FAILED_LOAD);
              })
              .catch((err) => setError(getErrorMessage(err)))
              .finally(() => setLoading(false));
          }}
          style={{
            minHeight: 44,
            borderRadius: 14,
            backgroundColor: "#013220",
            paddingHorizontal: 24,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ color: "#FFFFFF", fontSize: 14, fontWeight: "700" }}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  if (subPage === "export") {
    return (
      <View>
        <Pressable
          onPress={() => setSubPage(null)}
          accessibilityRole="button"
          accessibilityLabel="Back to settings"
          style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 }}
        >
          <CaretRight size={18} color={MUTED} weight="bold" style={{ transform: [{ rotate: "180deg" }] }} />
          <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 13, color: MUTED }}>
            Settings
          </Text>
        </Pressable>
        <Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 20, color: INK, marginBottom: 16 }}>
          Export data
        </Text>
        <UserProfileScreen accessToken={accessToken} alreadyExported={exported} onExported={() => setExported(true)} onDone={() => setSubPage(null)} />
      </View>
    );
  }

  if (subPage === "delete-account") {
    return (
      <AccountOffboardingScreen
        accessToken={accessToken}
        onDeletionRequested={(req) => { setDeletionRequest(req); setSubPage("deletion-requested"); }}
        onBack={() => setSubPage(null)}
      />
    );
  }

  if (subPage === "deletion-requested" && deletionRequest) {
    return (
      <DeletionRequestedScreen
        accessToken={accessToken}
        deletionRequest={deletionRequest}
        onCancelled={() => setDeletionRequest(null)}
        onBack={() => { setDeletionRequest(null); setSubPage(null); }}
      />
    );
  }

  return (
    <View>
      <SectionHeader label="Account" />
      <BorderedGroup>
        <NavRow icon={<User size={18} color={MUTED} />} label="Personal information" />
        <Divider />
        <NavRow icon={<LockKey size={18} color={MUTED} />} label="Change password" />
      </BorderedGroup>

      <View style={{ height: 20 }} />

      <SectionHeader label="Privacy & data" />
      <BorderedGroup>
        <NavRow
          icon={<Brain size={18} color={MUTED} />}
          label="Personalization"
          subtitle={settings?.personalization_enabled ? "Enabled" : "Disabled"}
          trailing={
            <SettingsToggle
              value={settings?.personalization_enabled ?? false}
              onToggle={() => toggle("personalization_enabled")}
              accessibilityLabel="Personalization"
            />
          }
        />
        <Divider />
        <NavRow
          icon={<Flask size={18} color={MUTED} />}
          label="Model Training"
          subtitle={settings?.model_training_opt_in ? "Enabled" : "Disabled"}
          trailing={
            <SettingsToggle
              value={settings?.model_training_opt_in ?? false}
              onToggle={() => toggle("model_training_opt_in")}
              accessibilityLabel="Model Training"
            />
          }
        />
        <Divider />
        <NavRow
          icon={<ShieldCheck size={18} color={AQUA700} />}
          label="Research Evaluation"
          subtitle={settings?.research_evaluation_opt_in ? "Enabled" : "Disabled"}
          trailing={
            <SettingsToggle
              value={settings?.research_evaluation_opt_in ?? false}
              onToggle={() => toggle("research_evaluation_opt_in")}
              accessibilityLabel="Research Evaluation"
            />
          }
        />
        <Divider />
        <NavRow
          icon={<ShieldCheck size={18} color={AQUA700} />}
          label="Consent status"
          subtitle={consents.some((c) => c.status === "granted") ? `Active · v${consents.find((c) => c.status === "granted")!.version}` : "No consent recorded"}
          iconColor={AQUA700}
          labelColor={INK}
        />
        <Divider />
        <NavRow
          icon={<DownloadSimple size={18} color={MUTED} />}
          label="Export data"
          onPress={() => setSubPage("export")}
        />
      </BorderedGroup>

      <View style={{ height: 20 }} />

      <SectionHeader label="Notifications" />
      <BorderedGroup>
        <NavRow
          icon={<Bell size={18} color={MUTED} />}
          label="Budget & anomaly alerts"
          trailing={
          <SettingsToggle
            value={settings?.notifications_opt_in ?? false}
            onToggle={() => toggle("notifications_opt_in")}
            accessibilityLabel="Budget and anomaly alerts"
          />
          }
        />
        <Divider />
        <NavRow
          icon={<ClockAfternoon size={18} color={MUTED} />}
          label="Alert frequency"
          trailing={
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Text style={{ fontSize: 12.5, fontWeight: "600", color: MUTED }}>Daily</Text>
              <CaretRight size={15} color={MUTED} weight="bold" />
            </View>
          }
        />
      </BorderedGroup>

      <View style={{ height: 20 }} />

      <Pressable
        onPress={() => setSubPage("delete-account")}
        accessibilityRole="button"
        accessibilityLabel="Delete account"
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          padding: 15,
          borderRadius: 14,
          borderWidth: 1.5,
          borderColor: MONZA200,
          backgroundColor: MONZA50,
        }}
      >
        <Trash size={18} color={MONZA600} />
        <Text style={{ flex: 1, fontSize: 13.5, fontWeight: "700", color: MONZA700 }}>
          Delete account
        </Text>
        <CaretRight size={15} color={MONZA500} weight="bold" />
      </Pressable>

      <View style={{ alignItems: "center", justifyContent: "center", marginTop: 14 }}>
        {saving ? (
          <ActivityIndicator color={MUTED} size="small" />
        ) : saved ? (
          <Text style={{ fontSize: 10.5, color: AQUA600, fontWeight: "600" }}>
            Settings saved
          </Text>
        ) : null}
        {error ? (
          <Text style={{ fontSize: 10.5, color: MONZA600, textAlign: "center" }}>
            {error}
          </Text>
        ) : null}
      </View>

      <Text
        style={{
          fontSize: 10.5,
          lineHeight: 15.75,
          color: MUTED,
          textAlign: "center",
          marginTop: 14,
          marginBottom: 8,
        }}
      >
        Odin provides budgeting tools, not professional financial advice. Decisions are your own.
      </Text>
    </View>
  );
}
