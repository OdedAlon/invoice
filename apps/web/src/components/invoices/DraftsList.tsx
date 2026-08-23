import { useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { getDocumentTypeLabel, type Customer, type DocumentType, type DraftInvoice } from "@invoice/shared";
import { formatDate } from "@/lib/format";
import { apiDelete, apiPost, invoicePrintUrl } from "@/lib/api";
import { Panel } from "@/components/common/Panel";
import { EmptyState } from "@/components/common/EmptyState";
import { SkeletonList } from "@/components/common/SkeletonList";

export function DraftsList({
  draftInvoices,
  customers,
  selectedDocumentType,
  selectedDocumentLabel,
  loading,
  draftSearch,
  setDraftSearch,
  duplicatingId,
  onDuplicate,
  onEditDraft,
  currencyFormatter,
  toast,
  confirmAction,
  onError,
  onRefresh
}: {
  draftInvoices: DraftInvoice[];
  customers: Customer[];
  selectedDocumentType: DocumentType;
  selectedDocumentLabel: string;
  loading: boolean;
  draftSearch: string;
  setDraftSearch: Dispatch<SetStateAction<string>>;
  duplicatingId: string | null;
  onDuplicate: (invoiceId: string) => Promise<void>;
  onEditDraft: (invoice: DraftInvoice) => void;
  currencyFormatter: Intl.NumberFormat;
  toast: (message: string, type?: "info" | "success" | "error", action?: { label: string; onClick: () => void }) => void;
  confirmAction: (message: string) => Promise<boolean>;
  onError: (message: string | null) => void;
  onRefresh: () => Promise<void>;
}) {
  const [bulkSelectMode, setBulkSelectMode] = useState(false);
  const [selectedDraftIds, setSelectedDraftIds] = useState<Set<string>>(new Set());
  const [bulkIssuing, setBulkIssuing] = useState(false);
  const [issuingInvoiceId, setIssuingInvoiceId] = useState<string | null>(null);
  const [deletingDraftId, setDeletingDraftId] = useState<string | null>(null);
  const [pendingDeleteSet, setPendingDeleteSet] = useState<Set<string>>(new Set());
  const pendingDeleteTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const filteredDraftInvoices = useMemo(() => {
    const search = draftSearch.trim().toLowerCase();
    return draftInvoices.filter((inv) => {
      if (inv.documentType !== selectedDocumentType) return false;
      if (!search) return true;
      const customer = customers.find((c) => c.id === inv.customerId);
      return (
        customer?.displayNameHe.toLowerCase().includes(search) ||
        customer?.taxId?.includes(search) ||
        (inv.notesHe ?? "").toLowerCase().includes(search)
      );
    });
  }, [draftInvoices, selectedDocumentType, draftSearch, customers]);

  async function handleIssueInvoice(invoiceId: string) {
    const draft = draftInvoices.find((d) => d.id === invoiceId);
    const customer = customers.find((c) => c.id === draft?.customerId);
    const totalStr = draft ? currencyFormatter.format(draft.totalAmount) : "";
    const customerStr = customer?.displayNameHe ?? "";
    const confirmMsg = `האם להנפיק את המסמך?${customerStr ? `\nלקוח: ${customerStr}` : ""}${totalStr ? ` • סה״כ ${totalStr}` : ""}\n\nפעולה זו בלתי הפיכה.`;
    if (!await confirmAction(confirmMsg)) return;
    setIssuingInvoiceId(invoiceId);
    onError(null);

    try {
      const issued = await apiPost<{ sequenceNumber?: number }>(`/v1/invoices/${invoiceId}/issue`, undefined, "הנפקת המסמך נכשלה");
      await onRefresh();
      toast(`המסמך הונפק בהצלחה${issued.sequenceNumber ? ` — מספר ${issued.sequenceNumber}` : ""}`, "success");
    } catch (issueError) {
      onError(issueError instanceof Error ? issueError.message : "הנפקת המסמך נכשלה");
    } finally {
      setIssuingInvoiceId(null);
    }
  }

  function handleDeleteDraft(invoiceId: string) {
    // Optimistically hide and give 5s undo window
    setPendingDeleteSet((prev) => new Set([...prev, invoiceId]));
    const tid = setTimeout(async () => {
      pendingDeleteTimers.current.delete(invoiceId);
      setPendingDeleteSet((prev) => { const next = new Set(prev); next.delete(invoiceId); return next; });
      setDeletingDraftId(invoiceId);
      try {
        await apiDelete(`/v1/invoices/drafts/${invoiceId}`, "מחיקת הטיוטה נכשלה");
        await onRefresh();
      } catch (e) {
        onError(e instanceof Error ? e.message : "מחיקת הטיוטה נכשלה");
        toast("מחיקת הטיוטה נכשלה", "error");
      } finally {
        setDeletingDraftId(null);
      }
    }, 5000);
    pendingDeleteTimers.current.set(invoiceId, tid);
    toast("הטיוטה תימחק בעוד 5 שניות", "info", {
      label: "ביטול",
      onClick: () => {
        clearTimeout(pendingDeleteTimers.current.get(invoiceId));
        pendingDeleteTimers.current.delete(invoiceId);
        setPendingDeleteSet((prev) => { const next = new Set(prev); next.delete(invoiceId); return next; });
        toast("המחיקה בוטלה", "success");
      }
    });
  }

  async function handleBulkIssue() {
    const ids = Array.from(selectedDraftIds);
    if (ids.length === 0) return;
    if (!await confirmAction(`להנפיק ${ids.length} טיוטות? לא ניתן לבטל לאחר הנפקה.`)) return;
    setBulkIssuing(true);
    onError(null);
    let issued = 0;
    let failed = 0;
    for (const id of ids) {
      try {
        await apiPost(`/v1/invoices/${id}/issue`);
        issued++;
        setSelectedDraftIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
      } catch {
        failed++;
      }
    }
    await onRefresh();
    setBulkIssuing(false);
    setBulkSelectMode(false);
    setSelectedDraftIds(new Set());
    if (failed === 0) toast(`הונפקו ${issued} מסמכים בהצלחה`, "success");
    else toast(`הונפקו ${issued}, נכשלו ${failed}`, "error");
  }

  return (
    <Panel id="draft-panel" title="טיוטות אחרונות" description="תצוגה תפעולית מהירה של המסמכים שטרם הונפקו.">
      <div className="space-y-3">
        <div className="flex gap-2">
          <input
            className="input flex-1"
            value={draftSearch}
            onChange={(e) => setDraftSearch(e.target.value)}
            placeholder="חיפוש לפי שם לקוח..."
            inputMode="search"
          />
          {filteredDraftInvoices.length > 0 ? (
            <button
              className={`rounded-xl border px-3 py-2 text-xs font-medium transition ${bulkSelectMode ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 text-slate-700 hover:bg-slate-50"}`}
              onClick={() => { setBulkSelectMode((m) => !m); setSelectedDraftIds(new Set()); }}
            >
              {bulkSelectMode ? "ביטול" : "בחירה מרובה"}
            </button>
          ) : null}
        </div>
        {bulkSelectMode && selectedDraftIds.size > 0 ? (
          <div className="flex items-center justify-between rounded-xl bg-slate-900 px-4 py-3 text-white">
            <span className="text-sm font-medium">{selectedDraftIds.size} נבחרו</span>
            <button
              className="rounded-xl bg-white px-4 py-2 text-xs font-semibold text-slate-900 hover:bg-slate-100 disabled:opacity-60"
              onClick={handleBulkIssue}
              disabled={bulkIssuing}
            >
              {bulkIssuing ? "מנפיק..." : `הנפק ${selectedDraftIds.size} נבחרים`}
            </button>
          </div>
        ) : null}
        <div className="max-h-[24rem] space-y-3 overflow-y-auto">
        {loading ? <SkeletonList rows={3} /> : null}
        {!loading && filteredDraftInvoices.length === 0 ? <EmptyState text={draftSearch ? "לא נמצאו טיוטות מתאימות לחיפוש." : `עדיין אין טיוטות ${selectedDocumentLabel}.`} action={draftSearch ? undefined : "יצירת טיוטה חדשה ↑"} onAction={draftSearch ? undefined : () => document.getElementById("invoice-form-panel")?.scrollIntoView({ behavior: "smooth" })} /> : null}
        {filteredDraftInvoices.filter((inv) => !pendingDeleteSet.has(inv.id)).map((invoice) => {
          const customer = customers.find((item) => item.id === invoice.customerId);
          const isIssuing = issuingInvoiceId === invoice.id;
          const isDeleting = deletingDraftId === invoice.id;
          const isSelected = selectedDraftIds.has(invoice.id);

          return (
            <article key={invoice.id} data-draft-id={invoice.id} className={`rounded-xl border p-3 ${bulkSelectMode && isSelected ? "border-slate-900 bg-slate-50" : "border-slate-200"}`}>
              <div className="flex items-center justify-between gap-3">
                {bulkSelectMode ? (
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-slate-900"
                    checked={isSelected}
                    onChange={() => setSelectedDraftIds((prev) => {
                      const next = new Set(prev);
                      if (next.has(invoice.id)) next.delete(invoice.id);
                      else next.add(invoice.id);
                      return next;
                    })}
                  />
                ) : null}
                <div className="flex-1">
                  <h3 className="font-medium">{customer?.displayNameHe ?? "לקוח לא ידוע"}</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    {formatDate(invoice.issueDate)} • {invoice.lines.length} שורות • {getDocumentTypeLabel(invoice.documentType)}
                  </p>
                </div>
                <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700">טיוטה</span>
              </div>
              <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
                <span>יתרה לתשלום</span>
                <strong className="text-base text-slate-900">{currencyFormatter.format(invoice.balanceDue)}</strong>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-medium text-white hover:bg-slate-700 disabled:opacity-60"
                  onClick={() => handleIssueInvoice(invoice.id)}
                  disabled={isIssuing || isDeleting}
                >
                  {isIssuing ? "מנפיק..." : "הנפקה"}
                </button>
                <button
                  className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  onClick={() => onEditDraft(invoice)}
                >
                  עריכה
                </button>
                <button
                  className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                  onClick={() => onDuplicate(invoice.id)}
                  disabled={duplicatingId === invoice.id}
                >
                  {duplicatingId === invoice.id ? "משכפל..." : "שכפל"}
                </button>
                <button
                  className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  onClick={() => window.open(invoicePrintUrl(invoice.id), "_blank", "noopener,noreferrer")}
                >
                  תצוגת הדפסה
                </button>
                <button
                  className="rounded-xl border border-rose-200 px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-60"
                  onClick={() => handleDeleteDraft(invoice.id)}
                  disabled={isIssuing || isDeleting}
                >
                  {isDeleting ? "מוחק..." : "מחיקה"}
                </button>
              </div>
            </article>
          );
        })}
        </div>
      </div>
    </Panel>
  );
}
