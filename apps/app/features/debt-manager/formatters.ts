export const today = () => new Date().toISOString().slice(0, 10);

export const money = (minor: number) => `₱${(minor / 100).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;
