import { useEffect, useMemo, useRef, useState, type Dispatch, type FormEvent, type SetStateAction } from "react";
import {
  calculateDraftInvoice,
  getPaymentMethodLabel,
  DocumentType,
  PaymentMethod,
  type CreateDraftInvoiceInput,
  type Customer,
  type DraftInvoiceLineInput
} from "@invoice/shared";
import { apiPatch, apiPost } from "@/lib/api";
import { today } from "@/lib/format";
import {
  emptyInvoiceLine,
  emptyReceiptPaymentForm,
  buildReceiptPaymentPayload,
  validateReceiptPayment,
  type ReceiptPaymentFormState,
  type ServiceItem
} from "@/types/workspace";
import { Panel } from "@/components/common/Panel";
import { Field } from "@/components/common/Field";
import { AmountTile } from "@/components/common/AmountTile";

export function InvoiceForm({
  invoiceForm,
  setInvoiceForm,
  setInvoiceFormTouched,
  editingDraftId,
  setEditingDraftId,
  receiptPaymentForm,
  setReceiptPaymentForm,
  customers,
  serviceItems,
  isPtur,
  selectedDocumentType,
  selectedDocumentLabel,
  currencyFormatter,
  onOpenQuickCreate,
  toast,
  onError,
  onRefresh
}: {
  invoiceForm: CreateDraftInvoiceInput;
  setInvoiceForm: Dispatch<SetStateAction<CreateDraftInvoiceInput>>;
  setInvoiceFormTouched: Dispatch<SetStateAction<boolean>>;
  editingDraftId: string | null;
  setEditingDraftId: Dispatch<SetStateAction<string | null>>;
  receiptPaymentForm: ReceiptPaymentFormState;
  setReceiptPaymentForm: Dispatch<SetStateAction<ReceiptPaymentFormState>>;
  customers: Customer[];
  serviceItems: ServiceItem[];
  isPtur: boolean;
  selectedDocumentType: DocumentType;
  selectedDocumentLabel: string;
  currencyFormatter: Intl.NumberFormat;
  onOpenQuickCreate: () => void;
  toast: (message: string, type?: "info" | "success" | "error") => void;
  onError: (message: string | null) => void;
  onRefresh: () => Promise<void>;
}) {
  const [savingInvoice, setSavingInvoice] = useState(false);
  const customerSelectRef = useRef<HTMLSelectElement>(null);

  const [templates, setTemplates] = useState<Array<{ name: string; form: CreateDraftInvoiceInput }>>(() => {
    try { return JSON.parse(localStorage.getItem("invoice-templates") ?? "[]"); } catch { return []; }
  });

  useEffect(() => {
    localStorage.setItem("invoice-templates", JSON.stringify(templates));
  }, [templates]);

  const isReceiptLikeTab =
    selectedDocumentType === DocumentType.RECEIPT ||
    selectedDocumentType === DocumentType.INVOICE_RECEIPT;

  const totals = useMemo(() => calculateDraftInvoice(invoiceForm.lines), [invoiceForm.lines]);

  function updateInvoiceField<Key extends keyof CreateDraftInvoiceInput>(key: Key, value: CreateDraftInvoiceInput[Key]) {
    setInvoiceFormTouched(true);
    setInvoiceForm((current) => ({ ...current, [key]: value }));
  }

  function updateInvoiceLine(index: number, key: keyof DraftInvoiceLineInput, value: string) {
    setInvoiceFormTouched(true);
    setInvoiceForm((current) => ({
      ...current,
      lines: current.lines.map((line, lineIndex) => {
        if (lineIndex !== index) {
          return line;
        }

        if (key === "quantity" || key === "unitPrice" || key === "vatRate") {
          return {
            ...line,
            [key]: Number(value)
          };
        }

        return {
          ...line,
          [key]: value
        };
      })
    }));
  }

  function addInvoiceLine() {
    setInvoiceFormTouched(true);
    setInvoiceForm((current) => ({
      ...current,
      lines: [...current.lines, { ...emptyInvoiceLine, vatRate: isPtur ? 0 : 17 }]
    }));
  }

  function removeInvoiceLine(index: number) {
    setInvoiceFormTouched(true);
    setInvoiceForm((current) => ({
      ...current,
      lines: current.lines.filter((_, lineIndex) => lineIndex !== index)
    }));
  }

  function handleSaveAsTemplate() {
    const name = `תבנית — ${customers.find((c) => c.id === invoiceForm.customerId)?.displayNameHe ?? "ללא לקוח"} ${new Date().toLocaleDateString("he-IL")}`;
    setTemplates((prev) => [...prev, { name, form: { ...invoiceForm, customerId: "", issueDate: today, dueDate: today } }]);
    toast(`התבנית "${name}" נשמרה`, "success");
  }

  async function handleInvoiceSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingInvoice(true);
    onError(null);

    try {
      if (isReceiptLikeTab && !validateReceiptPayment(receiptPaymentForm)) {
        throw new Error("יש להשלים פרטי תשלום תקינים עבור קבלה");
      }

      const payload: CreateDraftInvoiceInput = {
        ...invoiceForm,
        documentType: selectedDocumentType,
        payment: isReceiptLikeTab ? buildReceiptPaymentPayload(receiptPaymentForm) : undefined
      };

      await apiPost("/v1/invoices/drafts", payload, "שמירת הטיוטה נכשלה");

      setInvoiceFormTouched(false);
      setInvoiceForm((current) => ({
        ...current,
        customerId: "",
        documentType: selectedDocumentType,
        issueDate: today,
        dueDate: today,
        notesHe: "",
        lines: [{ ...emptyInvoiceLine, vatRate: isPtur ? 0 : 17 }]
      }));
      setReceiptPaymentForm(emptyReceiptPaymentForm);
      try { localStorage.removeItem("invoice-form-autosave"); } catch { /* ignore */ }
      await onRefresh();
      // Return focus to customer selector for fast repeat entry
      setTimeout(() => customerSelectRef.current?.focus(), 50);
    } catch (submitError) {
      onError(submitError instanceof Error ? submitError.message : "שמירת הטיוטה נכשלה");
    } finally {
      setSavingInvoice(false);
    }
  }

  async function handleUpdateDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingDraftId) return;
    setSavingInvoice(true);
    onError(null);
    try {
      if (isReceiptLikeTab && !validateReceiptPayment(receiptPaymentForm)) {
        throw new Error("יש להשלים פרטי תשלום תקינים עבור קבלה");
      }

      const payload: CreateDraftInvoiceInput = {
        ...invoiceForm,
        documentType: selectedDocumentType,
        payment: isReceiptLikeTab ? buildReceiptPaymentPayload(receiptPaymentForm) : undefined
      };

      await apiPatch(`/v1/invoices/drafts/${editingDraftId}`, payload, "עדכון הטיוטה נכשל");

      setEditingDraftId(null);
      setInvoiceFormTouched(false);
      setInvoiceForm((current) => ({
        ...current,
        customerId: "",
        issueDate: today,
        dueDate: today,
        notesHe: "",
        lines: [{ ...emptyInvoiceLine, vatRate: isPtur ? 0 : 17 }]
      }));
      setReceiptPaymentForm(emptyReceiptPaymentForm);
      try { localStorage.removeItem("invoice-form-autosave"); } catch { /* ignore */ }
      await onRefresh();
      toast("הטיוטה עודכנה בהצלחה", "success");
    } catch (e) {
      onError(e instanceof Error ? e.message : "עדכון הטיוטה נכשל");
    } finally {
      setSavingInvoice(false);
    }
  }

  return (
    <Panel title={editingDraftId ? `עריכת טיוטת ${selectedDocumentLabel}` : `יצירת טיוטת ${selectedDocumentLabel}`} description={editingDraftId ? "ערכו את הטיוטה ושמרו את השינויים." : "מילוי זריז עם חישוב סכומים בזמן אמת."}>
      {editingDraftId ? (
        <div className="mb-3 flex items-center justify-between rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-700 border border-amber-200">
          <span>עורכים טיוטה קיימת</span>
          <button type="button" className="text-xs underline" onClick={() => { setEditingDraftId(null); setInvoiceFormTouched(false); setInvoiceForm((c) => ({ ...c, customerId: "", issueDate: today, dueDate: today, notesHe: "", lines: [{ ...emptyInvoiceLine, vatRate: isPtur ? 0 : 17 }] })); }}>ביטול עריכה</button>
        </div>
      ) : null}
      <form id="invoice-form-panel" className="grid gap-5" onSubmit={editingDraftId ? handleUpdateDraft : handleInvoiceSubmit}>
        {/* Templates bar */}
        {templates.length > 0 || true ? (
          <div className="flex flex-wrap items-center gap-2">
            {templates.length > 0 ? (
              <select
                className="input flex-1 text-sm"
                value=""
                onChange={(e) => {
                  const tpl = templates.find((t) => t.name === e.target.value);
                  if (tpl) {
                    setInvoiceFormTouched(true);
                    setInvoiceForm((f) => ({ ...tpl.form, documentType: f.documentType, issueDate: today, dueDate: today }));
                    toast("התבנית נטענה", "success");
                  }
                }}
              >
                <option value="">טען תבנית...</option>
                {templates.map((t) => <option key={t.name} value={t.name}>{t.name}</option>)}
              </select>
            ) : null}
            <button
              type="button"
              className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
              onClick={handleSaveAsTemplate}
              title="Ctrl+S לשמירת טיוטה"
            >
              שמור כתבנית
            </button>
          </div>
        ) : null}
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
          <Field label="לקוח">
            <select ref={customerSelectRef} className="input" value={invoiceForm.customerId} onChange={(event) => {
              if (event.target.value === "__new__") { onOpenQuickCreate(); }
              else updateInvoiceField("customerId", event.target.value);
            }}>
              <option value="">בחרו לקוח</option>
              <option value="__new__">+ הוספת לקוח חדש</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>{customer.displayNameHe}</option>
              ))}
            </select>
          </Field>
          <Field label="סוג מסמך">
            <div className="flex items-center rounded-xl border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-700 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200">
              {selectedDocumentLabel}
            </div>
          </Field>
          <Field label="תאריך מסמך">
            <input className="input" type="date" value={invoiceForm.issueDate} onChange={(event) => updateInvoiceField("issueDate", event.target.value)} />
          </Field>
          <Field label="תאריך פירעון">
            <input className="input" type="date" value={invoiceForm.dueDate ?? ""} onChange={(event) => updateInvoiceField("dueDate", event.target.value)} />
          </Field>
        </div>

        {isReceiptLikeTab ? (
          <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <h3 className="font-medium">פרטי תשלום בקבלה</h3>
            <div className="grid gap-4 md:grid-cols-3">
              <Field label="אמצעי תשלום">
                <select
                  className="input bg-white"
                  value={receiptPaymentForm.method}
                  onChange={(event) =>
                    setReceiptPaymentForm((current) => ({
                      ...current,
                      method: event.target.value as PaymentMethod
                    }))
                  }
                >
                  {Object.values(PaymentMethod).map((method) => (
                    <option key={method} value={method}>{getPaymentMethodLabel(method)}</option>
                  ))}
                </select>
              </Field>
            </div>

            {receiptPaymentForm.method === PaymentMethod.CREDIT ? (
              <div className="grid gap-4 md:grid-cols-3">
                <Field label="מספר כרטיס">
                  <input
                    className="input bg-white"
                    value={receiptPaymentForm.cardNumber}
                    onChange={(event) =>
                      setReceiptPaymentForm((current) => ({ ...current, cardNumber: event.target.value }))
                    }
                    placeholder="1234 5678 9012 3456"
                  />
                </Field>
                <Field label="סוג כרטיס">
                  <input
                    className="input bg-white"
                    value={receiptPaymentForm.cardType}
                    onChange={(event) =>
                      setReceiptPaymentForm((current) => ({ ...current, cardType: event.target.value }))
                    }
                    placeholder="ויזה / מאסטרקארד / אמקס"
                  />
                </Field>
                <Field label="מספר תשלומים">
                  <input
                    className="input bg-white"
                    type="number"
                    min="1"
                    value={receiptPaymentForm.installments}
                    onChange={(event) =>
                      setReceiptPaymentForm((current) => ({ ...current, installments: event.target.value }))
                    }
                    placeholder="1"
                  />
                </Field>
                <Field label="אסמכתא">
                  <input
                    className="input bg-white"
                    value={receiptPaymentForm.approvalCode}
                    onChange={(event) =>
                      setReceiptPaymentForm((current) => ({ ...current, approvalCode: event.target.value }))
                    }
                  />
                </Field>
                <Field label="תאריך">
                  <input
                    className="input bg-white"
                    type="date"
                    value={receiptPaymentForm.creditDate}
                    onChange={(event) =>
                      setReceiptPaymentForm((current) => ({ ...current, creditDate: event.target.value }))
                    }
                  />
                </Field>
              </div>
            ) : null}

            {receiptPaymentForm.method === PaymentMethod.CHECK ? (
              <div className="grid gap-4 md:grid-cols-5">
                <Field label="מספר צ'ק">
                  <input
                    className="input bg-white"
                    value={receiptPaymentForm.checkNumber}
                    onChange={(event) =>
                      setReceiptPaymentForm((current) => ({ ...current, checkNumber: event.target.value }))
                    }
                  />
                </Field>
                <Field label="מספר חשבון">
                  <input
                    className="input bg-white"
                    value={receiptPaymentForm.checkAccountNumber}
                    onChange={(event) =>
                      setReceiptPaymentForm((current) => ({ ...current, checkAccountNumber: event.target.value }))
                    }
                  />
                </Field>
                <Field label="בנק">
                  <input
                    className="input bg-white"
                    value={receiptPaymentForm.bankName}
                    onChange={(event) =>
                      setReceiptPaymentForm((current) => ({ ...current, bankName: event.target.value }))
                    }
                  />
                </Field>
                <Field label="סניף">
                  <input
                    className="input bg-white"
                    value={receiptPaymentForm.branchNumber}
                    onChange={(event) =>
                      setReceiptPaymentForm((current) => ({ ...current, branchNumber: event.target.value }))
                    }
                  />
                </Field>
                <Field label="תאריך פירעון הצ'ק">
                  <input
                    className="input bg-white"
                    type="date"
                    value={receiptPaymentForm.checkDueDate}
                    onChange={(event) =>
                      setReceiptPaymentForm((current) => ({ ...current, checkDueDate: event.target.value }))
                    }
                  />
                </Field>
              </div>
            ) : null}

            {receiptPaymentForm.method === PaymentMethod.BANK_TRANSFER ? (
              <div className="grid gap-4 md:grid-cols-5">
                <Field label="אסמכתא להעברה">
                  <input
                    className="input bg-white"
                    value={receiptPaymentForm.transferReference}
                    onChange={(event) =>
                      setReceiptPaymentForm((current) => ({ ...current, transferReference: event.target.value }))
                    }
                  />
                </Field>
                <Field label="תאריך העברה">
                  <input
                    className="input bg-white"
                    type="date"
                    value={receiptPaymentForm.transferDate}
                    onChange={(event) =>
                      setReceiptPaymentForm((current) => ({ ...current, transferDate: event.target.value }))
                    }
                  />
                </Field>
                <Field label="בנק">
                  <input
                    className="input bg-white"
                    value={receiptPaymentForm.bankName}
                    onChange={(event) =>
                      setReceiptPaymentForm((current) => ({ ...current, bankName: event.target.value }))
                    }
                  />
                </Field>
                <Field label="מספר סניף">
                  <input
                    className="input bg-white"
                    value={receiptPaymentForm.transferBranchNumber}
                    onChange={(event) =>
                      setReceiptPaymentForm((current) => ({ ...current, transferBranchNumber: event.target.value }))
                    }
                  />
                </Field>
                <Field label="מספר חשבון">
                  <input
                    className="input bg-white"
                    value={receiptPaymentForm.transferAccountNumber}
                    onChange={(event) =>
                      setReceiptPaymentForm((current) => ({ ...current, transferAccountNumber: event.target.value }))
                    }
                  />
                </Field>
              </div>
            ) : null}

            {receiptPaymentForm.method === PaymentMethod.PAYMENT_APP ? (
              <div className="grid gap-4 md:grid-cols-3">
                <Field label="שם אפליקציה">
                  <input
                    className="input bg-white"
                    value={receiptPaymentForm.paymentAppName}
                    onChange={(event) =>
                      setReceiptPaymentForm((current) => ({ ...current, paymentAppName: event.target.value }))
                    }
                    placeholder="Bit / PayBox / Pepper"
                  />
                </Field>
                <Field label="מזהה עסקה">
                  <input
                    className="input bg-white"
                    value={receiptPaymentForm.paymentAppTransactionId}
                    onChange={(event) =>
                      setReceiptPaymentForm((current) => ({ ...current, paymentAppTransactionId: event.target.value }))
                    }
                  />
                </Field>
                <Field label="טלפון משלם">
                  <input
                    className="input bg-white"
                    value={receiptPaymentForm.paymentAppPayerPhone}
                    onChange={(event) =>
                      setReceiptPaymentForm((current) => ({ ...current, paymentAppPayerPhone: event.target.value }))
                    }
                  />
                </Field>
              </div>
            ) : null}

            {receiptPaymentForm.method === PaymentMethod.OTHER ? (
              <Field label="פירוט אמצעי התשלום">
                <input
                  className="input bg-white"
                  value={receiptPaymentForm.otherDescription}
                  onChange={(event) =>
                    setReceiptPaymentForm((current) => ({ ...current, otherDescription: event.target.value }))
                  }
                  placeholder="למשל: שובר מתנה / קיזוז"
                />
              </Field>
            ) : null}
          </div>
        ) : null}

        <div className="space-y-3 rounded-xl border border-slate-200 p-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium">שורות חיוב</h3>
              <p className="text-sm text-slate-500">הוסיפו שירותים, כמות ומחיר לכל שורה.</p>
            </div>
            <button className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50" type="button" onClick={addInvoiceLine}>
              הוספת שורה
            </button>
          </div>

          <datalist id="service-items-list">
            {serviceItems.map((item) => (
              <option key={item.name} value={item.name} />
            ))}
          </datalist>

          {invoiceForm.lines.map((line, index) => (
            <div key={index} className="grid gap-2 rounded-xl bg-slate-50 p-3 md:grid-cols-[2fr_0.8fr_0.9fr_0.8fr_auto]">
              <Field label="תיאור שירות / מוצר">
                <input
                  className="input bg-white"
                  list="service-items-list"
                  value={line.descriptionHe}
                  placeholder="למשל: בניית דף נחיתה"
                  onChange={(event) => {
                    const val = event.target.value;
                    const match = serviceItems.find((s) => s.name === val);
                    setInvoiceFormTouched(true);
                    setInvoiceForm((current) => ({
                      ...current,
                      lines: current.lines.map((l, li) =>
                        li !== index ? l : {
                          ...l,
                          descriptionHe: val,
                          unitPrice: match && l.unitPrice === 0 ? match.defaultPrice : l.unitPrice
                        }
                      )
                    }));
                  }}
                />
              </Field>
              <Field label="כמות">
                <input className="input bg-white" type="number" min="1" step="1" value={line.quantity} onChange={(event) => updateInvoiceLine(index, "quantity", event.target.value)} />
              </Field>
              <Field label="מחיר יחידה">
                <input className="input bg-white" type="number" min="0" step="1" value={line.unitPrice} onChange={(event) => updateInvoiceLine(index, "unitPrice", event.target.value)} />
              </Field>
              {!isPtur ? (
                <Field label="מע״מ %">
                  <input className="input bg-white" type="number" min="0" step="1" value={line.vatRate} onChange={(event) => updateInvoiceLine(index, "vatRate", event.target.value)} />
                </Field>
              ) : null}
              <button className="self-end rounded-xl px-3 py-2 text-sm text-rose-600 hover:bg-rose-50 disabled:opacity-40" type="button" onClick={() => removeInvoiceLine(index)} disabled={invoiceForm.lines.length === 1}>
                הסר
              </button>
            </div>
          ))}
        </div>

        <Field label="הערות למסמך">
          <textarea className="input min-h-24" value={invoiceForm.notesHe ?? ""} onChange={(event) => updateInvoiceField("notesHe", event.target.value)} placeholder="הערה פנימית או הערת שירות ללקוח" />
        </Field>

        <div className="grid gap-3 rounded-xl bg-slate-900 p-4 text-white sm:grid-cols-2 md:grid-cols-4">
          <AmountTile label="סכום לפני מע״מ" value={currencyFormatter.format(totals.subtotalAmount)} />
          {!isPtur ? <AmountTile label="מע״מ" value={currencyFormatter.format(totals.vatAmount)} /> : null}
          <AmountTile label="סה״כ לתשלום" value={currencyFormatter.format(totals.totalAmount)} />
          <div className="flex items-end justify-end">
            <div className="w-full">
              <button className="w-full rounded-xl bg-white px-4 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-200 dark:bg-slate-200 dark:text-slate-900 dark:hover:bg-slate-300 disabled:opacity-60" disabled={savingInvoice || customers.length === 0}>
                {savingInvoice ? "שומר..." : editingDraftId ? `עדכון טיוטת ${selectedDocumentLabel}` : `שמירת טיוטת ${selectedDocumentLabel}`}
              </button>
              <p className="mt-1 text-center text-[10px] text-white/50">Ctrl+S</p>
            </div>
          </div>
        </div>
      </form>
    </Panel>
  );
}
