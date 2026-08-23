import { useState } from "react";

export function MonthlyIncomeExpenseChart({
  data,
  currencyFormatter
}: {
  data: Array<{ label: string; income: number; expense: number }>;
  currencyFormatter: Intl.NumberFormat;
}) {
  const visibleCount = 6;
  const [offset, setOffset] = useState(() => Math.max(0, data.length - visibleCount));
  const visible = data.slice(offset, offset + visibleCount);
  const maxValue = Math.max(1, ...data.flatMap((item) => [item.income, item.expense]));
  const canPrev = offset > 0;
  const canNext = offset + visibleCount < data.length;

  return (
    <div className="rounded-xl border border-slate-200 p-3">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-base font-semibold">גרף הכנסות והוצאות</h3>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setOffset((o) => Math.max(0, o - 1))}
            disabled={!canPrev}
            className="rounded-lg border border-slate-200 px-2 py-1 text-slate-500 hover:bg-slate-100 disabled:opacity-30"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => setOffset((o) => Math.min(data.length - visibleCount, o + 1))}
            disabled={!canNext}
            className="rounded-lg border border-slate-200 px-2 py-1 text-slate-500 hover:bg-slate-100 disabled:opacity-30"
          >
            ›
          </button>
        </div>
      </div>
      <div className="flex gap-3">
        {visible.map((item) => {
          const incomeHeight = Math.max(8, Math.round((item.income / maxValue) * 140));
          const expenseHeight = Math.max(8, Math.round((item.expense / maxValue) * 140));
          return (
            <div key={item.label} className="flex-1 rounded-xl bg-slate-50 p-3 min-w-0">
              <div className="mb-3 text-center text-xs text-slate-500 truncate">{item.label}</div>
              <div className="mx-auto flex h-36 items-end justify-center gap-2">
                <div className="w-4 rounded-t bg-emerald-500" style={{ height: `${incomeHeight}px` }} title={`הכנסה: ${currencyFormatter.format(item.income)}`} />
                <div className="w-4 rounded-t bg-rose-400" style={{ height: `${expenseHeight}px` }} title={`הוצאה: ${currencyFormatter.format(item.expense)}`} />
              </div>
              <div className="mt-2 space-y-1 text-center text-[10px] text-slate-600">
                <div>{currencyFormatter.format(item.income)}</div>
                <div>{currencyFormatter.format(item.expense)}</div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex gap-4 text-xs text-slate-600">
        <span className="inline-flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-emerald-500" /> הכנסות</span>
        <span className="inline-flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-rose-400" /> הוצאות</span>
      </div>
    </div>
  );
}
