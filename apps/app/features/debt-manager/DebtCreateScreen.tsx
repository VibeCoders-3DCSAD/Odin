import { Pressable, Text, View } from "react-native";
import { useEffect } from "react";
import { ArrowLeft } from "phosphor-react-native";
import { DebtForm } from "./components/DebtForm";
import { useDebtManager } from "./hooks/useDebtManager";

type Props = { userId: string; deviceId: string; onBack: () => void; onSaved: () => void };

export default function DebtCreateScreen({ userId, deviceId, onBack, onSaved }: Props) {
  const manager = useDebtManager({ userId, deviceId });

  useEffect(() => { manager.openCreate(); }, []);

  async function save() {
    if (await manager.save()) onSaved();
  }

  return <View style={{ gap: 14 }}>
    <View>
      <Pressable accessibilityRole="button" accessibilityLabel="Back to Debt Manager" onPress={onBack} style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 2 }}>
        <ArrowLeft size={18} color="#1B1C1A" weight="bold" />
        <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 14, color: "#6B7A6F" }}>Debt Manager</Text>
      </Pressable>
      <Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 20, color: "#1B1C1A" }}>Add Debt</Text>
    </View>
    {manager.showCreate ? <DebtForm editingId={null} name={manager.name} lenderName={manager.lenderName} balance={manager.balance} interestRate={manager.interestRate} minimum={manager.minimum} paymentFrequency={manager.paymentFrequency} paymentSchedule={manager.paymentSchedule} nextDueDate={manager.nextDueDate} maturityDate={manager.maturityDate} targetPayoffDate={manager.targetPayoffDate} interestPeriod={manager.interestPeriod} interestMethod={manager.interestMethod} notes={manager.notes} presetKey={manager.presetKey} presetData={manager.presetData} formError={manager.formError} pending={manager.pendingIds.has("new")} setName={manager.setName} setLenderName={manager.setLenderName} setBalance={manager.setBalance} setInterestRate={manager.setInterestRate} setMinimum={manager.setMinimum} setPaymentFrequency={manager.setPaymentFrequency} setPaymentSchedule={manager.setPaymentSchedule} setNextDueDate={manager.setNextDueDate} setMaturityDate={manager.setMaturityDate} setTargetPayoffDate={manager.setTargetPayoffDate} setInterestPeriod={manager.setInterestPeriod} setInterestMethod={manager.setInterestMethod} setNotes={manager.setNotes} setPresetKey={manager.setPresetKey} setPresetData={manager.setPresetData} onCancel={onBack} onSave={() => void save()} /> : null}
    {manager.error ? <Text style={{ color: "#D9001F" }}>{manager.error}</Text> : null}
  </View>;
}
