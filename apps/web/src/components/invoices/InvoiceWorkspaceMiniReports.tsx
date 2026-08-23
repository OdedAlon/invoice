import { useEffect, useMemo, useState, type Dispatch, type FormEvent, type SetStateAction } from "react";
import { DocumentType, type DraftInvoice } from "@invoice/shared";
import { formatDate, today } from "@/lib/format";
import { apiDelete, apiPost } from "@/lib/api";
import { monthOptions, type ExpenseItem } from "@/types/workspace";
import { Panel } from "@/components/common/Panel";
import { Field } from "@/components/common/Field";
import { EmptyState } from "@/components/common/EmptyState";
import { MonthlyIncomeExpenseChart } from "@/components/reports/MonthlyIncomeExpenseChart";

export function InvoiceWorkspaceMiniReports({
  issuedInvoices,
  demoDocs,
  expenses,
  setExpenses,
  currencyFormatter,
  toast,
  onError
}: {
  issuedInvoices: DraftInvoice[];
  demoDocs: DraftInvoice[];
  expenses: ExpenseItem[];
  setExpenses: Dispatch<SetStateAction<ExpenseItem[]>>;
  currencyFormatter: Intl.NumberFormat;
  toast: (message: string, type?: "info" | "success" | "error") => void;
  onError: (message: string | null) => void;
}) {
  const [reportYear, setReportYear] = useState(new Date().getFullYear());
  const [reportMonth, setReportMonth] = useState("ALL");
  const [showAllExpenses, setShowAllExpenses] = useState(false);
  const [expenseDate, setExpenseDate] = useState(today);
  const [expenseCategory, setExpenseCategory] = useState("הוצאות משרד");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseNotes, setExpenseNotes] = useState("");
  const [savingExpense, setSavingExpense] = useState(false);

  const reportIncomeEntries = useMemo(
    () =>
      [...issuedInvoices, ...demoDocs]
        .filter((invoice) => invoice.documentType === DocumentType.RECEIPT || invoice.documentType === DocumentType.INVOICE_RECEIPT)
        .map((invoice) => ({ id: invoice.id, date: invoice.issueDate, amount: invoice.totalAmount })),
    [issuedInvoices, demoDocs]
  );

  const reportExpenseEntries = useMemo(
    () => expenses.map((expense) => ({ id: expense.id, date: expense.date, amount: expense.amount })),
    [expenses]
  );

  const reportYears = useMemo(() => {
    const years = new Set<number>([new Date().getFullYear()]);

    for (const item of [...reportIncomeEntries, ...reportExpenseEntries]) {
      const year = Number(item.date.slice(0, 4));

      if (Number.isFinite(year)) {
        years.add(year);
      }
    }

    return Array.from(years).sort((a, b) => b - a);
  }, [reportIncomeEntries, reportExpenseEntries]);

  const reportStats = useMemo(() => {
    const isMonthMatch = (date: string) => {
      const year = Number(date.slice(0, 4));
      const month = date.slice(5, 7);
      return year === reportYear && (reportMonth === "ALL" || month === reportMonth);
    };

    const totalIncome = reportIncomeEntries
      .filter((item) => isMonthMatch(item.date))
      .reduce((sum, item) => sum + item.amount, 0);

    const totalExpenses = reportExpenseEntries
      .filter((item) => isMonthMatch(item.date))
      .reduce((sum, item) => sum + item.amount, 0);

    const netProfit = totalIncome - totalExpenses;

    return {
      totalIncome,
      totalExpenses,
      netProfit
    };
  }, [reportIncomeEntries, reportExpenseEntries, reportMonth, reportYear]);

  // Retained from the original implementation — currently unused by the JSX below,
  // preserved as-is since this component is a mechanical extraction, not a rewrite.
  const monthlySeries = useMemo(() => {
    const selectedMonths =
      reportMonth === "ALL"
        ? Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, "0"))
        : [reportMonth];

    const months = selectedMonths.map((month) => {
      const date = new Date(reportYear, Number(month) - 1, 1);
      return {
        key: `${reportYear}-${month}`,
        label: date.toLocaleDateString("he-IL", { month: "short", year: "2-digit" }),
        income: 0,
        expense: 0
      };
    });

    const monthIndex = new Map(months.map((month, index) => [month.key, index]));

    for (const item of reportIncomeEntries) {
      const key = item.date.slice(0, 7);
      const index = monthIndex.get(key);

      if (index !== undefined) {
        const targetMonth = months[index];

        if (targetMonth) {
          targetMonth.income += item.amount;
        }
      }
    }

    for (const item of reportExpenseEntries) {
      const key = item.date.slice(0, 7);
      const index = monthIndex.get(key);

      if (index !== undefined) {
        const targetMonth = months[index];

        if (targetMonth) {
          targetMonth.expense += item.amount;
        }
      }
    }

    return months.map((month) => ({
      ...month,
      income: Math.round(month.income * 100) / 100,
      expense: Math.round(month.expense * 100) / 100
    }));
  }, [reportExpenseEntries, reportIncomeEntries, reportMonth, reportYear]);
  void monthlySeries;

  const chartSeries = useMemo(() => {
    const now = new Date();
    // Always show 24 months ending at current month
    const totalMonths = 24;
    const months = Array.from({ length: totalMonths }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (totalMonths - 1 - i), 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      return { key, label: d.toLocaleDateString("he-IL", { month: "short", year: "2-digit" }), income: 0, expense: 0 };
    });

    const monthIndex = new Map(months.map((m, i) => [m.key, i]));

    for (const item of reportIncomeEntries) {
      const idx = monthIndex.get(item.date.slice(0, 7));
      if (idx !== undefined) months[idx]!.income += item.amount;
    }
    for (const item of reportExpenseEntries) {
      const idx = monthIndex.get(item.date.slice(0, 7));
      if (idx !== undefined) months[idx]!.expense += item.amount;
    }

    return months.map((m) => ({ ...m, income: Math.round(m.income * 100) / 100, expense: Math.round(m.expense * 100) / 100 }));
  }, [reportIncomeEntries, reportExpenseEntries]);

  // Keep reportYear valid whenever the available years change
  useEffect(() => {
    if (reportYears.length === 0) {
      return;
    }

    const firstYear = reportYears[0];

    if (firstYear !== undefined && !reportYears.includes(reportYear)) {
      setReportYear(firstYear);
    }
  }, [reportYear, reportYears]);

  async function removeExpense(id: string) {
    try {
      await apiDelete(`/v1/expenses/${id}`, "מחיקת ההוצאה נכשלה");
      setExpenses((current) => current.filter((item) => item.id !== id));
    } catch {
      toast("מחיקת ההוצאה נכשלה", "error");
    }
  }

  function resetExpenseForm() {
    setExpenseDate(today);
    setExpenseCategory("הוצאות משרד");
    setExpenseAmount("");
    setExpenseNotes("");
  }

  async function handleAddExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingExpense(true);
    onError(null);

    try {
      const amount = Number(expenseAmount);

      if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error("סכום ההוצאה חייב להיות גדול מאפס");
      }

      const created = await apiPost<ExpenseItem>(
        "/v1/expenses",
        {
          date: expenseDate,
          category: expenseCategory.trim() || "הוצאה",
          amount,
          notes: expenseNotes.trim() || undefined,
        },
        "שמירת ההוצאה נכשלה"
      );

      setExpenses((current) => [created, ...current]);
      resetExpenseForm();
    } catch (submitError) {
      onError(submitError instanceof Error ? submitError.message : "שמירת ההוצאה נכשלה");
    } finally {
      setSavingExpense(false);
    }
  }

  return (
    <Panel title="דוחות" description="תמונת מצב פיננסית מהירה + גרף הכנסות והוצאות חודשי.">
      <div className="space-y-5">
        <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="שנה">
            <select className="input bg-white" value={reportYear} onChange={(event) => setReportYear(Number(event.target.value))}>
              {reportYears.map((year) => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </Field>
          <Field label="חודש">
            <select className="input bg-white" value={reportMonth} onChange={(event) => setReportMonth(event.target.value)}>
              {monthOptions.map((month) => (
                <option key={month.value} value={month.value}>{month.label}</option>
              ))}
            </select>
          </Field>

        </div>


        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl bg-emerald-50 p-4">
            <div className="text-sm text-emerald-700">סה״כ הכנסות</div>
            <div className="mt-1 text-xl font-semibold text-emerald-900">{currencyFormatter.format(reportStats.totalIncome)}</div>
          </div>
          <div className="rounded-2xl bg-rose-50 p-4">
            <div className="text-sm text-rose-700">סה״כ הוצאות</div>
            <div className="mt-1 text-xl font-semibold text-rose-900">{currencyFormatter.format(reportStats.totalExpenses)}</div>
          </div>
          <div className="rounded-2xl bg-slate-100 p-4">
            <div className="text-sm text-slate-700">רווח נקי</div>
            <div className={`mt-1 text-xl font-semibold ${reportStats.netProfit >= 0 ? "text-emerald-800" : "text-rose-700"}`}>
              {currencyFormatter.format(reportStats.netProfit)}
            </div>
          </div>
        </div>

        <MonthlyIncomeExpenseChart data={chartSeries} currencyFormatter={currencyFormatter} />

        {/* Monthly breakdown table */}
        {reportMonth === "ALL" && chartSeries.some((m) => m.income > 0 || m.expense > 0) ? (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-500">
                <tr>
                  <th className="px-3 py-2 text-right font-medium">חודש</th>
                  <th className="px-3 py-2 text-right font-medium">הכנסות</th>
                  <th className="px-3 py-2 text-right font-medium">הוצאות</th>
                  <th className="px-3 py-2 text-right font-medium">רווח</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {chartSeries.filter((m) => m.income > 0 || m.expense > 0).map((m) => (
                  <tr key={m.key} className="hover:bg-slate-50">
                    <td className="px-3 py-2 font-medium text-slate-700">{m.label}</td>
                    <td className="px-3 py-2 text-emerald-700">{currencyFormatter.format(m.income)}</td>
                    <td className="px-3 py-2 text-rose-700">{currencyFormatter.format(m.expense)}</td>
                    <td className={`px-3 py-2 font-medium ${m.income - m.expense >= 0 ? "text-emerald-700" : "text-rose-700"}`}>{currencyFormatter.format(m.income - m.expense)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {/* Expense category breakdown */}
        {expenses.length > 0 ? (() => {
          const byCategory = new Map<string, number>();
          for (const exp of expenses) {
            const isInYear = exp.date.startsWith(String(reportYear));
            const isInMonth = reportMonth === "ALL" || exp.date.slice(5, 7) === reportMonth;
            if (isInYear && isInMonth) byCategory.set(exp.category, (byCategory.get(exp.category) ?? 0) + exp.amount);
          }
          const sorted = Array.from(byCategory.entries()).sort((a, b) => b[1] - a[1]);
          if (sorted.length === 0) return null;
          return (
            <div className="rounded-xl border border-slate-200 p-3">
              <h3 className="mb-2 text-sm font-semibold text-slate-700">הוצאות לפי קטגוריה</h3>
              <div className="space-y-1.5">
                {sorted.map(([cat, amount]) => (
                  <div key={cat} className="flex items-center justify-between text-sm">
                    <span className="text-slate-600">{cat}</span>
                    <span className="font-medium text-rose-700">{currencyFormatter.format(amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })() : null}

        <div className="rounded-xl border border-slate-200 p-3">
          <h3 className="text-base font-semibold">הוספת הוצאה</h3>
          <form className="mt-3 grid gap-3 sm:grid-cols-2 md:grid-cols-5" onSubmit={handleAddExpense}>
            <Field label="תאריך">
              <input className="input" type="date" value={expenseDate} onChange={(event) => setExpenseDate(event.target.value)} />
            </Field>
            <Field label="קטגוריה">
              <input className="input" value={expenseCategory} onChange={(event) => setExpenseCategory(event.target.value)} />
            </Field>
            <Field label="סכום">
              <input className="input" type="number" min="0" step="0.01" inputMode="decimal" value={expenseAmount} onChange={(event) => setExpenseAmount(event.target.value)} />
            </Field>
            <Field label="הערות">
              <input className="input" value={expenseNotes} onChange={(event) => setExpenseNotes(event.target.value)} />
            </Field>
            <div className="flex items-end">
              <button className="w-full rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60" disabled={savingExpense}>
                {savingExpense ? "שומר..." : "הוספה"}
              </button>
            </div>
          </form>

          <div className="mt-4 space-y-2">
            {expenses.length === 0 ? <EmptyState text="עדיין לא נוספו הוצאות ידניות." /> : null}
            {(showAllExpenses ? expenses : expenses.slice(0, 8)).map((expense) => (
              <div key={expense.id} className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2 text-sm">
                <div className="flex flex-col">
                  <span className="font-medium">{expense.category}</span>
                  <span className="text-slate-500">{formatDate(expense.date)} • {expense.notes || "ללא הערות"}</span>
                </div>
                <div className="flex items-center gap-3">
                  <strong>{currencyFormatter.format(expense.amount)}</strong>
                  <button type="button" className="rounded px-2 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50 hover:text-rose-800" onClick={() => removeExpense(expense.id)}>
                    מחיקה
                  </button>
                </div>
              </div>
            ))}
            {expenses.length > 8 ? (
              <button
                type="button"
                className="w-full rounded-xl border border-slate-200 py-2 text-xs font-medium text-slate-500 hover:bg-slate-50"
                onClick={() => setShowAllExpenses((s) => !s)}
              >
                {showAllExpenses ? "הצג פחות" : `הצג את כל ההוצאות (${expenses.length})`}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </Panel>
  );
}
