import { X, Search, FilePlus2, ReceiptText, Users } from "lucide-react";
import type { Customer, DraftInvoice } from "@invoice/shared";
import { formatDate } from "@/lib/format";
import type { WorkspaceTab } from "@/types/workspace";

export function GlobalSearchModal({
  open,
  query,
  onQueryChange,
  onClose,
  results,
  customers,
  currencyFormatter,
  setSelectedTab,
  setCustomerSearch,
  setDraftSearch,
  setIssuedSearch,
  setIssuedCustomerFilter,
  setIssuedFromDate,
  setIssuedToDate,
  setIssuedPage
}: {
  open: boolean;
  query: string;
  onQueryChange: (value: string) => void;
  onClose: () => void;
  results: { customers: Customer[]; drafts: DraftInvoice[]; issued: DraftInvoice[] };
  customers: Customer[];
  currencyFormatter: Intl.NumberFormat;
  setSelectedTab: (tab: WorkspaceTab) => void;
  setCustomerSearch: (value: string) => void;
  setDraftSearch: (value: string) => void;
  setIssuedSearch: (value: string) => void;
  setIssuedCustomerFilter: (value: string) => void;
  setIssuedFromDate: (value: string) => void;
  setIssuedToDate: (value: string) => void;
  setIssuedPage: (value: number) => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center bg-slate-900/60 px-4 pt-16" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl dark:bg-slate-800" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-700">
          <Search className="h-4 w-4 shrink-0 text-slate-400" />
          <input
            autoFocus
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400 dark:text-white"
            placeholder="חיפוש לפי שם לקוח, מספר מסמך..."
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
          />
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600" aria-label="סגירה">
            <X className="h-4 w-4" />
          </button>
        </div>
        {query.trim() === "" ? (
          <div className="px-4 py-6 text-center text-sm text-slate-400">הקלד לחיפוש...</div>
        ) : (results.customers.length + results.drafts.length + results.issued.length) === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-slate-400">לא נמצאו תוצאות</div>
        ) : (
          <div className="max-h-[60vh] overflow-y-auto p-2">
            {results.customers.length > 0 ? (
              <div>
                <p className="px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-400">לקוחות</p>
                {results.customers.map((c) => (
                  <button
                    key={c.id}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-right hover:bg-slate-100 dark:hover:bg-slate-700"
                    onClick={() => {
                      setCustomerSearch(c.displayNameHe);
                      onClose();
                      setTimeout(() => {
                        const el = document.querySelector(`[data-customer-id="${c.id}"]`);
                        el?.scrollIntoView({ behavior: "smooth", block: "center" });
                      }, 200);
                    }}
                  >
                    <Users className="h-4 w-4 shrink-0 text-slate-400" />
                    <span className="text-sm font-medium text-slate-800 dark:text-white">{c.displayNameHe}</span>
                    {c.taxId ? <span className="text-xs text-slate-400">{c.taxId}</span> : null}
                  </button>
                ))}
              </div>
            ) : null}
            {results.drafts.length > 0 ? (
              <div>
                <p className="px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-400">טיוטות</p>
                {results.drafts.map((inv) => {
                  const c = customers.find((x) => x.id === inv.customerId);
                  return (
                    <button
                      key={inv.id}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-right hover:bg-slate-100 dark:hover:bg-slate-700"
                      onClick={() => {
                        const cust = customers.find((x) => x.id === inv.customerId);
                        setSelectedTab(inv.documentType as WorkspaceTab);
                        setDraftSearch(cust?.displayNameHe ?? "");
                        onClose();
                        setTimeout(() => document.getElementById("draft-panel")?.scrollIntoView({ behavior: "smooth", block: "start" }), 150);
                      }}
                    >
                      <FilePlus2 className="h-4 w-4 shrink-0 text-amber-500" />
                      <span className="text-sm font-medium text-slate-800 dark:text-white">{c?.displayNameHe ?? "לקוח לא ידוע"}</span>
                      <span className="text-xs text-slate-400">{formatDate(inv.issueDate)} • {currencyFormatter.format(inv.totalAmount)}</span>
                    </button>
                  );
                })}
              </div>
            ) : null}
            {results.issued.length > 0 ? (
              <div>
                <p className="px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-400">הונפקו</p>
                {results.issued.map((inv) => {
                  const c = customers.find((x) => x.id === inv.customerId);
                  return (
                    <button
                      key={inv.id}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-right hover:bg-slate-100 dark:hover:bg-slate-700"
                      onClick={() => {
                        setSelectedTab(inv.documentType as WorkspaceTab);
                        setIssuedSearch(String(inv.sequenceNumber ?? "") || (c?.displayNameHe ?? ""));
                        setIssuedCustomerFilter("");
                        setIssuedFromDate("");
                        setIssuedToDate("");
                        setIssuedPage(1);
                        onClose();
                        setTimeout(() => document.getElementById("issued-panel")?.scrollIntoView({ behavior: "smooth", block: "start" }), 150);
                      }}
                    >
                      <ReceiptText className="h-4 w-4 shrink-0 text-emerald-500" />
                      <span className="text-sm font-medium text-slate-800 dark:text-white">{c?.displayNameHe ?? "לקוח לא ידוע"}</span>
                      <span className="text-xs text-slate-400">{String(inv.sequenceNumber ?? "")} • {currencyFormatter.format(inv.totalAmount)}</span>
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
