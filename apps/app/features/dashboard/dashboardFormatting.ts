export function formatPeso(centavos: number, fractionDigits = 0): string {
  const pesos = Math.abs(centavos) / 100;
  return `${centavos < 0 ? "-" : ""}₱${pesos.toLocaleString("en-PH", { minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits })}`;
}

export function formatPesoCompact(centavos: number): string {
  const pesos = Math.abs(centavos) / 100;
  if (pesos < 1000) return pesos.toLocaleString("en-PH", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  const thousands = pesos / 1000;
  return `${thousands % 1 === 0 ? thousands.toFixed(0) : thousands.toFixed(1)}k`;
}

export function deltaPercent(current: number, previous: number): string | null {
  if (previous === 0) return current > 0 ? "+100%" : null;
  const percent = ((current - previous) / Math.abs(previous)) * 100;
  return percent === 0 ? null : `${percent > 0 ? "+" : ""}${percent.toFixed(1)}%`;
}

export function formatTransactionTime(date: string): string {
  const value = new Date(date);
  if (value.toDateString() === new Date().toDateString()) return value.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  return value.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function getPreviousMonthName(): string {
  const date = new Date();
  date.setMonth(date.getMonth() - 1);
  return date.toLocaleDateString("en-US", { month: "short" });
}

// Morning 5:00–11:59, noon 12:00–12:59, afternoon 13:00–17:59, evening otherwise.
export function getGreeting(date = new Date()): string {
  const hour = date.getHours();
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour === 12) return "Good noon";
  if (hour >= 13 && hour < 18) return "Good afternoon";
  return "Good evening";
}
