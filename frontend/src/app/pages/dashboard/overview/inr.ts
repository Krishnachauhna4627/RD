/** Rupee amounts in Indian grouping: ₹5,25,000. */
const rupees = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
const rupeesExact = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 });
const quantity = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 3 });

export function inr(value: number, exact = false): string {
  return (exact ? rupeesExact : rupees).format(value);
}

/** Short axis labels: ₹0, ₹50K, ₹1.5L, ₹2Cr. */
export function inrShort(value: number): string {
  const abs = Math.abs(value);
  const trim = (n: number) => String(Number(n.toFixed(1)));
  if (abs >= 1e7) return `₹${trim(value / 1e7)}Cr`;
  if (abs >= 1e5) return `₹${trim(value / 1e5)}L`;
  if (abs >= 1e3) return `₹${trim(value / 1e3)}K`;
  return `₹${trim(value)}`;
}

export function qty(value: number): string {
  return quantity.format(value);
}
