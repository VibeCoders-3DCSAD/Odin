import React, { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Pressable, Text, TextStyle, View } from "react-native";
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
import { useConnectivityStore } from "../../services/connectivity";
import { getConsents, getPrivacySettings, updatePrivacySettings } from "./api";
import type { ConsentRecord, PrivacySettings } from "./types";
import { ERRORS } from "./constants";
import { getErrorMessage } from "./helpers";
import { useToast } from "../../components/Toast";
import UserProfileScreen from "./UserProfileScreen";
import AccountOffboardingScreen from "./AccountOffboardingScreen";
import { getLocalPrivacySettings, cachePrivacySettings } from "../../local-db/repositories/privacySettings";

type PrivacySettingsScreenProps = {
  accessToken: string;
  userId: string;
  onBackToLogin?: () => void;
  onDeleted?: (scheduledDate: string) => void;
  onSubPageChange?: (showingSubPage: boolean) => void;
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

function SettingsToggle({
  value,
  onToggle,
  accessibilityLabel,
  disabled,
}: {
  value: boolean;
  onToggle: () => void;
  accessibilityLabel: string;
  disabled?: boolean;
}) {
  return (
      <Pressable
        onPress={onToggle}
        accessibilityRole="switch"
        accessibilityState={{ checked: value, disabled }}
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
          opacity: disabled ? 0.45 : 1,
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
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  subtitle?: string;
  onPress?: () => void;
  trailing?: React.ReactNode;
  iconColor?: string;
  labelColor?: string;
  labelWeight?: TextStyle["fontWeight"];
  disabled?: boolean;
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
        opacity: disabled ? 0.45 : 1,
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

export default function PrivacySettingsScreen({ accessToken, userId, onBackToLogin, onDeleted, onSubPageChange }: PrivacySettingsScreenProps) {
  const [settings, setSettings] = useState<PrivacySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [subPage, setSubPage] = useState<string | null>(null);
  const [exported, setExported] = useState(false);
  const [consents, setConsents] = useState<ConsentRecord[]>([]);
  const fetched = useRef(false);
  const online = useConnectivityStore(state => state.online);
  const { showToast } = useToast();

  useEffect(() => {
    onSubPageChange?.(subPage !== null);
  }, [subPage, onSubPageChange]);

  useEffect(() => {
    if (fetched.current) return;
    fetched.current = true;

    let cancelled = false;
    setLoading(true);
    setError(null);

    async function load() {
      if (userId) {
        const local = await getLocalPrivacySettings(userId);
        if (local) {
          if (cancelled) return;
          setSettings(local);
          setLoading(false);
        }
      }

      Promise.all([
        getPrivacySettings(accessToken),
        getConsents(accessToken).catch(() => ({ body: {} })),
      ])
        .then(async ([settingsRes, consentsRes]) => {
          if (cancelled) return;
          if (settingsRes.body.payload) {
            const s = settingsRes.body.payload;
            setSettings(s);
            if (userId) {
              cachePrivacySettings(userId, s).catch(() => {});
            }
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
    }

    load();
    return () => { cancelled = true; };
  }, [accessToken, userId]);

  function revertFields(payload: Partial<PrivacySettings>, previous: PrivacySettings) {
    setSettings(current => {
      if (!current) return current;
      const next = { ...current };
      for (const k of Object.keys(payload))
        (next as Record<string, unknown>)[k] = previous[k as keyof PrivacySettings];
      return next;
    });
  }

  const save = useCallback(
    async (payload: Partial<PrivacySettings>, previous?: PrivacySettings) => {
      try {
        const { response, body } = await updatePrivacySettings(accessToken, payload);
        if (!response.ok) {
          if (previous) revertFields(payload, previous);
          showToast(body.message ?? ERRORS.FAILED_SAVE);
          return;
        }
        showToast("Settings saved", "success");
        if (userId && settings) {
          const updated = { ...settings, ...payload };
          cachePrivacySettings(userId, updated).catch(() => {});
        }
      } catch {
        if (previous) revertFields(payload, previous);
        showToast("Can't save while offline");
      }
    },
    [accessToken, userId, settings, showToast],
  );

  function toggle(key: keyof PrivacySettings) {
    if (!settings) return;
    if (!online) {
      showToast("Can't save while offline");
      return;
    }
    const current = settings[key];
    if (typeof current !== "boolean") return;
    const previous = { ...settings };
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
                if (body.payload) {
                  setSettings(body.payload);
                  if (userId) cachePrivacySettings(userId, body.payload).catch(() => {});
                }
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
        onBack={() => setSubPage(null)}
        onGoToExport={() => setSubPage("export")}
        onDeleted={onDeleted}
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
          disabled={!online}
          trailing={
            <SettingsToggle
              value={settings?.personalization_enabled ?? false}
              onToggle={() => toggle("personalization_enabled")}
              accessibilityLabel="Personalization"
              disabled={!online}
            />
          }
        />
        <Divider />
        <NavRow
          icon={<Flask size={18} color={MUTED} />}
          label="Model Training"
          subtitle={settings?.model_training_opt_in ? "Enabled" : "Disabled"}
          disabled={!online}
          trailing={
            <SettingsToggle
              value={settings?.model_training_opt_in ?? false}
              onToggle={() => toggle("model_training_opt_in")}
              accessibilityLabel="Model Training"
              disabled={!online}
            />
          }
        />
        <Divider />
        <NavRow
          icon={<ShieldCheck size={18} color={AQUA700} />}
          label="Research Evaluation"
          subtitle={settings?.research_evaluation_opt_in ? "Enabled" : "Disabled"}
          disabled={!online}
          trailing={
            <SettingsToggle
              value={settings?.research_evaluation_opt_in ?? false}
              onToggle={() => toggle("research_evaluation_opt_in")}
              accessibilityLabel="Research Evaluation"
              disabled={!online}
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
          disabled={!online}
          onPress={() => {
            if (!online) { showToast("This action can only be done while online"); return; }
            setSubPage("export");
          }}
        />
      </BorderedGroup>

      <View style={{ height: 20 }} />

      <SectionHeader label="Notifications" />
      <BorderedGroup>
        <NavRow
          icon={<Bell size={18} color={MUTED} />}
          label="Budget & anomaly alerts"
          disabled={!online}
          trailing={
          <SettingsToggle
            value={settings?.notifications_opt_in ?? false}
            onToggle={() => toggle("notifications_opt_in")}
            accessibilityLabel="Budget and anomaly alerts"
            disabled={!online}
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
        onPress={() => {
          if (!online) { showToast("This action can only be done while online"); return; }
          setSubPage("delete-account");
        }}
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
          opacity: online ? 1 : 0.45,
        }}
      >
        <Trash size={18} color={MONZA600} />
        <Text style={{ flex: 1, fontSize: 13.5, fontWeight: "700", color: MONZA700 }}>
          Delete account
        </Text>
        <CaretRight size={15} color={MONZA500} weight="bold" />
      </Pressable>

    </View>
  );
}
