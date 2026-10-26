// Available funds already exclude regular commitments, including unpaid ones.
// Extra debt and savings allocations are still inside available funds.
export function planSpendableFundsCentavos(availableFundsCentavos: number, debtSurplusCentavos = 0, savingsSurplusCentavos = 0): number {
  return availableFundsCentavos - debtSurplusCentavos - savingsSurplusCentavos;
}
