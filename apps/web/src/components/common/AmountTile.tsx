export function AmountTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/10 p-3">
      <div className="text-xs text-slate-300">{label}</div>
      <div className="mt-1 text-base font-semibold">{value}</div>
    </div>
  );
}
