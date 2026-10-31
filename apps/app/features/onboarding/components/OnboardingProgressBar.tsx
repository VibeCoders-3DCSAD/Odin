import { View } from "react-native";
import { AQUA600, AQUA950, LINE } from "../colors";
import type { StepConfig } from "../types";

export function OnboardingProgressBar({ visibleSteps, visibleStepIndex }: { visibleSteps: StepConfig[]; visibleStepIndex: number }) {
  return (
    <View className="flex-row gap-1.5 px-5 pt-12 pb-4">
      {visibleSteps.map((s, i) => {
        const isDone = i < visibleStepIndex;
        const isCurrent = i === visibleStepIndex;
        const bg = isDone ? AQUA950 : isCurrent ? AQUA600 : LINE;
        return (
          <View
            key={s.key}
            style={{
              flex: 1,
              height: 3,
              borderRadius: 2,
              backgroundColor: bg,
            }}
          />
        );
      })}
    </View>
  );
}
