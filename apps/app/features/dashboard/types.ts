export type DashboardItemTarget = { kind: "biller" | "income" | "debt" | "credit_card" | "savings" | "observation"; id: string };

export type DashboardReminder = {
  id: string;
  title: string;
  detail: string;
  amountCentavos: number;
  date: string;
  target: DashboardItemTarget;
};

export type DashboardReminderSection = { items: DashboardReminder[]; unavailable: boolean };
export type DashboardReminders = { attention: DashboardReminderSection; upcoming: DashboardReminderSection };
