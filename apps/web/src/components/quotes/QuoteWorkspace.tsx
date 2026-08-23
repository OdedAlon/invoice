import { useState, type Dispatch, type FormEvent, type SetStateAction } from "react";
import { DocumentType, type CreateDraftInvoiceInput, type Customer } from "@invoice/shared";
import { apiPost } from "@/lib/api";
import { emptyQuoteForm, type QuoteFormState, type WorkspaceTab } from "@/types/workspace";
import { Panel } from "@/components/common/Panel";
import { Field } from "@/components/common/Field";

export function QuoteWorkspace({
  quoteForm,
  setQuoteForm,
  customers,
  isPtur,
  onSelectTab,
  onError,
  onRefresh
}: {
  quoteForm: QuoteFormState;
  setQuoteForm: Dispatch<SetStateAction<QuoteFormState>>;
  customers: Customer[];
  isPtur: boolean;
  onSelectTab: (tab: WorkspaceTab) => void;
  onError: (message: string | null) => void;
  onRefresh: () => Promise<void>;
}) {
  const [savingQuote, setSavingQuote] = useState(false);

  async function handleQuoteSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingQuote(true);
    onError(null);

    try {
      const amount = Number(quoteForm.amount);
      const vatRate = Number(quoteForm.vatRate);

      if (!quoteForm.customerId) {
        throw new Error("יש לבחור לקוח להצעת המחיר");
      }

      if (!quoteForm.descriptionHe.trim()) {
        throw new Error("יש להזין תיאור להצעת המחיר");
      }

      if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error("סכום הצעת המחיר חייב להיות גדול מאפס");
      }

      const payload: CreateDraftInvoiceInput = {
        customerId: quoteForm.customerId,
        documentType: DocumentType.PROFORMA,
        issueDate: quoteForm.issueDate,
        dueDate: quoteForm.dueDate,
        notesHe: quoteForm.notesHe,
        lines: [
          {
            descriptionHe: quoteForm.descriptionHe,
            quantity: 1,
            unitPrice: amount,
            vatRate: isPtur ? 0 : (Number.isFinite(vatRate) ? vatRate : 17)
          }
        ]
      };

      await apiPost("/v1/invoices/drafts", payload, "שמירת הצעת המחיר נכשלה");

      onSelectTab("QUOTE");
      setQuoteForm(emptyQuoteForm(quoteForm.customerId));
      await onRefresh();
    } catch (submitError) {
      onError(submitError instanceof Error ? submitError.message : "שמירת הצעת המחיר נכשלה");
    } finally {
      setSavingQuote(false);
    }
  }

  return (
    <Panel title="יצירת הצעת מחיר" description="טופס קצר להצעת מחיר מהירה (נשמר כחשבונית עסקה).">
      <form className="grid gap-4" onSubmit={handleQuoteSubmit}>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="לקוח">
            <select
              className="input"
              value={quoteForm.customerId}
              onChange={(event) => setQuoteForm((current) => ({ ...current, customerId: event.target.value }))}
            >
              <option value="">בחרו לקוח</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>{customer.displayNameHe}</option>
              ))}
            </select>
          </Field>
          <Field label="תיאור ההצעה">
            <input
              className="input"
              value={quoteForm.descriptionHe}
              onChange={(event) => setQuoteForm((current) => ({ ...current, descriptionHe: event.target.value }))}
              placeholder="למשל: פרויקט מיתוג מלא"
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
          <Field label="סכום לפני מע״מ">
            <input
              className="input"
              type="number"
              min="0"
              step="0.01"
              value={quoteForm.amount}
              onChange={(event) => setQuoteForm((current) => ({ ...current, amount: event.target.value }))}
            />
          </Field>
          {!isPtur ? (
            <Field label="מע״מ %">
              <input
                className="input"
                type="number"
                min="0"
                step="0.01"
                value={quoteForm.vatRate}
                onChange={(event) => setQuoteForm((current) => ({ ...current, vatRate: event.target.value }))}
              />
            </Field>
          ) : null}
          <Field label="תאריך הצעה">
            <input
              className="input"
              type="date"
              value={quoteForm.issueDate}
              onChange={(event) => setQuoteForm((current) => ({ ...current, issueDate: event.target.value }))}
            />
          </Field>
          <Field label="תוקף עד">
            <input
              className="input"
              type="date"
              value={quoteForm.dueDate}
              onChange={(event) => setQuoteForm((current) => ({ ...current, dueDate: event.target.value }))}
            />
          </Field>
        </div>

        <Field label="הערות להצעה">
          <textarea
            className="input min-h-20"
            value={quoteForm.notesHe}
            onChange={(event) => setQuoteForm((current) => ({ ...current, notesHe: event.target.value }))}
            placeholder="תנאי תשלום, לוחות זמנים ועוד"
          />
        </Field>

        <div className="flex justify-end">
          <button
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:opacity-60"
            disabled={savingQuote || customers.length === 0}
          >
            {savingQuote ? "שומר הצעה..." : "שמירת הצעת מחיר"}
          </button>
        </div>
      </form>
    </Panel>
  );
}
