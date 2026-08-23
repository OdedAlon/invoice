export const currencyFormatter = new Intl.NumberFormat("he-IL", {
  style: "currency",
  currency: "ILS"
});

export const today = new Date().toISOString().slice(0, 10);

export function formatDate(iso: string): string {
  if (!iso || iso.length < 10) return iso;
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}
