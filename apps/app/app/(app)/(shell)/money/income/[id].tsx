import { useLocalSearchParams } from "expo-router";
import { closeIncomeSourceForm, IncomeSourceFormPage } from "../../../../../features/money/components/IncomeSourceFormPage";
import { OwnedRecord } from "../../../../../features/shell/components/OwnedRecord";
import { FullScreenPage } from "../../../../../features/shell/components/FullScreenPage";
import { getIncomeSource } from "../../../../../local-db/repositories/financialFoundations";

// Edit an income source. Link here only with incomeSourceHref() from features/money/moneyRoutes.
export default function EditIncomeSourceRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <FullScreenPage>
    <OwnedRecord id={id} load={getIncomeSource} noun="income source" onClose={closeIncomeSourceForm}>
      {(incomeSourceId) => <IncomeSourceFormPage incomeSourceId={incomeSourceId} />}
    </OwnedRecord>
  </FullScreenPage>;
}
