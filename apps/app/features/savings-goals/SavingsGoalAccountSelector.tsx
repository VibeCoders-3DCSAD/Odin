import { useEffect, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import AccountSelectionSheet from "../../components/AccountSelectionSheet";
import { getSavingsGoalAccount, listActiveSavingsGoalAccounts, type SavingsGoalAccount } from "../../local-db/repositories/savingsGoalAccounts";

type Props = { userId: string; value: string | null; onChange: (id: string) => void; invalid?: boolean };
const P = { brand: "#013220", ink: "#1B1C1A", muted: "#6B7A6F", line: "#EAEAE6", error: "#D9001F", white: "#FFFFFF" } as const;
const labelStyle = { color: P.ink, fontFamily: "Manrope", fontSize: 12, fontWeight: "700" as const };

export default function SavingsGoalAccountSelector({ userId, value, onChange, invalid }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [search, setSearch] = useState("");
  const [accounts, setAccounts] = useState<SavingsGoalAccount[]>([]);
  const [selected, setSelected] = useState<SavingsGoalAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setSelected(null);
    if (value) getSavingsGoalAccount(userId, value).then((account) => { if (!cancelled) setSelected(account); }).catch(() => {});
    return () => { cancelled = true; };
  }, [userId, value]);

  useEffect(() => {
    if (!expanded) return;
    let cancelled = false;
    setLoading(true);
    setError(false);
    const timer = setTimeout(() => {
      listActiveSavingsGoalAccounts(userId, search).then((rows) => {
        if (!cancelled) setAccounts(rows);
      }).catch(() => { if (!cancelled) { setAccounts([]); setError(true); } })
        .finally(() => { if (!cancelled) setLoading(false); });
    }, search ? 200 : 0);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [userId, search, retry, expanded]);

  return <View style={{ gap: 7 }}>
    <Text style={labelStyle}>Financial account</Text>
    <Pressable accessibilityRole="button" accessibilityLabel="Select financial account" accessibilityState={{ expanded }} onPress={() => setExpanded(!expanded)} style={{ backgroundColor: P.white, borderColor: invalid ? P.error : P.line, borderRadius: 10, borderWidth: 1, minHeight: 46, padding: 12, flexDirection: "row", alignItems: "center", gap: 8 }}>
      <Text style={{ flex: 1, color: selected ? P.ink : P.muted, fontFamily: "Manrope", fontSize: 14 }}>{selected ? `${selected.name}${selected.status === "archived" ? " (archived)" : ""}` : value ? "Linked account unavailable" : "Choose an active account"}</Text>
      <Text style={{ color: P.muted }}>{expanded ? "▴" : "▾"}</Text>
    </Pressable>
    {expanded ? <AccountSelectionSheet
      title="Financial account"
      accounts={accounts}
      selectedId={value}
      accountLabelPrefix="Link "
      onSelect={(id) => { setSelected(accounts.find((account) => account.id === id) ?? null); onChange(id); }}
      onClose={() => setExpanded(false)}
      loading={loading}
      error={error ? "Financial accounts could not be loaded." : null}
      onRetry={() => setRetry((previous) => previous + 1)}
      emptyMessage={search ? "No matching active accounts." : "Create or activate a financial account in Accounts before creating a savings goal."}
    >
      <TextInput accessibilityLabel="Search financial accounts" value={search} onChangeText={setSearch} placeholder="Search accounts" style={{ backgroundColor: P.white, borderColor: P.line, borderRadius: 10, borderWidth: 1, minHeight: 46, paddingHorizontal: 12, fontFamily: "Manrope", color: P.ink }} />
    </AccountSelectionSheet> : null}
    <Text style={{ color: invalid ? P.error : P.muted, fontFamily: "Manrope", fontSize: 12 }}>{invalid ? "Select an active financial account." : "Link this savings goal to the account where you keep its funds."}</Text>
  </View>;
}
