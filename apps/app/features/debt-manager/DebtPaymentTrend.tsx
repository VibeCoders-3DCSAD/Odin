import React, { useState } from "react";
import { View } from "react-native";
import { Money } from "phosphor-react-native";
import { FormCard, Note } from "../../components/BudgieForm";
import type { DebtPaymentTrendPoint } from "./debtManagerSummary";
import { LinkButton, List, ListRow, formatPeso, formatShortDate } from "./debtUi";

export default function DebtPaymentTrend({ points }: { points: DebtPaymentTrendPoint[] }) {
  const [visibleCount, setVisibleCount] = useState(5);
  const recentPoints = points.slice().reverse().slice(0, visibleCount);
  const hasMore = points.length > recentPoints.length;
  return <View accessibilityLabel="Recorded debt payment trend">
    <FormCard title="Recent payments" right={<Note>{points.length} recorded</Note>}>
      {recentPoints.length === 0 ? <Note>No debt payments have been recorded yet.</Note> : <List>{recentPoints.map((point, index) => <ListRow
        key={`${point.date}-${point.debtName}-${index}`}
        divider={index > 0}
        accessibilityLabel={`${point.date}, ${point.debtName}, payment made ${formatPeso(point.amountCentavos)}`}
        icon={<Money size={17} color="#0E6D46" weight="bold" />}
        title={point.debtName}
        subtitle={formatShortDate(point.date)}
        value={formatPeso(point.amountCentavos)}
      />)}</List>}
      {hasMore ? <LinkButton label="Show 5 more payments" onPress={() => setVisibleCount((count) => count + 5)} /> : null}
    </FormCard>
  </View>;
}
