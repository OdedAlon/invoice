export function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/10 p-3 backdrop-blur-sm">
      <div className="mb-2 flex items-center justify-between text-slate-200">
        <span className="text-xs">{label}</span>
        {icon}
      </div>
      <div className="text-base font-semibold">{value}</div>
    </div>
  );
}
