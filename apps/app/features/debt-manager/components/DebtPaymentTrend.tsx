import React, { useState } from "react";
import { View } from "react-native";
import { Money } from "phosphor-react-native";
import { Note } from "../../../components/BudgieForm";
import type { DebtPaymentTrendPoint } from "../helpers/debtManagerSummary";
import { LinkButton, List, ListRow, SectionHeader, formatPeso, formatShortDate } from "./debtUi";

export default function DebtPaymentTrend({ points }: { points: DebtPaymentTrendPoint[] }) {
  const [visibleCount, setVisibleCount] = useState(5);
  const recentPoints = points.slice().reverse().slice(0, visibleCount);
  const hasMore = points.length > recentPoints.length;
  return <View accessibilityLabel="Recorded debt payment trend" style={{ gap: 10 }}>
    <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" }}>
      <SectionHeader title="Recent payments" />
      <Note>{points.length} recorded</Note>
    </View>
    {recentPoints.length === 0 ? <List><ListRow title="No debt payments have been recorded yet." /></List> : <List>{recentPoints.map((point, index) => <ListRow
      key={`${point.date}-${point.debtName}-${index}`}
      divider={index > 0}
      accessibilityLabel={`${point.date}, ${point.debtName}, payment made ${formatPeso(point.amountCentavos)}`}
      icon={<Money size={17} color="#0E6D46" weight="bold" />}
      title={point.debtName}
      subtitle={formatShortDate(point.date)}
      value={formatPeso(point.amountCentavos)}
    />)}</List>}
    {hasMore ? <LinkButton label="Show 5 more payments" onPress={() => setVisibleCount((count) => count + 5)} /> : null}
  </View>;
}
