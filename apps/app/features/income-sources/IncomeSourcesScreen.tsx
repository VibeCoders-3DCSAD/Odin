import React, { useCallback, useEffect, useState } from "react";
import { Alert, Text, TouchableOpacity, View } from "react-native";
import { CurrencyDollar, Plus, TrendUp } from "phosphor-react-native";
import { listIncomeSources, deleteIncomeSource, type IncomeSource } from "../../local-db/repositories/financialFoundations";
import { listDebtAccounts, type DebtAccount } from "../../local-db/repositories/debtAccounts";
import { getIncomeSummary } from "../../local-db/repositories/incomeSummary";
import KebabTooltip from "../../components/KebabTooltip";
import AvailableBalanceCard from "../../components/AvailableBalanceCard";
import { FREQUENCY_LABELS } from "./presentation";

const P = {
  shell: "#fcf8f0", brand: "#013220", brandMedium: "#0E6D46",
  ink: "#1B1C1A", ink2: "#414942", muted: "#6B7A6F",
  line: "#EAEAE6", error: "#D9001F", card: "#F1F0EB", white: "#FFFFFF",
};

function formatPeso(centavos: number): string {
  const pesos = centavos / 100;
  const sign = pesos < 0 ? "-" : "";
  const formatted = `${sign}₱${Math.abs(pesos).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return formatted.length > 23 ? formatted.slice(0, 20) + "..." : formatted;
}

type Props = { userId: string; deviceId: string; onBack: () => void; onAdd: () => void; onEdit: (id: string) => void; onSyncRequested?: () => void };

export default function IncomeSourcesScreen({ userId, deviceId, onBack, onAdd, onEdit, onSyncRequested }: Props) {
  const [sources, setSources] = useState<IncomeSource[]>([]);
  const [debts, setDebts] = useState<DebtAccount[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [incomeSources, debtAccounts] = await Promise.all([listIncomeSources(userId), listDebtAccounts(userId)]);
    setSources(incomeSources);
    setDebts(debtAccounts);
    setLoading(false);
  }, [userId]);
  useEffect(() => { load(); }, [load]);

  const incomeSummary = getIncomeSummary(sources, debts);

  const handleDelete = (s: IncomeSource) => {
    Alert.alert(`Delete ${s.name}?`, "This income source will be permanently removed.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => { await deleteIncomeSource(userId, deviceId, s.id); await load(); onSyncRequested?.(); } },
    ]);
  };

  return (
    <>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <Text style={{ fontSize: 18, fontFamily: "Manrope", fontWeight: "700", color: P.ink }}>Income Sources</Text>
        <TouchableOpacity onPress={onAdd} accessibilityRole="button" accessibilityLabel="Add income source" hitSlop={8} style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: P.brand, alignItems: "center", justifyContent: "center" }}>
          <Plus size={18} color={P.white} weight="bold" />
        </TouchableOpacity>
      </View>
      <AvailableBalanceCard
        label="Estimated monthly income after debt deductions"
        amount={formatPeso(incomeSummary.netMonthlyCentavos).replace("₱", "")}
        detail={`${formatPeso(incomeSummary.grossMonthlyCentavos)} after taxes, before ${formatPeso(incomeSummary.salaryLoanDeductionsCentavos)} in salary-loan deductions`}
        marginBottom={16}
      />
      {loading ? null : sources.length === 0 ? (
        <View style={{ alignItems: "center", paddingTop: 40 }}>
          <TrendUp size={40} color={P.muted} />
          <Text style={{ marginTop: 12, fontSize: 15, fontFamily: "Manrope", color: P.muted }}>No income sources yet</Text>
          <Text style={{ marginTop: 4, fontSize: 13, fontFamily: "Manrope", color: P.muted }}>Tap + to add your first income source</Text>
        </View>
      ) : (
        sources.map((s) => (
          <View key={s.id} style={{ flexDirection: "row", alignItems: "center", backgroundColor: P.white, borderRadius: 12, marginBottom: 8, padding: 12, borderWidth: 1, borderColor: P.line }}>
            <View style={{ width: 44, height: 44, borderRadius: 10, backgroundColor: P.card, alignItems: "center", justifyContent: "center", marginRight: 12 }}>
              <CurrencyDollar size={22} color={P.brandMedium} weight="fill" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontFamily: "Manrope", fontWeight: "600", color: P.ink }}>{s.name}</Text>
              <Text style={{ fontSize: 12, fontFamily: "Manrope", color: P.muted, marginTop: 2 }}>{FREQUENCY_LABELS[s.frequency]} · {formatPeso(s.expectedAmountCentavos)}</Text>
            </View>
            <KebabTooltip
              kebabDirection="horizontal"
              tooltipLocation="bottomRight"
              onEdit={() => onEdit(s.id)}
              onDelete={() => handleDelete(s)}
            />
          </View>
        ))
      )}
    </>
  );
}
