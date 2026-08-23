import { useMemo, useState } from "react";
import { DocumentType, getDocumentTypeLabel, getPaymentMethodLabel, type Customer, type DraftInvoice } from "@invoice/shared";
import { formatDate } from "@/lib/format";
import type { ExpenseItem } from "@/types/workspace";
import { Field } from "@/components/common/Field";

type ReportView = "cash-book" | "ledger" | "pl" | "pl-monthly" | "customers-monthly" | "tax-diff";

export function ReportsPanel({
  issuedInvoices,
  expenses,
  customers,
  isPtur,
  currencyFormatter,
}: {
  issuedInvoices: DraftInvoice[];
  expenses: ExpenseItem[];
  customers: Customer[];
  isPtur: boolean;
  currencyFormatter: Intl.NumberFormat;
}) {
  const [activeReport, setActiveReport] = useState<ReportView>("cash-book");
  const [ledgerCustomerId, setLedgerCustomerId] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const receipts = useMemo(
    () => issuedInvoices.filter((inv) => inv.documentType === DocumentType.RECEIPT || inv.documentType === DocumentType.INVOICE_RECEIPT),
    [issuedInvoices]
  );

  const cashBookEntries = useMemo(
    () => receipts
      .filter((inv) => (!fromDate || inv.issueDate >= fromDate) && (!toDate || inv.issueDate <= toDate))
      .sort((a, b) => a.issueDate.localeCompare(b.issueDate)),
    [receipts, fromDate, toDate]
  );

  const ledgerEntries = useMemo(
    () => issuedInvoices
      .filter((inv) => inv.customerId === ledgerCustomerId)
      .filter((inv) => (!fromDate || inv.issueDate >= fromDate) && (!toDate || inv.issueDate <= toDate))
      .sort((a, b) => a.issueDate.localeCompare(b.issueDate)),
    [issuedInvoices, ledgerCustomerId, fromDate, toDate]
  );

  const monthlyPL = useMemo(() => {
    const now = new Date();
    const months = Array.from({ length: 12 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      return { key, label: d.toLocaleDateString("he-IL", { month: "short", year: "numeric" }), income: 0, expenses: 0 };
    });
    const idx = new Map(months.map((m, i) => [m.key, i]));
    for (const inv of receipts) { const i = idx.get(inv.issueDate.slice(0, 7)); if (i !== undefined) months[i]!.income += inv.totalAmount; }
    for (const exp of expenses) { const i = idx.get(exp.date.slice(0, 7)); if (i !== undefined) months[i]!.expenses += exp.amount; }
    return months.map((m) => ({ ...m, profit: m.income - m.expenses }));
  }, [receipts, expenses]);

  const customerMonthly = useMemo(() => {
    const now = new Date();
    const months = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      return { key, label: d.toLocaleDateString("he-IL", { month: "short", year: "2-digit" }) };
    });
    const monthKeys = new Set(months.map((m) => m.key));
    const data: Record<string, Record<string, number>> = {};
    for (const inv of receipts) {
      const m = inv.issueDate.slice(0, 7);
      if (!monthKeys.has(m)) continue;
      if (!data[inv.customerId]) data[inv.customerId] = {};
      data[inv.customerId]![m] = (data[inv.customerId]![m] ?? 0) + inv.totalAmount;
    }
    return { months, data };
  }, [receipts]);

  const taxDiffEntries = useMemo(
    () => issuedInvoices
      .filter((inv) => inv.documentType === DocumentType.TAX_INVOICE || inv.documentType === DocumentType.INVOICE_RECEIPT)
      .filter((inv) => (!fromDate || inv.issueDate >= fromDate) && (!toDate || inv.issueDate <= toDate))
      .map((inv) => ({ inv, expected: inv.subtotalAmount * 0.17, diff: inv.vatAmount - inv.subtotalAmount * 0.17 }))
      .filter(({ diff }) => Math.abs(diff) > 0.01),
    [issuedInvoices, fromDate, toDate]
  );

  const totalIncome = receipts.reduce((s, i) => s + i.totalAmount, 0);
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);

  const reportButtons: Array<{ id: ReportView; label: string }> = [
    { id: "cash-book", label: "ספר תקבולים ותשלומים" },
    { id: "ledger", label: "כרטסת חשבונות" },
    { id: "pl", label: 'דו"ח רווח והפסד' },
    { id: "pl-monthly", label: "רווח והפסד לפי חודש" },
    { id: "customers-monthly", label: "לקוחות לפי חודש" },
    { id: "tax-diff", label: "הפרשי שומה" },
  ];

  const thCls = "px-3 py-3 text-right font-medium text-slate-600";
  const tdCls = "px-3 py-2";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        {reportButtons.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => setActiveReport(r.id)}
            className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
              activeReport === r.id ? "bg-slate-900 text-white" : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {activeReport !== "customers-monthly" && activeReport !== "pl" && (
        <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <Field label="מתאריך"><input className="input bg-white" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} /></Field>
          <Field label="עד תאריך"><input className="input bg-white" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} /></Field>
          {(fromDate || toDate) ? (
            <button type="button" className="self-end rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-600 hover:bg-slate-50" onClick={() => { setFromDate(""); setToDate(""); }}>ניקוי</button>
          ) : null}
        </div>
      )}

      {/* ספר תקבולים */}
      {activeReport === "cash-book" && (
        <div className="overflow-auto rounded-2xl border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className={thCls}>מספר</th><th className={thCls}>תאריך</th><th className={thCls}>לקוח</th><th className={thCls}>אמצעי תשלום</th>
                {!isPtur && <><th className={thCls}>לפני מע"מ</th><th className={thCls}>מע"מ</th></>}
                <th className={thCls}>סה"כ</th>
              </tr>
            </thead>
            <tbody>
              {cashBookEntries.length === 0 && <tr><td colSpan={isPtur ? 5 : 7} className="px-4 py-8 text-center text-slate-400">אין תקבולים בתקופה זו</td></tr>}
              {cashBookEntries.map((inv) => {
                const cust = customers.find((c) => c.id === inv.customerId);
                return (
                  <tr key={inv.id} className="border-t border-slate-200">
                    <td className={`${tdCls} text-slate-500`}>מס׳ {inv.sequenceNumber ?? "—"}</td>
                    <td className={tdCls}>{formatDate(inv.issueDate)}</td>
                    <td className={`${tdCls} font-medium`}>{cust?.displayNameHe ?? "—"}</td>
                    <td className={tdCls}>{inv.payment?.method ? getPaymentMethodLabel(inv.payment.method) : "—"}</td>
                    {!isPtur && <><td className={tdCls}>{currencyFormatter.format(inv.subtotalAmount)}</td><td className={tdCls}>{currencyFormatter.format(inv.vatAmount)}</td></>}
                    <td className={`${tdCls} font-semibold`}>{currencyFormatter.format(inv.totalAmount)}</td>
                  </tr>
                );
              })}
              {cashBookEntries.length > 0 && (
                <tr className="border-t-2 border-slate-300 bg-slate-50 font-semibold">
                  <td className={tdCls} colSpan={isPtur ? 3 : 4}>סה"כ</td>
                  {!isPtur && <><td className={tdCls}>{currencyFormatter.format(cashBookEntries.reduce((s, i) => s + i.subtotalAmount, 0))}</td><td className={tdCls}>{currencyFormatter.format(cashBookEntries.reduce((s, i) => s + i.vatAmount, 0))}</td></>}
                  <td className={tdCls}>{currencyFormatter.format(cashBookEntries.reduce((s, i) => s + i.totalAmount, 0))}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* כרטסת */}
      {activeReport === "ledger" && (
        <div className="space-y-4">
          <Field label="לקוח">
            <select className="input" value={ledgerCustomerId} onChange={(e) => setLedgerCustomerId(e.target.value)}>
              <option value="">בחרו לקוח</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.displayNameHe}</option>)}
            </select>
          </Field>
          {ledgerCustomerId && (
            <div className="overflow-auto rounded-2xl border border-slate-200">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className={thCls}>מספר</th><th className={thCls}>סוג</th><th className={thCls}>תאריך</th>
                    {!isPtur && <><th className={thCls}>לפני מע"מ</th><th className={thCls}>מע"מ</th></>}
                    <th className={thCls}>סה"כ</th>
                  </tr>
                </thead>
                <tbody>
                  {ledgerEntries.length === 0 && <tr><td colSpan={isPtur ? 4 : 6} className="px-4 py-8 text-center text-slate-400">אין מסמכים</td></tr>}
                  {ledgerEntries.map((inv) => (
                    <tr key={inv.id} className="border-t border-slate-200">
                      <td className={`${tdCls} text-slate-500`}>מס׳ {inv.sequenceNumber ?? "—"}</td>
                      <td className={tdCls}>{getDocumentTypeLabel(inv.documentType)}</td>
                      <td className={tdCls}>{formatDate(inv.issueDate)}</td>
                      {!isPtur && <><td className={tdCls}>{currencyFormatter.format(inv.subtotalAmount)}</td><td className={tdCls}>{currencyFormatter.format(inv.vatAmount)}</td></>}
                      <td className={`${tdCls} font-semibold`}>{currencyFormatter.format(inv.totalAmount)}</td>
                    </tr>
                  ))}
                  {ledgerEntries.length > 0 && (
                    <tr className="border-t-2 border-slate-300 bg-slate-50 font-semibold">
                      <td className={tdCls} colSpan={isPtur ? 3 : 4}>סה"כ</td>
                      {!isPtur && <><td className={tdCls}>{currencyFormatter.format(ledgerEntries.reduce((s, i) => s + i.subtotalAmount, 0))}</td><td className={tdCls}>{currencyFormatter.format(ledgerEntries.reduce((s, i) => s + i.vatAmount, 0))}</td></>}
                      <td className={tdCls}>{currencyFormatter.format(ledgerEntries.reduce((s, i) => s + i.totalAmount, 0))}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* רווח והפסד */}
      {activeReport === "pl" && (
        <div className="overflow-hidden rounded-2xl border border-slate-200">
          <table className="w-full text-sm">
            <tbody>
              <tr className="border-b border-slate-200"><td className="px-4 py-3 text-slate-600">סה"כ הכנסות (קבלות)</td><td className="px-4 py-3 text-right font-semibold text-emerald-700">{currencyFormatter.format(totalIncome)}</td></tr>
              <tr className="border-b border-slate-200"><td className="px-4 py-3 text-slate-600">סה"כ הוצאות</td><td className="px-4 py-3 text-right font-semibold text-rose-600">{currencyFormatter.format(totalExpenses)}</td></tr>
              <tr className="bg-slate-900"><td className="px-4 py-3 font-bold text-white">רווח נקי</td><td className={`px-4 py-3 text-right font-bold text-lg ${totalIncome - totalExpenses >= 0 ? "text-emerald-300" : "text-rose-300"}`}>{currencyFormatter.format(totalIncome - totalExpenses)}</td></tr>
            </tbody>
          </table>
        </div>
      )}

      {/* רווח והפסד לפי חודש */}
      {activeReport === "pl-monthly" && (
        <div className="overflow-auto rounded-2xl border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr><th className={thCls}>חודש</th><th className={thCls}>הכנסות</th><th className={thCls}>הוצאות</th><th className={thCls}>רווח</th></tr>
            </thead>
            <tbody>
              {monthlyPL.map((m) => (
                <tr key={m.key} className="border-t border-slate-200">
                  <td className={tdCls}>{m.label}</td>
                  <td className={`${tdCls} text-emerald-700`}>{currencyFormatter.format(m.income)}</td>
                  <td className={`${tdCls} text-rose-600`}>{currencyFormatter.format(m.expenses)}</td>
                  <td className={`${tdCls} font-medium ${m.profit >= 0 ? "text-emerald-800" : "text-rose-700"}`}>{currencyFormatter.format(m.profit)}</td>
                </tr>
              ))}
              <tr className="border-t-2 border-slate-300 bg-slate-50 font-semibold">
                <td className={tdCls}>סה"כ</td>
                <td className={`${tdCls} text-emerald-700`}>{currencyFormatter.format(monthlyPL.reduce((s, m) => s + m.income, 0))}</td>
                <td className={`${tdCls} text-rose-600`}>{currencyFormatter.format(monthlyPL.reduce((s, m) => s + m.expenses, 0))}</td>
                <td className={`${tdCls} font-bold ${monthlyPL.reduce((s, m) => s + m.profit, 0) >= 0 ? "text-emerald-800" : "text-rose-700"}`}>{currencyFormatter.format(monthlyPL.reduce((s, m) => s + m.profit, 0))}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* לקוחות לפי חודש */}
      {activeReport === "customers-monthly" && (() => {
        const { months, data } = customerMonthly;
        const activeCustomers = customers.filter((c) => !!data[c.id]);
        return (
          <div className="overflow-auto rounded-2xl border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className={`${thCls} sticky right-0 bg-slate-50`}>לקוח</th>
                  {months.map((m) => <th key={m.key} className={`${thCls} whitespace-nowrap`}>{m.label}</th>)}
                  <th className={thCls}>סה"כ</th>
                </tr>
              </thead>
              <tbody>
                {activeCustomers.length === 0 && <tr><td colSpan={months.length + 2} className="px-4 py-8 text-center text-slate-400">אין נתונים</td></tr>}
                {activeCustomers.map((c) => {
                  const row = data[c.id] ?? {};
                  const total = Object.values(row).reduce((s, v) => s + v, 0);
                  return (
                    <tr key={c.id} className="border-t border-slate-200">
                      <td className={`${tdCls} font-medium sticky right-0 bg-white`}>{c.displayNameHe}</td>
                      {months.map((m) => <td key={m.key} className={tdCls}>{row[m.key] ? currencyFormatter.format(row[m.key]!) : "—"}</td>)}
                      <td className={`${tdCls} font-semibold`}>{currencyFormatter.format(total)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      })()}

      {/* הפרשי שומה */}
      {activeReport === "tax-diff" && (
        isPtur ? (
          <div className="rounded-2xl border border-slate-200 p-8 text-center text-slate-500">
            עוסק פטור פטור ממע"מ — דוח זה אינו רלוונטי עבורך.
          </div>
        ) : (
          <div className="overflow-auto rounded-2xl border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr><th className={thCls}>מספר</th><th className={thCls}>תאריך</th><th className={thCls}>מע"מ בפועל</th><th className={thCls}>מע"מ צפוי (17%)</th><th className={thCls}>הפרש</th></tr>
              </thead>
              <tbody>
                {taxDiffEntries.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-emerald-600">✓ אין הפרשים — כל המסמכים תואמים</td></tr>}
                {taxDiffEntries.map(({ inv, expected, diff }) => (
                  <tr key={inv.id} className="border-t border-slate-200">
                    <td className={`${tdCls} text-slate-500`}>מס׳ {inv.sequenceNumber ?? "—"}</td>
                    <td className={tdCls}>{formatDate(inv.issueDate)}</td>
                    <td className={tdCls}>{currencyFormatter.format(inv.vatAmount)}</td>
                    <td className={tdCls}>{currencyFormatter.format(expected)}</td>
                    <td className={`${tdCls} font-medium text-rose-600`}>{currencyFormatter.format(diff)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
    </div>
  );
}
