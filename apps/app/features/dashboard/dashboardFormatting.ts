export function formatPeso(centavos: number): string {
  const pesos = Math.abs(centavos) / 100;
  return `${centavos < 0 ? "-" : ""}₱${pesos.toLocaleString("en-PH", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
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
