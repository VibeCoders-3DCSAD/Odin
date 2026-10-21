import { ActivityIndicator, Dimensions, KeyboardAvoidingView, Pressable, ScrollView, Text, View } from "react-native";
import { Bank, Check, CreditCard, Money, Wallet } from "phosphor-react-native";
import type { ReactNode } from "react";
import type { FinancialAccountKind } from "../local-db/repositories/financialFoundations";
import { BottomSheetSurface } from "./BottomSheetSurface";
import { ActionSheet } from "./ActionSheet";
import { styles as ui, tileTints, v4, v4Font } from "./BudgieForm";

type AccountOption = { id: string; name: string; kind?: FinancialAccountKind; amountLabel?: string };
type Props = {
  visible?: boolean;
  title: string;
  accounts: AccountOption[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onClose: () => void;
  children?: ReactNode;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  emptyMessage?: string;
  accountLabelPrefix?: string;
};

function accountTint(kind: AccountOption["kind"]) {
  if (kind === "savings") return tileTints[3];
  if (kind === "e_wallet") return tileTints[1];
  if (kind === "cash") return tileTints[2];
  if (kind === "credit_card") return tileTints[0];
  return tileTints[4];
}

function AccountKindIcon({ kind, color }: { kind: AccountOption["kind"]; color: string }) {
  if (kind === "bank" || kind === "savings") return <Bank color={color} size={16} weight="bold" />;
  if (kind === "credit_card") return <CreditCard color={color} size={16} weight="bold" />;
  if (kind === "cash") return <Money color={color} size={16} weight="bold" />;
  return <Wallet color={color} size={16} weight="bold" />;
}

export default function AccountSelectionSheet({ visible = true, title, accounts, selectedId, onSelect, onClose, children, loading = false, error, onRetry, emptyMessage = "No financial accounts available", accountLabelPrefix = "" }: Props) {
  return <ActionSheet visible={visible} onClose={onClose} backdropColor="rgba(27,28,26,0.4)" accessibilityLabel="Close account picker">
        <KeyboardAvoidingView behavior="padding">
          <BottomSheetSurface style={{ backgroundColor: v4.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: Dimensions.get("window").height * 0.85 }}>
            <View style={{ width: 38, height: 4, borderRadius: 4, backgroundColor: "#DBD7CD", alignSelf: "center", marginTop: 10 }} />
            <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 36, gap: 12 }} keyboardShouldPersistTaps="handled" bounces={false}>
              <Text style={{ fontFamily: v4Font, fontWeight: "800", fontSize: 16, color: v4.ink }}>{title}</Text>
              {children}
              {loading ? <ActivityIndicator accessibilityLabel="Loading financial accounts" color={v4.brand} /> : error ? <>
                <Text accessibilityRole="alert" style={ui.fieldError}>{error}</Text>
                {onRetry ? <Pressable accessibilityRole="button" onPress={onRetry} style={{ padding: 10 }}><Text style={{ fontFamily: v4Font, fontWeight: "700", color: v4.brand }}>Retry accounts</Text></Pressable> : null}
              </> : accounts.length === 0 ? <Text style={{ fontFamily: v4Font, fontSize: 13, color: v4.mut, textAlign: "center", paddingVertical: 20 }}>{emptyMessage}</Text> : <View style={ui.list}>
                {accounts.map((account, index) => {
                  const selected = account.id === selectedId;
                  const tint = accountTint(account.kind);
                  const kindLabel = account.kind ? account.kind.charAt(0).toUpperCase() + account.kind.slice(1).replace("_", " ") : null;
                  const subtitle = [kindLabel, account.amountLabel].filter(Boolean).join(" · ");
                  return <Pressable key={account.id} accessibilityRole="button" accessibilityLabel={`${accountLabelPrefix}${account.name}`} accessibilityState={{ selected }} onPress={() => { onSelect(account.id); onClose(); }} style={[ui.listRow, index > 0 ? ui.listRowDivider : null, selected ? ui.listRowSelected : null]}>
                    <View style={ui.listRowMain}>
                      <View style={[ui.listTile, { backgroundColor: tint.bg }]}><AccountKindIcon kind={account.kind} color={tint.fg} /></View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text numberOfLines={1} style={ui.listTitle}>{account.name}</Text>
                        {subtitle ? <Text numberOfLines={1} style={ui.listSubtitle}>{subtitle}</Text> : null}
                      </View>
                      {selected ? <Check color={v4.brandMid} size={16} weight="bold" /> : null}
                    </View>
                  </Pressable>;
                })}
              </View>}
            </ScrollView>
          </BottomSheetSurface>
        </KeyboardAvoidingView>
  </ActionSheet>;
}
