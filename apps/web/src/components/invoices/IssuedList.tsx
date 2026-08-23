import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { Mail, Printer, RotateCcw, FileX, Share2 } from "lucide-react";
import {
  getDocumentTypeLabel,
  getPaymentMethodLabel,
  DocumentStatus,
  DocumentType,
  type Customer,
  type DraftInvoice
} from "@invoice/shared";
import { formatDate, today } from "@/lib/format";
import { apiPost, apiFetch, invoicePrintUrl, API_URL } from "@/lib/api";
import { Panel } from "@/components/common/Panel";
import { Field } from "@/components/common/Field";
import { EmptyState } from "@/components/common/EmptyState";
import { SkeletonList } from "@/components/common/SkeletonList";

const ISSUED_PAGE_SIZE = 10;

export function IssuedList({
  issuedInvoices,
  setIssuedInvoices,
  customers,
  selectedDocumentType,
  selectedDocumentLabel,
  loading,
  issuedSearch,
  setIssuedSearch,
  issuedCustomerFilter,
  setIssuedCustomerFilter,
  issuedFromDate,
  setIssuedFromDate,
  issuedToDate,
  setIssuedToDate,
  issuedPage,
  setIssuedPage,
  duplicatingId,
  onDuplicate,
  currencyFormatter,
  toast,
  confirmAction,
  promptInput,
  onError,
  onRefresh
}: {
  issuedInvoices: DraftInvoice[];
  setIssuedInvoices: Dispatch<SetStateAction<DraftInvoice[]>>;
  customers: Customer[];
  selectedDocumentType: DocumentType;
  selectedDocumentLabel: string;
  loading: boolean;
  issuedSearch: string;
  setIssuedSearch: Dispatch<SetStateAction<string>>;
  issuedCustomerFilter: string;
  setIssuedCustomerFilter: Dispatch<SetStateAction<string>>;
  issuedFromDate: string;
  setIssuedFromDate: Dispatch<SetStateAction<string>>;
  issuedToDate: string;
  setIssuedToDate: Dispatch<SetStateAction<string>>;
  issuedPage: number;
  setIssuedPage: Dispatch<SetStateAction<number>>;
  duplicatingId: string | null;
  onDuplicate: (invoiceId: string) => Promise<void>;
  currencyFormatter: Intl.NumberFormat;
  toast: (message: string, type?: "info" | "success" | "error") => void;
  confirmAction: (message: string) => Promise<boolean>;
  promptInput: (label: string, defaultValue?: string) => Promise<string | null>;
  onError: (message: string | null) => void;
  onRefresh: () => Promise<void>;
}) {
  const [issuedSort, setIssuedSort] = useState("date-desc");
  const [markingPaidId, setMarkingPaidId] = useState<string | null>(null);
  const [whatsappShare, setWhatsappShare] = useState<
    | { invoiceId: string; status: "preparing" }
    | { invoiceId: string; status: "ready"; file: File }
    | null
  >(null);

  const filteredIssuedByType = useMemo(
    () => issuedInvoices.filter((inv) => inv.documentType === selectedDocumentType),
    [issuedInvoices, selectedDocumentType]
  );

  const filteredIssuedInvoices = useMemo(() => {
    const search = issuedSearch.trim().toLowerCase();
    return filteredIssuedByType
      .filter((invoice) => {
        if (issuedCustomerFilter && invoice.customerId !== issuedCustomerFilter) {
          return false;
        }

        if (issuedFromDate && invoice.issueDate < issuedFromDate) {
          return false;
        }

        if (issuedToDate && invoice.issueDate > issuedToDate) {
          return false;
        }

        if (!search) return true;
        const customer = customers.find((c) => c.id === invoice.customerId);
        return (
          customer?.displayNameHe.toLowerCase().includes(search) ||
          String(invoice.sequenceNumber ?? "").includes(search)
        );
      })
      .sort((a, b) => {
        if (issuedSort === "date-asc") return a.issueDate < b.issueDate ? -1 : 1;
        if (issuedSort === "amount-desc") return b.totalAmount - a.totalAmount;
        if (issuedSort === "amount-asc") return a.totalAmount - b.totalAmount;
        return a.issueDate < b.issueDate ? 1 : -1;
      });
  }, [filteredIssuedByType, issuedSearch, issuedCustomerFilter, issuedFromDate, issuedToDate, customers, issuedSort]);

  // Reset to page 1 whenever the filter set changes
  useEffect(() => {
    setIssuedPage(1);
  }, [issuedSearch, issuedCustomerFilter, issuedFromDate, issuedToDate, selectedDocumentType, setIssuedPage]);

  const issuedTotalPages = Math.max(1, Math.ceil(filteredIssuedInvoices.length / ISSUED_PAGE_SIZE));
  const issuedCurrentPage = Math.min(issuedPage, issuedTotalPages);
  const pagedIssuedInvoices = useMemo(
    () => filteredIssuedInvoices.slice((issuedCurrentPage - 1) * ISSUED_PAGE_SIZE, issuedCurrentPage * ISSUED_PAGE_SIZE),
    [filteredIssuedInvoices, issuedCurrentPage]
  );

  async function handleMarkPaid(invoiceId: string) {
    if (!await confirmAction("לסמן את המסמך כשולם במלואו?")) return;
    setMarkingPaidId(invoiceId);
    onError(null);
    try {
      await apiPost(`/v1/invoices/${invoiceId}/mark-paid`, undefined, "סימון כשולם נכשל");
      await onRefresh();
      toast("המסמך סומן כשולם", "success");
    } catch (e) {
      onError(e instanceof Error ? e.message : "סימון כשולם נכשל");
    } finally {
      setMarkingPaidId(null);
    }
  }

  function downloadAndOpenWhatsAppWeb(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    window.open("https://web.whatsapp.com", "_blank", "noopener,noreferrer");
  }

  // Opens the share modal and fetches the PDF (async — this is where the
  // click's user-activation window would expire if we tried to call
  // navigator.share() right after). If native file sharing isn't possible
  // at all, skip straight to the fallback instead of showing a "Send"
  // button that would never work.
  async function openWhatsAppShare(invoiceId: string) {
    setWhatsappShare({ invoiceId, status: "preparing" });
    let blob: Blob;
    let filename = `invoice-${invoiceId}.pdf`;
    try {
      const res = await apiFetch(`/v1/invoices/${invoiceId}/export-pdf`);
      if (!res.ok) { toast("שגיאה בייצוא PDF", "error"); setWhatsappShare(null); return; }
      blob = await res.blob();
      filename = res.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1] ?? filename;
    } catch {
      toast("שגיאת רשת — לא ניתן לייצא PDF", "error");
      setWhatsappShare(null);
      return;
    }

    const file = new File([blob], filename, { type: "application/pdf" });

    if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
      // Wait for a fresh click on the modal's "Send" button so the share()
      // call below still has valid user-activation, no matter how long the
      // PDF took to render.
      setWhatsappShare({ invoiceId, status: "ready", file });
    } else {
      downloadAndOpenWhatsAppWeb(blob, filename);
      setWhatsappShare(null);
    }
  }

  // Called synchronously from the modal's "Send" button click handler.
  async function sendWhatsAppShare(file: File) {
    try {
      await navigator.share({ files: [file], title: "חשבונית", text: "הינה החשבונית שלך" });
    } catch (err) {
      if (!(err instanceof Error && err.name === "AbortError")) {
        // share failed even with fresh activation — fall back to download.
        downloadAndOpenWhatsAppWeb(file, file.name);
      }
    } finally {
      setWhatsappShare(null);
    }
  }

  async function issueReturnNote(invoiceId: string) {
    if (!await confirmAction("האם ליצור תעודת החזרה עבור מסמך זה?")) return;
    try {
      const res = await apiFetch(`/v1/invoices/${invoiceId}/return-note`, { method: "POST" });
      const data = (await res.json()) as { id?: string; message?: string };
      if (res.ok) {
        setIssuedInvoices((prev) => [...prev, data as any]);
        toast("תעודת ההחזרה נוצרה בהצלחה", "success");
      } else {
        toast(data.message ?? "יצירת תעודת ההחזרה נכשלה", "error");
      }
    } catch {
      toast("שגיאת רשת — נסה שוב", "error");
    }
  }

  async function issueCreditNote(invoiceId: string) {
    if (!await confirmAction("האם ליצור תעודת זיכוי עבור מסמך זה?\nהמסמך המקורי יסומן כמבוטל.")) return;
    try {
      const res = await apiFetch(`/v1/invoices/${invoiceId}/credit-note`, { method: "POST" });
      const data = (await res.json()) as { id?: string; message?: string };
      if (res.ok) {
        setIssuedInvoices((prev) => [...prev, data as any]);
        setIssuedInvoices((prev) =>
          prev.map((inv) =>
            inv.id === invoiceId ? { ...inv, status: DocumentStatus.CANCELLED } : inv
          )
        );
        toast("תעודת הזיכוי נוצרה בהצלחה", "success");
      } else {
        toast(data.message ?? "יצירת תעודת הזיכוי נכשלה", "error");
      }
    } catch {
      toast("שגיאת רשת — נסה שוב", "error");
    }
  }

  async function sendInvoiceEmail(invoiceId: string, toEmail?: string) {
    try {
      const to = await promptInput("כתובת מייל לשליחה:", toEmail ?? "");
      if (!to?.trim()) return;
      const res = await apiFetch(`/v1/invoices/${invoiceId}/send-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: to.trim() })
      });
      const data = (await res.json()) as { ok?: boolean; to?: string; message?: string };
      if (res.ok) {
        toast(`המייל נשלח בהצלחה אל ${data.to}`, "success");
      } else {
        toast(data.message ?? "שליחת המייל נכשלה", "error");
      }
    } catch {
      toast("שגיאת רשת — נסה שוב", "error");
    }
  }

  function exportIssuedInvoicesCsv() {
    const params = new URLSearchParams();

    params.set("documentType", selectedDocumentType);

    if (issuedSearch.trim()) {
      params.set("search", issuedSearch.trim());
    }

    if (issuedCustomerFilter) {
      params.set("customerId", issuedCustomerFilter);
    }

    if (issuedFromDate) {
      params.set("fromDate", issuedFromDate);
    }

    if (issuedToDate) {
      params.set("toDate", issuedToDate);
    }

    const query = params.toString();
    const url = `${API_URL}/v1/invoices/issued/export-csv${query ? `?${query}` : ""}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <>
    <Panel id="issued-panel" title={`מסמכי ${selectedDocumentLabel} שהונפקו`} description="מסמכים סופיים עם מספר רץ ותצוגת הדפסה.">
      <div className="space-y-3">
        <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:grid-cols-2 xl:grid-cols-5">
          <Field label="חיפוש חופשי">
            <input
              className="input bg-white"
              value={issuedSearch}
              onChange={(event) => setIssuedSearch(event.target.value)}
              placeholder="לקוח או מספר מסמך"
              inputMode="search"
              enterKeyHint="search"
            />
          </Field>

          <Field label="לקוח">
            <select
              className="input bg-white"
              value={issuedCustomerFilter}
              onChange={(event) => setIssuedCustomerFilter(event.target.value)}
            >
              <option value="">כל הלקוחות</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>{customer.displayNameHe}</option>
              ))}
            </select>
          </Field>

          <Field label="מתאריך">
            <input
              className="input bg-white"
              type="date"
              value={issuedFromDate}
              onChange={(event) => setIssuedFromDate(event.target.value)}
            />
          </Field>

          <Field label="עד תאריך">
            <input
              className="input bg-white"
              type="date"
              value={issuedToDate}
              onChange={(event) => setIssuedToDate(event.target.value)}
            />
          </Field>

          <Field label="מיון">
            <select className="input bg-white" value={issuedSort} onChange={(e) => setIssuedSort(e.target.value)}>
              <option value="date-desc">תאריך — חדש לישן</option>
              <option value="date-asc">תאריך — ישן לחדש</option>
              <option value="amount-desc">סכום — גבוה לנמוך</option>
              <option value="amount-asc">סכום — נמוך לגבוה</option>
            </select>
          </Field>

          <div className="flex gap-2 sm:col-span-2 xl:col-span-1">
            <button
              className="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
              onClick={() => {
                setIssuedSearch("");
                setIssuedCustomerFilter("");
                setIssuedFromDate("");
                setIssuedToDate("");
              }}
            >
              ניקוי סינון
            </button>
            <button
              className="flex-1 rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700"
              onClick={exportIssuedInvoicesCsv}
            >
              ייצוא CSV
            </button>
          </div>
        </div>

        <div className="max-h-[28rem] space-y-3 overflow-y-auto">
        {loading ? <SkeletonList rows={3} /> : null}
        {!loading && filteredIssuedByType.length === 0 ? (
          <EmptyState text={`עדיין לא הונפקו ${selectedDocumentLabel}.`} />
        ) : null}
        {!loading && filteredIssuedByType.length > 0 && filteredIssuedInvoices.length === 0 ? (
          <EmptyState text="לא נמצאו מסמכים לפי הסינון שנבחר." />
        ) : null}
        {pagedIssuedInvoices.map((invoice) => {
          const customer = customers.find((item) => item.id === invoice.customerId);
          const isReceiptType = invoice.documentType === DocumentType.RECEIPT || invoice.documentType === DocumentType.INVOICE_RECEIPT;
          const isOverdue =
            !isReceiptType &&
            (invoice.status === DocumentStatus.ISSUED || invoice.status === DocumentStatus.PARTIALLY_PAID) &&
            invoice.dueDate != null &&
            invoice.dueDate < today;
          const badgeClass =
            invoice.status === DocumentStatus.CANCELLED ? "bg-slate-100 text-slate-600" :
            invoice.status === DocumentStatus.PAID ? "bg-emerald-100 text-emerald-700" :
            invoice.status === DocumentStatus.PARTIALLY_PAID ? "bg-orange-100 text-orange-700" :
            isOverdue ? "bg-rose-100 text-rose-700" :
            "bg-blue-100 text-blue-700";
          const badgeLabel =
            invoice.status === DocumentStatus.CANCELLED ? "בוטל" :
            invoice.status === DocumentStatus.PAID ? "שולם" :
            invoice.status === DocumentStatus.PARTIALLY_PAID ? "שולם חלקית" :
            isOverdue ? "באיחור" :
            "הונפק";

          return (
            <article key={invoice.id} className={`rounded-xl border p-3 ${isOverdue ? "border-rose-200 bg-rose-50/30" : "border-slate-200"}`}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="font-medium">{customer?.displayNameHe ?? "לקוח לא ידוע"}</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    {invoice.sequenceNumber ? `מס׳ ${invoice.sequenceNumber} • ` : ""}
                    {formatDate(invoice.issueDate)} • {getDocumentTypeLabel(invoice.documentType)}
                    {invoice.dueDate && invoice.status !== DocumentStatus.PAID && invoice.status !== DocumentStatus.CANCELLED ? ` • לתשלום: ${formatDate(invoice.dueDate)}` : ""}
                  </p>
                  {invoice.payment?.method ? (
                    <p className="mt-1 text-xs text-slate-500">אמצעי תשלום: {getPaymentMethodLabel(invoice.payment.method)}</p>
                  ) : null}
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-medium ${badgeClass}`}>{badgeLabel}</span>
              </div>
              <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
                <span>{invoice.balanceDue > 0 && invoice.balanceDue < invoice.totalAmount ? "יתרה לתשלום" : "סה״כ"}</span>
                <strong className="text-base text-slate-900">
                  {invoice.balanceDue > 0 && invoice.balanceDue < invoice.totalAmount
                    ? `${currencyFormatter.format(invoice.balanceDue)} / ${currencyFormatter.format(invoice.totalAmount)}`
                    : currencyFormatter.format(invoice.totalAmount)}
                </strong>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  className="flex items-center gap-1.5 rounded-xl border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  onClick={() => window.open(invoicePrintUrl(invoice.id), "_blank", "noopener,noreferrer")}
                >
                  <Printer className="h-3.5 w-3.5" />
                  הדפסה
                </button>
                <button
                  className="flex items-center gap-1.5 rounded-xl border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                  onClick={() => onDuplicate(invoice.id)}
                  disabled={duplicatingId === invoice.id}
                >
                  {duplicatingId === invoice.id ? "משכפל..." : "שכפל"}
                </button>
                <button
                  className="flex items-center gap-1.5 rounded-xl border border-blue-300 bg-blue-50 px-3 py-2 text-xs font-medium text-blue-700 hover:bg-blue-100"
                  onClick={() => sendInvoiceEmail(invoice.id, customer?.email || undefined)}
                >
                  <Mail className="h-3.5 w-3.5" />
                  שלח במייל
                </button>
                {isOverdue && customer?.email ? (
                  <a
                    href={`mailto:${customer.email}?subject=${encodeURIComponent(`תזכורת תשלום — מסמך ${invoice.sequenceNumber ?? ""}`)}&body=${encodeURIComponent(`שלום ${customer.displayNameHe},\n\nמסמך מספר ${invoice.sequenceNumber ?? ""} על סך ${currencyFormatter.format(invoice.balanceDue)} טרם שולם.\nתאריך פירעון: ${formatDate(invoice.dueDate ?? "")}.\n\nנשמח לקבל את התשלום בהקדם.\n\nבברכה`)}`}
                    className="flex items-center gap-1.5 rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 hover:bg-rose-100"
                  >
                    <Mail className="h-3.5 w-3.5" />
                    תזכורת חוב
                  </a>
                ) : null}
                <button
                  className="flex items-center gap-1.5 rounded-xl border border-green-300 bg-green-50 px-3 py-2 text-xs font-medium text-green-700 hover:bg-green-100"
                  title="מייצא PDF ושולח דרך WhatsApp (במחשב — הקובץ יורד, ולאחר מכן יפתח WhatsApp Web לצירוף ידני)"
                  onClick={() => openWhatsAppShare(invoice.id)}
                >
                  <Share2 className="h-3.5 w-3.5" />
                  WhatsApp
                </button>
                {invoice.status !== DocumentStatus.CANCELLED &&
                  invoice.documentType !== DocumentType.CREDIT_NOTE &&
                  invoice.documentType !== DocumentType.RETURN_NOTE ? (
                  <button
                    className="flex items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700 hover:bg-amber-100"
                    onClick={() => issueReturnNote(invoice.id)}
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    החזרה
                  </button>
                ) : null}
                {invoice.status !== DocumentStatus.CANCELLED &&
                  invoice.documentType !== DocumentType.CREDIT_NOTE &&
                  invoice.documentType !== DocumentType.RETURN_NOTE &&
                  invoice.documentType !== DocumentType.RECEIPT ? (
                  <button
                    className="flex items-center gap-1.5 rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-100"
                    onClick={() => issueCreditNote(invoice.id)}
                  >
                    <FileX className="h-3.5 w-3.5" />
                    זיכוי
                  </button>
                ) : null}
                {invoice.status !== DocumentStatus.CANCELLED &&
                  invoice.status !== DocumentStatus.PAID &&
                  invoice.documentType !== DocumentType.CREDIT_NOTE &&
                  invoice.documentType !== DocumentType.RETURN_NOTE &&
                  invoice.documentType !== DocumentType.RECEIPT &&
                  invoice.documentType !== DocumentType.INVOICE_RECEIPT ? (
                  <button
                    className="flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-60"
                    onClick={() => handleMarkPaid(invoice.id)}
                    disabled={markingPaidId === invoice.id}
                  >
                    {markingPaidId === invoice.id ? "מעדכן..." : "שולם"}
                  </button>
                ) : null}
              </div>
            </article>
          );
        })}

        {filteredIssuedInvoices.length > ISSUED_PAGE_SIZE ? (
          <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900">
            <button
              type="button"
              className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-white disabled:opacity-40 dark:border-slate-600 dark:text-slate-200"
              onClick={() => setIssuedPage((p) => Math.max(1, p - 1))}
              disabled={issuedCurrentPage <= 1}
            >
              הקודם
            </button>
            <span className="text-xs text-slate-500">
              עמוד {issuedCurrentPage} מתוך {issuedTotalPages} ({filteredIssuedInvoices.length} מסמכים)
            </span>
            <button
              type="button"
              className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-white disabled:opacity-40 dark:border-slate-600 dark:text-slate-200"
              onClick={() => setIssuedPage((p) => Math.min(issuedTotalPages, p + 1))}
              disabled={issuedCurrentPage >= issuedTotalPages}
            >
              הבא
            </button>
          </div>
        ) : null}
        </div>{/* end scrollable list */}
      </div>
    </Panel>

    {whatsappShare ? (
      <div
        className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/60 px-4"
        onClick={() => setWhatsappShare(null)}
      >
        <div
          className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-2xl dark:bg-slate-800"
          onClick={(e) => e.stopPropagation()}
        >
          {whatsappShare.status === "preparing" ? (
            <>
              <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-emerald-600" />
              <p className="text-sm text-slate-600 dark:text-slate-300">מכין את הקובץ לשליחה...</p>
            </>
          ) : (
            <>
              <Share2 className="mx-auto mb-3 h-8 w-8 text-emerald-600" />
              <p className="mb-4 text-sm text-slate-600 dark:text-slate-300">הקובץ מוכן לשליחה</p>
              <button
                className="w-full rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
                onClick={() => sendWhatsAppShare(whatsappShare.file)}
              >
                שליחה
              </button>
            </>
          )}
          <button
            className="mt-3 w-full rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200"
            onClick={() => setWhatsappShare(null)}
          >
            ביטול
          </button>
        </div>
      </div>
    ) : null}
    </>
  );
}
