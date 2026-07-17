import { useEffect } from "react";
import { AppState } from "react-native";
import { triggerRecurringEngine } from "../services/recurringEngine";

export function useRecurringEngineTrigger(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;

    const sub = AppState.addEventListener("change", (next) => {
      if (next === "active") {
        triggerRecurringEngine();
      }
    });

    return () => sub.remove();
  }, [enabled]);
}
