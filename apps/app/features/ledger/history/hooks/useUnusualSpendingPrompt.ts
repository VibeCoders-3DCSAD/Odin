import { useEffect, useState } from "react";
import { answerUnusualSpending, type SpendingRecurrence, type UnusualSpendingInsight } from "../../../../local-db/repositories/alerts/unusualSpending";

type Options = {
  userId: string;
  deviceId: string;
  unusualSpending: UnusualSpendingInsight | null;
  // The prompt waits for the list so it does not cover the spinner.
  loading: boolean;
  onUnusualSpendingDismissed: () => void;
};

export function useUnusualSpendingPrompt({ userId, deviceId, unusualSpending, loading, onUnusualSpendingDismissed }: Options) {
  const [showUnusualSpending, setShowUnusualSpending] = useState(false);

  useEffect(() => {
    if (!loading && unusualSpending) setShowUnusualSpending(true);
  }, [loading, unusualSpending]);

  // RecurrenceQuestion shows the error when saving fails.
  async function answerUnusualSpendingRecurrence(recurrence: SpendingRecurrence, months?: number[]): Promise<void> {
    if (!unusualSpending) return;
    await answerUnusualSpending(userId, deviceId, unusualSpending.transactionId, recurrence, months);
    dismissUnusualSpending();
  }

  function dismissUnusualSpending(): void {
    setShowUnusualSpending(false);
    onUnusualSpendingDismissed();
  }

  return { visible: showUnusualSpending && unusualSpending !== null, answerUnusualSpendingRecurrence };
}
