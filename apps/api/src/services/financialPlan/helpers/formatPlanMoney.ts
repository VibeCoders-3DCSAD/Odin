export function peso(amountCentavos: number): string {
  return `₱${(amountCentavos / 100).toLocaleString("en-PH", { minimumFractionDigits: amountCentavos % 100 === 0 ? 0 : 2, maximumFractionDigits: 2 })}`;
}
