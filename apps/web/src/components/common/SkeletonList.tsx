export function SkeletonList({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="animate-pulse rounded-xl border border-slate-200 p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1 space-y-2">
              <div className="h-4 w-2/5 rounded bg-slate-200" />
              <div className="h-3 w-3/5 rounded bg-slate-100" />
            </div>
            <div className="h-6 w-14 rounded-full bg-slate-100" />
          </div>
          <div className="mt-3 flex gap-2">
            <div className="h-7 w-16 rounded-lg bg-slate-200" />
            <div className="h-7 w-12 rounded-lg bg-slate-100" />
            <div className="h-7 w-20 rounded-lg bg-slate-100" />
          </div>
        </div>
      ))}
    </div>
  );
}
