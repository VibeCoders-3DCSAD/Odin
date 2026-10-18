import { useState } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Bank, Check, CreditCard, Money, Wallet } from "phosphor-react-native";
import { BottomSheet, PickerField, styles as ui, tileTints, v4, v4Font } from "../../../components/BudgieForm";
import type { FinancialAccount } from "../../../local-db/repositories/financialFoundations";
import { formatDueDate, formatPhp } from "../presentation";

function AccountIcon({ kind, color }: { kind: FinancialAccount["kind"]; color: string }) {
  const Icon = kind === "credit_card" ? CreditCard : kind === "cash" ? Money : kind === "e_wallet" ? Wallet : Bank;
  return <Icon color={color} size={16} weight="bold" />;
}

export function AccountPickerSheet({ visible, accounts, selectedId, onSelect, onClose }: { visible: boolean; accounts: FinancialAccount[]; selectedId: string | null; onSelect: (accountId: string) => void; onClose: () => void }) {
  return (
    <BottomSheet visible={visible} onClose={onClose} title="Pay from">
      {accounts.length === 0 ? (
        <Text style={{ fontFamily: v4Font, fontSize: 13, color: v4.mut, textAlign: "center", paddingVertical: 20 }}>
          No eligible category, obligation, or source account is available. Add one and try again.
        </Text>
      ) : (
        <View style={ui.list}>
          {accounts.map((account, index) => {
            const selected = account.id === selectedId;
            const tint = tileTints[account.kind === "credit_card" ? 2 : 1];
            return (
              <Pressable key={account.id} onPress={() => { onSelect(account.id); onClose(); }} accessibilityRole="button" accessibilityLabel={account.name} accessibilityState={{ selected }} style={[ui.listRow, index > 0 ? ui.listRowDivider : null, selected ? ui.listRowSelected : null]}>
                <View style={ui.listRowMain}>
                  <View style={[ui.listTile, { backgroundColor: tint.bg }]}><AccountIcon kind={account.kind} color={tint.fg} /></View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text numberOfLines={1} style={ui.listTitle}>{account.name}</Text>
                    <Text numberOfLines={1} style={ui.listSubtitle}>{formatPhp(account.currentBalanceCentavos)}</Text>
                  </View>
                  {selected ? <Check color={v4.brandMid} size={16} weight="bold" /> : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      )}
    </BottomSheet>
  );
}

function toDate(value: string): Date {
  return new Date(`${value}T00:00:00`);
}

function fromDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function DateField({ label, value, placeholder, onChange, error = false }: { label: string; value: string | null; placeholder: string; onChange: (value: string) => void; error?: boolean }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Date>(value ? toDate(value) : new Date());
  const field = <PickerField label={label} value={value ? formatDueDate(value) : placeholder} placeholder={!value} error={error} onPress={() => { setDraft(value ? toDate(value) : new Date()); setOpen(true); }} />;
  if (!open) return field;
  if (Platform.OS === "android") {
    return <>{field}<DateTimePicker value={draft} mode="date" onChange={(_event, next) => { setOpen(false); if (next) onChange(fromDate(next)); }} /></>;
  }
  return (
    <>
      {field}
      <BottomSheet visible onClose={() => setOpen(false)}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Pressable onPress={() => setOpen(false)} accessibilityRole="button" accessibilityLabel="Cancel" hitSlop={8}><Text style={{ fontFamily: v4Font, fontWeight: "600", fontSize: 14, color: v4.mut }}>Cancel</Text></Pressable>
          <Text style={{ fontFamily: v4Font, fontWeight: "800", fontSize: 16, color: v4.ink }}>{label}</Text>
          <Pressable onPress={() => { onChange(fromDate(draft)); setOpen(false); }} accessibilityRole="button" accessibilityLabel="Done" hitSlop={8}><Text style={{ fontFamily: v4Font, fontWeight: "700", fontSize: 14, color: v4.brandMid }}>Done</Text></Pressable>
        </View>
        <DateTimePicker value={draft} mode="date" display="spinner" onChange={(_event, next) => { if (next) setDraft(next); }} />
      </BottomSheet>
    </>
  );
}
