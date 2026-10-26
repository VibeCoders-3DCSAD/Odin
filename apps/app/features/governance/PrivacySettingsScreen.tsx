import React, { useEffect, useState } from "react";
import { Alert, Pressable, Text, TextInput, TextStyle, View } from "react-native";
import {
  Brain,
  CaretRight,
  ClockAfternoon,
  LockKey,
  Trash,
  User,
} from "phosphor-react-native";
import { useConnectivityStore } from "../../services/connectivity";
import { useToast } from "../../components/Toast";
import UserProfileScreen from "./UserProfileScreen";
import PreferencesScreen from "./PreferencesScreen";
import AccountOffboardingScreen from "./AccountOffboardingScreen";
import { cacheProfileAssignment } from "../../local-db/repositories/privacySettings";
import { confirmProfileAssignment, getProfileAssignment, requestProfileReassessment, selectProfileAssignment } from "../onboarding/api";
import type { ProfileAssignment } from "../onboarding/types";

type PrivacySettingsScreenProps = {
  accessToken: string;
  userId: string;
  deviceId: string;
  onBackToLogin?: () => void;
  onRequestReassessment?: () => void;
  onDeleted?: (scheduledDate: string) => void;
  onSubPageChange?: (showingSubPage: boolean) => void;
  beforeDangerZone?: React.ReactNode;
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
        disabled={disabled}
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
  const Wrapper = onPress && !disabled ? Pressable : View;
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

export default function PrivacySettingsScreen({ accessToken, userId, deviceId, onBackToLogin, onDeleted, onRequestReassessment, onSubPageChange, beforeDangerZone }: PrivacySettingsScreenProps) {
  const [subPage, setSubPage] = useState<string | null>(null);
  const [exported, setExported] = useState(false);
  const [profile, setProfile] = useState<ProfileAssignment | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [manualProfileSelection, setManualProfileSelection] = useState(false);
  const [reassessmentReason, setReassessmentReason] = useState("");
  const [useRecentTransactions, setUseRecentTransactions] = useState(true);
  const [requestingReassessment, setRequestingReassessment] = useState(false);
  const [reassessmentMessage, setReassessmentMessage] = useState<string | null>(null);
  const online = useConnectivityStore(state => state.online);
  const { showToast } = useToast();

  useEffect(() => {
    onSubPageChange?.(subPage !== null);
  }, [subPage, onSubPageChange]);

  if (subPage === "preferences") {
    return <PreferencesScreen accessToken={accessToken} userId={userId} deviceId={deviceId} onBack={() => setSubPage(null)} />;
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

  if (subPage === "legacy-financial-profile") {
    const profileOptions = [
      "STABLE_FLEXIBLE_TOLERANT", "STABLE_FLEXIBLE_AT_RISK",
      "STABLE_OBLIGATED_TOLERANT", "STABLE_OBLIGATED_AT_RISK",
      "VARIABLE_FLEXIBLE_TOLERANT", "VARIABLE_FLEXIBLE_AT_RISK",
      "VARIABLE_OBLIGATED_TOLERANT", "VARIABLE_OBLIGATED_AT_RISK",
    ];
    const refreshProfile = async () => {
      const current = await getProfileAssignment(accessToken);
      const assignment = current.body.payload?.assignment ?? null;
      setProfile(assignment);
      if (userId) cacheProfileAssignment(userId, assignment).catch(() => {});
    };
    return (
      <View>
        <Pressable onPress={() => setSubPage(null)} accessibilityRole="button" accessibilityLabel="Back to settings" style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 }}>
          <CaretRight size={18} color={MUTED} weight="bold" style={{ transform: [{ rotate: "180deg" }] }} />
          <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 13, color: MUTED }}>Settings</Text>
        </Pressable>
        <Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 20, color: INK, marginBottom: 8 }}>Financial profile</Text>
        <Text style={{ fontSize: 13, color: MUTED, lineHeight: 19, marginBottom: 16 }}>
          {profile?.explanation ?? "Choose the profile that best reflects your current financial situation."}
        </Text>
        {profile?.confirmation_required && !manualProfileSelection ? (
          <View style={{ gap: 10, marginBottom: 20 }}>
            <Pressable
              disabled={savingProfile}
              onPress={async () => {
                setSavingProfile(true);
                try {
                  const { response, body } = await confirmProfileAssignment(accessToken, profile.id);
                  if (!response.ok) showToast(body.message ?? "Couldn't accept your financial profile.");
                  else { await refreshProfile(); showToast("Financial profile accepted", "success"); }
                } catch { showToast("Can't save while offline"); }
                finally { setSavingProfile(false); }
              }}
              style={{ minHeight: 48, borderRadius: 14, backgroundColor: AQUA700, alignItems: "center", justifyContent: "center", opacity: savingProfile ? 0.45 : 1 }}
            >
              <Text style={{ color: "#FFFFFF", fontSize: 14, fontWeight: "700" }}>Accept suggested profile</Text>
            </Pressable>
            <Pressable
              disabled={savingProfile}
              onPress={() => {
                if (!savingProfile) setManualProfileSelection(true);
              }}
              style={{ minHeight: 48, borderRadius: 14, borderWidth: 1, borderColor: LINE, alignItems: "center", justifyContent: "center", opacity: savingProfile ? 0.45 : 1 }}
            >
              <Text style={{ color: INK, fontSize: 14, fontWeight: "700" }}>Reject and choose another profile</Text>
            </Pressable>
          </View>
        ) : null}
        <BorderedGroup>
          {profileOptions.map((option, index) => (
            <React.Fragment key={option}>
              {index > 0 ? <Divider /> : null}
              <NavRow
                icon={<Brain size={18} color={option === profile?.profile_label ? AQUA700 : MUTED} />}
                label={option.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase())}
                onPress={() => {
                  if (!online || savingProfile || (!manualProfileSelection && option === profile?.profile_label)) return;
                  Alert.alert(
                    "Change financial profile?",
                    "This replaces your current financial profile.",
                    [
                      { text: "Cancel", style: "cancel" },
                      {
                        text: "Change profile",
                        style: "destructive",
                        onPress: async () => {
                          setSavingProfile(true);
                          try {
                            const { response, body } = await selectProfileAssignment(accessToken, option, profile?.confirmation_required ?? false);
                            if (!response.ok) showToast(body.message ?? "Couldn't update your financial profile.");
                            else {
                              await refreshProfile();
                              setManualProfileSelection(false);
                              showToast("Financial profile updated", "success");
                            }
                          } catch {
                            showToast("Can't save while offline");
                          } finally {
                            setSavingProfile(false);
                          }
                        },
                      },
                    ],
                  );
                }}
                trailing={option === profile?.profile_label ? <Text style={{ fontSize: 12, fontWeight: "700", color: AQUA700 }}>Current</Text> : undefined}
                disabled={!online || savingProfile}
              />
            </React.Fragment>
          ))}
        </BorderedGroup>
        <TextInput value={reassessmentReason} onChangeText={setReassessmentReason} placeholder="Why do you want a reassessment?" placeholderTextColor={MUTED} style={{ marginTop: 20, borderWidth: 1, borderColor: LINE, borderRadius: 14, padding: 14, color: INK }} />
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12 }}>
          <SettingsToggle value={useRecentTransactions} onToggle={() => setUseRecentTransactions((value) => !value)} accessibilityLabel="Use recent transactions" />
          <Text style={{ fontSize: 13, color: INK }}>Use recent transactions in this reassessment</Text>
        </View>
        <Pressable
          onPress={async () => {
            if (!online || requestingReassessment || !reassessmentReason.trim()) return;
            setRequestingReassessment(true);
            setReassessmentMessage(null);
            try {
              const { response, body } = await requestProfileReassessment(accessToken, reassessmentReason, useRecentTransactions);
              if (response.ok) {
                onRequestReassessment?.();
              } else {
                setReassessmentMessage(body.message ?? "Couldn't request reassessment.");
              }
            } catch {
              setReassessmentMessage("Can't request reassessment while offline.");
            } finally {
              setRequestingReassessment(false);
            }
          }}
          disabled={!online || requestingReassessment || !reassessmentReason.trim()}
          style={{ marginTop: 16, minHeight: 48, borderRadius: 14, backgroundColor: AQUA700, alignItems: "center", justifyContent: "center", opacity: online && reassessmentReason.trim() ? 1 : 0.45 }}
        >
          <Text style={{ color: "#FFFFFF", fontSize: 14, fontWeight: "700" }}>{requestingReassessment ? "Requesting..." : "Request reassessment"}</Text>
        </Pressable>
        {reassessmentMessage ? <Text style={{ marginTop: 12, color: reassessmentMessage.startsWith("Reassessment") ? AQUA700 : MONZA600, fontSize: 13 }}>{reassessmentMessage}</Text> : null}
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
        <Divider />
        <NavRow icon={<ClockAfternoon size={18} color={MUTED} />} label="Preferences" subtitle="Seasonal preferences and custom events" onPress={() => setSubPage("preferences")} />
      </BorderedGroup>

      <View style={{ height: 20 }} />

      {beforeDangerZone ? <View style={{ marginBottom: 20 }}>{beforeDangerZone}</View> : null}

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
        Budgie provides budgeting tools, not professional financial advice. Decisions are your own.
      </Text>
    </View>
  );
}
