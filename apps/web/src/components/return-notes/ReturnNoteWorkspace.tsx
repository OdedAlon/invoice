import { useState, type FormEvent } from "react";
import { X } from "lucide-react";
import {
  DocumentType,
  getDocumentTypeLabel,
  type CreateDraftInvoiceInput,
  type Customer,
  type DraftInvoice
} from "@invoice/shared";
import { apiPost } from "@/lib/api";
import { emptyReturnNoteForm, type ReturnNoteFormState } from "@/types/workspace";
import { Panel } from "@/components/common/Panel";
import { Field } from "@/components/common/Field";

export function ReturnNoteWorkspace({
  customers,
  issuedInvoices,
  isPtur,
  currencyFormatter,
  onError,
  onRefresh
}: {
  customers: Customer[];
  issuedInvoices: DraftInvoice[];
  isPtur: boolean;
  currencyFormatter: Intl.NumberFormat;
  onError: (message: string | null) => void;
  onRefresh: () => Promise<void>;
}) {
  const [returnNoteForm, setReturnNoteForm] = useState<ReturnNoteFormState>(emptyReturnNoteForm());
  const [savingReturnNote, setSavingReturnNote] = useState(false);

  async function handleReturnNoteSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingReturnNote(true);
    onError(null);

    try {
      if (!returnNoteForm.customerId) throw new Error("יש לבחור לקוח");
      const selectedLines = returnNoteForm.lines.filter((l) => l.selected);
      if (selectedLines.length === 0) throw new Error("יש לבחור לפחות פריט אחד להחזרה");

      const payload: CreateDraftInvoiceInput = {
        customerId: returnNoteForm.customerId,
        documentType: DocumentType.RETURN_NOTE,
        issueDate: returnNoteForm.issueDate,
        notesHe: returnNoteForm.notesHe || undefined,
        lines: selectedLines.map((l) => ({
          descriptionHe: l.descriptionHe,
          quantity: -(Math.abs(Number(l.quantity)) || 1),
          unitPrice: Math.abs(Number(l.unitPrice)),
          vatRate: Number(l.vatRate)
        }))
      };

      const draft = await apiPost<{ id: string }>("/v1/invoices/drafts", payload, "יצירת הטיוטה נכשלה");
      await apiPost(`/v1/invoices/${draft.id}/issue`, undefined, "הנפקת תעודת ההחזרה נכשלה");

      setReturnNoteForm(emptyReturnNoteForm());
      await onRefresh();
    } catch (err) {
      onError(err instanceof Error ? err.message : "יצירת תעודת ההחזרה נכשלה");
    } finally {
      setSavingReturnNote(false);
    }
  }

  return (
    <Panel title="יצירת תעודת החזרה" description="בחר מסמך מקור, סמן פריטים וכמות להחזרה.">
      <form className="grid gap-4" onSubmit={handleReturnNoteSubmit}>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="לקוח">
            <select
              className="input"
              value={returnNoteForm.customerId}
              onChange={(e) => setReturnNoteForm((f) => ({ ...f, customerId: e.target.value, sourceInvoiceId: "", lines: [{ descriptionHe: "", quantity: "1", unitPrice: "0", vatRate: isPtur ? "0" : "17", selected: true }] }))}
            >
              <option value="">בחרו לקוח</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>{c.displayNameHe}</option>
              ))}
            </select>
          </Field>
          <Field label="מסמך מקור (אופציונלי)">
            <select
              className="input"
              value={returnNoteForm.sourceInvoiceId}
              onChange={(e) => {
                const srcId = e.target.value;
                const src = issuedInvoices.find((inv) => inv.id === srcId);
                if (src) {
                  setReturnNoteForm((f) => ({
                    ...f,
                    sourceInvoiceId: srcId,
                    lines: src.lines.map((l) => ({
                      descriptionHe: l.descriptionHe,
                      quantity: String(Math.abs(l.quantity)),
                      unitPrice: String(Math.abs(l.unitPrice)),
                      vatRate: String(l.vatRate),
                      selected: true
                    }))
                  }));
                } else {
                  setReturnNoteForm((f) => ({
                    ...f,
                    sourceInvoiceId: "",
                    lines: [{ descriptionHe: "", quantity: "1", unitPrice: "0", vatRate: isPtur ? "0" : "17", selected: true }]
                  }));
                }
              }}
            >
              <option value="">ללא — הזנה ידנית</option>
              {issuedInvoices
                .filter((inv) =>
                  (!returnNoteForm.customerId || inv.customerId === returnNoteForm.customerId) &&
                  inv.status !== "CANCELLED" &&
                  inv.documentType !== DocumentType.RETURN_NOTE &&
                  inv.documentType !== DocumentType.CREDIT_NOTE
                )
                .map((inv) => {
                  const label = `${getDocumentTypeLabel(inv.documentType ?? DocumentType.TAX_INVOICE)} #${inv.sequenceNumber ?? inv.id.slice(0, 8)} — ${currencyFormatter.format(inv.totalAmount)}`;
                  return <option key={inv.id} value={inv.id}>{label}</option>;
                })}
            </select>
          </Field>
        </div>

        <Field label="תאריך החזרה">
          <input
            className="input"
            type="date"
            value={returnNoteForm.issueDate}
            onChange={(e) => setReturnNoteForm((f) => ({ ...f, issueDate: e.target.value }))}
          />
        </Field>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium text-slate-700">פריטים להחזרה</span>
            <button
              type="button"
              className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
              onClick={() => setReturnNoteForm((f) => ({
                ...f,
                lines: [...f.lines, { descriptionHe: "", quantity: "1", unitPrice: "0", vatRate: isPtur ? "0" : "17", selected: true }]
              }))}
            >
              + הוסף שורה
            </button>
          </div>
          <div className="space-y-2">
            {returnNoteForm.lines.map((line, idx) => (
              <div key={idx} className={`grid gap-2 rounded-xl border p-3 transition-colors ${line.selected ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-slate-50 opacity-60"} sm:grid-cols-[auto_1fr_6rem_6rem_6rem_auto]`}>
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 accent-amber-600"
                  checked={line.selected}
                  onChange={(e) => setReturnNoteForm((f) => ({ ...f, lines: f.lines.map((l, i) => i === idx ? { ...l, selected: e.target.checked } : l) }))}
                />
                <input
                  className="input text-sm"
                  placeholder="תיאור פריט"
                  value={line.descriptionHe}
                  onChange={(e) => setReturnNoteForm((f) => ({ ...f, lines: f.lines.map((l, i) => i === idx ? { ...l, descriptionHe: e.target.value } : l) }))}
                />
                <input
                  className="input text-sm"
                  type="number"
                  min="0.001"
                  step="0.001"
                  placeholder="כמות"
                  value={line.quantity}
                  onChange={(e) => setReturnNoteForm((f) => ({ ...f, lines: f.lines.map((l, i) => i === idx ? { ...l, quantity: e.target.value } : l) }))}
                />
                <input
                  className="input text-sm"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="מחיר"
                  value={line.unitPrice}
                  onChange={(e) => setReturnNoteForm((f) => ({ ...f, lines: f.lines.map((l, i) => i === idx ? { ...l, unitPrice: e.target.value } : l) }))}
                />
                {!isPtur ? (
                  <input
                    className="input text-sm"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="מע״מ%"
                    value={line.vatRate}
                    onChange={(e) => setReturnNoteForm((f) => ({ ...f, lines: f.lines.map((l, i) => i === idx ? { ...l, vatRate: e.target.value } : l) }))}
                  />
                ) : <div />}
                <button
                  type="button"
                  className="rounded p-1 text-slate-400 hover:text-rose-600"
                  onClick={() => setReturnNoteForm((f) => ({ ...f, lines: f.lines.filter((_, i) => i !== idx) }))}
                  aria-label="הסר שורה"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        <Field label="הערות">
          <textarea
            className="input min-h-16"
            value={returnNoteForm.notesHe}
            onChange={(e) => setReturnNoteForm((f) => ({ ...f, notesHe: e.target.value }))}
            placeholder="סיבת ההחזרה (אופציונלי)"
          />
        </Field>

        <div className="flex justify-end">
          <button
            className="rounded-xl bg-amber-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-amber-800 disabled:opacity-60"
            disabled={savingReturnNote || customers.length === 0}
          >
            {savingReturnNote ? "מנפיק..." : "הנפקת תעודת החזרה"}
          </button>
        </div>
      </form>
    </Panel>
  );
}
