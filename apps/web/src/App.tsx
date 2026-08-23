import { useEffect, Fragment, useMemo, useState, useCallback } from "react";
import type { FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { Building2, FilePlus2, LogOut, Moon, ReceiptText, Search, Sun, X, Users } from "lucide-react";
import {
  BusinessTaxProfile,
  DocumentType,
  DocumentStatus,
  PaymentMethod,
  type BusinessSettings,
  type CreateCustomerInput,
  type CreateDraftInvoiceInput,
  type Customer,
  type DraftInvoice
} from "@invoice/shared";

import { API_URL } from "@/lib/api";
import { currencyFormatter, today } from "@/lib/format";
import {
  emptyCustomerForm,
  emptyInvoiceLine,
  defaultBusinessSettings,
  type ExpenseItem,
  type ServiceItem,
  type QuoteFormState,
  emptyQuoteForm,
  type WorkspaceTab,
  type ReceiptPaymentFormState,
  emptyReceiptPaymentForm,
  getTabDocumentType,
  getTabLabel
} from "@/types/workspace";
import { StatCard } from "@/components/common/StatCard";
import { Panel } from "@/components/common/Panel";
import { ToastStack } from "@/components/common/ToastStack";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { PromptDialog } from "@/components/common/PromptDialog";
import { ReportsPanel } from "@/components/reports/ReportsPanel";
import { BusinessSettingsDrawer } from "@/components/settings/BusinessSettingsDrawer";
import { UserSettingsDrawer } from "@/components/settings/UserSettingsDrawer";
import { CustomersSection } from "@/components/customers/CustomersSection";
import { QuickCreateCustomerModal } from "@/components/customers/QuickCreateCustomerModal";
import { InvoiceWorkspace } from "@/components/invoices/InvoiceWorkspace";
import { GlobalSearchModal } from "@/components/invoices/GlobalSearchModal";
import { useToasts } from "@/hooks/useToasts";
import { useDialogs } from "@/hooks/useDialogs";
import { useDarkMode } from "@/hooks/useDarkMode";

function App({ user, onLogout }: { user: { displayName: string; email: string }; onLogout: () => void }) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [draftInvoices, setDraftInvoices] = useState<DraftInvoice[]>([]);
  const [issuedInvoices, setIssuedInvoices] = useState<DraftInvoice[]>([]);
  const [customerForm, setCustomerForm] = useState<CreateCustomerInput>(emptyCustomerForm);
  const [businessSettings, setBusinessSettings] = useState<BusinessSettings>(defaultBusinessSettings);

  const [searchParams, setSearchParams] = useSearchParams();
  const selectedTab = (searchParams.get("tab") as WorkspaceTab) ?? DocumentType.TAX_INVOICE;
  const setSelectedTab = useCallback((tab: WorkspaceTab) => {
    setSearchParams((prev) => { const next = new URLSearchParams(prev); next.set("tab", tab); return next; }, { replace: false });
  }, [setSearchParams]);

  const [activeDrawer, setActiveDrawer] = useState<"business" | "user" | null>(null);

  const [invoiceForm, setInvoiceForm] = useState<CreateDraftInvoiceInput>({
    customerId: "",
    documentType: DocumentType.TAX_INVOICE,
    issueDate: today,
    dueDate: today,
    notesHe: "",
    lines: [{ ...emptyInvoiceLine }]
  });
  // Tracks whether the user has actually edited the invoice form, as opposed
  // to it merely holding the auto-filled default customer (see loadData) —
  // only genuine edits should trigger the "unsaved changes" tab-switch guard.
  const [invoiceFormTouched, setInvoiceFormTouched] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savingCustomer, setSavingCustomer] = useState(false);
  const [editingCustomerId, setEditingCustomerId] = useState<string | null>(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const [issuedSearch, setIssuedSearch] = useState("");
  const [draftSearch, setDraftSearch] = useState("");
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const [issuedCustomerFilter, setIssuedCustomerFilter] = useState("");
  const [issuedFromDate, setIssuedFromDate] = useState("");
  const [issuedToDate, setIssuedToDate] = useState("");
  const [issuedPage, setIssuedPage] = useState(1);
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [quoteForm, setQuoteForm] = useState<QuoteFormState>(emptyQuoteForm());
  const [receiptPaymentForm, setReceiptPaymentForm] = useState<ReceiptPaymentFormState>(emptyReceiptPaymentForm);
  const [demoDocs, setDemoDocs] = useState<DraftInvoice[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [serviceItems, setServiceItems] = useState<ServiceItem[]>([]);
  const [newServiceItemName, setNewServiceItemName] = useState("");
  const [newServiceItemPrice, setNewServiceItemPrice] = useState("");

  const { darkMode, setDarkMode } = useDarkMode();
  const [settingsBannerDismissed, setSettingsBannerDismissed] = useState(() => !!localStorage.getItem("settings-banner-dismissed"));

  // Quick-create customer modal
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);
  const [quickCreateName, setQuickCreateName] = useState("");
  const [quickCreatePhone, setQuickCreatePhone] = useState("");
  const [quickCreateEmail, setQuickCreateEmail] = useState("");
  const [savingQuickCreate, setSavingQuickCreate] = useState(false);

  // Global search
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false);
  const [globalSearchQuery, setGlobalSearchQuery] = useState("");

  // ── Ctrl+S shortcut — submit the active invoice form ─────────
  // ── Ctrl+K — open global search ──────────────────────────────
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        const form = document.getElementById("invoice-form-panel")?.querySelector("form");
        if (form) form.requestSubmit();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setGlobalSearchOpen((prev) => !prev);
        setGlobalSearchQuery("");
      }
      if (e.key === "Escape") {
        setGlobalSearchOpen(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // ── Auto-fill due date from customer payment terms ────────────
  useEffect(() => {
    if (!invoiceForm.customerId || editingDraftId) return;
    const customer = customers.find((c) => c.id === invoiceForm.customerId);
    if (!customer || customer.paymentTermsDays === 0) return;
    const issue = new Date(invoiceForm.issueDate);
    issue.setDate(issue.getDate() + customer.paymentTermsDays);
    setInvoiceForm((curr) => ({ ...curr, dueDate: issue.toISOString().slice(0, 10) }));
  }, [invoiceForm.customerId, invoiceForm.issueDate]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-save draft form to localStorage ─────────────────────
  const LS_KEY = "invoice-form-autosave";
  useEffect(() => {
    if (!invoiceFormTouched) return;
    try { localStorage.setItem(LS_KEY, JSON.stringify({ form: invoiceForm, tab: selectedTab })); } catch { /* ignore */ }
  }, [invoiceForm, invoiceFormTouched, selectedTab]);
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LS_KEY);
      if (!saved) return;
      const { form, tab } = JSON.parse(saved) as { form: typeof invoiceForm; tab: WorkspaceTab };
      if (form.customerId || form.lines.some((l: { descriptionHe: string }) => l.descriptionHe)) {
        setInvoiceForm(form);
        setInvoiceFormTouched(true);
        setSelectedTab(tab);
      }
    } catch { /* ignore */ }
  // Only run once on mount
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Toasts + dialogs ─────────────────────────────────────────
  const { toasts, toast, dismissToast } = useToasts();
  const {
    confirmDialog,
    confirmAction,
    resolveConfirm,
    promptDialog,
    promptValue,
    setPromptValue,
    promptInput,
    resolvePrompt
  } = useDialogs();

  const selectedDocumentType = getTabDocumentType(selectedTab);
  const isPtur = businessSettings.taxProfile === BusinessTaxProfile.PTUR;
  const selectedDocumentLabel = getTabLabel(selectedTab);

  const globalSearchResults = useMemo(() => {
    const q = globalSearchQuery.trim().toLowerCase();
    if (!q) return { customers: [], drafts: [], issued: [] };
    const matchCustomers = customers.filter((c) =>
      c.displayNameHe.toLowerCase().includes(q) ||
      (c.taxId ?? "").includes(q) ||
      (c.phone ?? "").includes(q) ||
      (c.email ?? "").toLowerCase().includes(q)
    ).slice(0, 5);
    const matchDrafts = draftInvoices.filter((inv) => {
      const cust = customers.find((c) => c.id === inv.customerId);
      return (cust?.displayNameHe ?? "").toLowerCase().includes(q) ||
        (inv.notesHe ?? "").toLowerCase().includes(q);
    }).slice(0, 5);
    const matchIssued = [...issuedInvoices, ...demoDocs].filter((inv) => {
      const cust = customers.find((c) => c.id === inv.customerId);
      return (cust?.displayNameHe ?? "").toLowerCase().includes(q) ||
        String(inv.sequenceNumber ?? "").toLowerCase().includes(q) ||
        (inv.notesHe ?? "").toLowerCase().includes(q);
    }).slice(0, 5);
    return { customers: matchCustomers, drafts: matchDrafts, issued: matchIssued };
  }, [globalSearchQuery, customers, draftInvoices, issuedInvoices, demoDocs]);

  useEffect(() => {
    void loadData();
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("invoice-service-items");
      if (!raw) return;
      const parsed = JSON.parse(raw) as ServiceItem[];
      if (Array.isArray(parsed)) setServiceItems(parsed);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    localStorage.setItem("invoice-service-items", JSON.stringify(serviceItems));
  }, [serviceItems]);

  useEffect(() => {
    if (isPtur) {
      setInvoiceForm((current) => ({
        ...current,
        lines: current.lines.map((line) => ({ ...line, vatRate: 0 }))
      }));
      // Reset to a valid tab for ptur if currently on a murshe-only tab
      const pturInvalidTabs: WorkspaceTab[] = [DocumentType.TAX_INVOICE, DocumentType.INVOICE_RECEIPT, "QUOTE"];
      if (pturInvalidTabs.includes(selectedTab)) {
        setSelectedTab(DocumentType.RECEIPT);
      }
    }
  }, [isPtur]);

  async function loadData() {
    setLoading(true);
    setError(null);

    try {
      const checkJson = (res: Response, name: string) => {
        const ct = res.headers.get("content-type") ?? "";
        if (!ct.includes("application/json")) {
          throw new Error(`כתובת ה-API שגויה — ${name} החזיר HTML במקום JSON. בדקו ש-VITE_API_URL מצביע על שירות ה-API ולא על האתר.`);
        }
      };

      const [customersResponse, draftsResponse, issuedResponse, businessSettingsResponse, expensesResponse] = await Promise.all([
        fetch(`${API_URL}/v1/customers`, { credentials: "include" }),
        fetch(`${API_URL}/v1/invoices/drafts`, { credentials: "include" }),
        fetch(`${API_URL}/v1/invoices/issued`, { credentials: "include" }),
        fetch(`${API_URL}/v1/business/settings`, { credentials: "include" }),
        fetch(`${API_URL}/v1/expenses`, { credentials: "include" }),
      ]);

      checkJson(customersResponse, "customers");
      checkJson(draftsResponse, "drafts");
      checkJson(issuedResponse, "issued");
      checkJson(businessSettingsResponse, "business/settings");

      if (!customersResponse.ok || !draftsResponse.ok || !issuedResponse.ok || !businessSettingsResponse.ok) {
        // If HTML is returned it means CORS is blocking or the API URL is wrong
        const ct = customersResponse.headers.get("content-type") ?? "";
        if (!ct.includes("application/json")) {
          throw new Error(`שגיאת CORS או כתובת API שגויה (${customersResponse.status})`);
        }
        throw new Error("טעינת הנתונים נכשלה");
      }

      const customersJson = (await customersResponse.json()) as { items: Customer[] };
      const draftsJson = (await draftsResponse.json()) as { items: DraftInvoice[] };
      const issuedJson = (await issuedResponse.json()) as { items: DraftInvoice[] };
      const businessSettingsJson = (await businessSettingsResponse.json()) as BusinessSettings;
      const expensesJson = expensesResponse.ok ? (await expensesResponse.json()) as { items: ExpenseItem[] } : { items: [] };

      setCustomers(customersJson.items);
      setDraftInvoices(draftsJson.items);
      setIssuedInvoices(issuedJson.items);
      setBusinessSettings(businessSettingsJson);
      setExpenses(expensesJson.items);
      setInvoiceForm((current) => ({
        ...current,
        customerId: current.customerId || customersJson.items[0]?.id || ""
      }));
      setQuoteForm((current) => ({
        ...current,
        customerId: current.customerId || customersJson.items[0]?.id || ""
      }));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "שגיאה לא צפויה");
    } finally {
      setLoading(false);
    }
  }

  function updateCustomerField<Key extends keyof CreateCustomerInput>(key: Key, value: CreateCustomerInput[Key]) {
    setCustomerForm((current) => ({ ...current, [key]: value }));
  }

  async function handleCustomerSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingCustomer(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/v1/customers`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(customerForm)
      });

      if (!response.ok) {
        const payload = (await response.json()) as { message?: string };
        throw new Error(payload.message ?? "שמירת הלקוח נכשלה");
      }

      const createdCustomer = (await response.json()) as Customer;
      setCustomerForm(emptyCustomerForm);
      setInvoiceForm((current) => ({
        ...current,
        customerId: current.customerId || createdCustomer.id
      }));
      setQuoteForm((current) => ({
        ...current,
        customerId: current.customerId || createdCustomer.id
      }));
      await loadData();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "שמירת הלקוח נכשלה");
    } finally {
      setSavingCustomer(false);
    }
  }

  async function handleCustomerUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingCustomerId) return;
    setSavingCustomer(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/v1/customers/${editingCustomerId}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(customerForm)
      });
      if (!response.ok) {
        const payload = (await response.json()) as { message?: string };
        throw new Error(payload.message ?? "עדכון הלקוח נכשל");
      }
      setEditingCustomerId(null);
      setCustomerForm(emptyCustomerForm);
      await loadData();
      toast("הלקוח עודכן בהצלחה", "success");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "עדכון הלקוח נכשל");
    } finally {
      setSavingCustomer(false);
    }
  }

  function loadTempDemoData() {
    const now = new Date();
    const firstCustomerId = customers[0]?.id || "demo-customer-1";

    const demoDocs: DraftInvoice[] = Array.from({ length: 6 }, (_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth() - index, 14);
      const monthShift = 5 - index;
      const amount = 4500 + monthShift * 780;

      return {
        id: `demo-doc-${date.toISOString().slice(0, 7)}`,
        customerId: firstCustomerId,
        issueDate: date.toISOString().slice(0, 10),
        dueDate: date.toISOString().slice(0, 10),
        currency: "ILS",
        status: "ISSUED" as DocumentStatus,
        documentType: DocumentType.RECEIPT,
        sequenceNumber: 100 + index,
        notesHe: "דוגמה זמנית",
        payment: {
          method: PaymentMethod.CASH,
          details: {}
        },
        subtotalAmount: amount / 1.17,
        vatAmount: amount - amount / 1.17,
        totalAmount: amount,
        balanceDue: 0,
        issuedAt: date.toISOString(),
        createdAt: date.toISOString(),
        lines: [
          {
            descriptionHe: "שירותים דוגמה",
            quantity: 1,
            unitPrice: amount / 1.17,
            vatRate: 17,
            lineSubtotal: amount / 1.17,
            lineVatAmount: amount - amount / 1.17,
            lineTotal: amount
          }
        ]
      } satisfies DraftInvoice;
    });

    setDemoDocs(demoDocs);
  }

  function clearTempDemoData() {
    setDemoDocs([]);
  }

  function handleEditDraft(invoice: DraftInvoice) {
    setEditingDraftId(invoice.id);
    setSelectedTab(invoice.documentType as WorkspaceTab);
    setInvoiceForm({
      customerId: invoice.customerId,
      documentType: invoice.documentType,
      issueDate: invoice.issueDate,
      dueDate: invoice.dueDate ?? today,
      notesHe: invoice.notesHe ?? "",
      lines: invoice.lines.map((l) => ({
        descriptionHe: l.descriptionHe,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        vatRate: l.vatRate
      }))
    });
    if (invoice.payment) {
      const det = (invoice.payment.details ?? {}) as Record<string, unknown>;
      setReceiptPaymentForm({
        ...emptyReceiptPaymentForm,
        method: invoice.payment.method,
        checkNumber: String(det.checkNumber ?? ""),
        checkDueDate: String(det.checkDueDate ?? ""),
        bankName: String(det.bankName ?? ""),
        transferReference: String(det.transferReference ?? ""),
        otherDescription: String(det.otherDescription ?? "")
      });
    }
    // Scroll the form into view
    document.getElementById("invoice-form-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function handleDuplicate(invoiceId: string) {
    setDuplicatingId(invoiceId);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/v1/invoices/${invoiceId}/duplicate`, {
        method: "POST",
        credentials: "include"
      });
      if (!response.ok) {
        const payload = (await response.json()) as { message?: string };
        throw new Error(payload.message ?? "שכפול המסמך נכשל");
      }
      await loadData();
      toast("טיוטה חדשה נוצרה מהמסמך", "success");
    } catch (e) {
      setError(e instanceof Error ? e.message : "שכפול המסמך נכשל");
    } finally {
      setDuplicatingId(null);
    }
  }

  async function handleQuickCreateCustomer() {
    if (!quickCreateName.trim()) return;
    setSavingQuickCreate(true);
    try {
      const response = await fetch(`${API_URL}/v1/customers`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayNameHe: quickCreateName.trim(), type: "PRIVATE", email: quickCreateEmail.trim(), phone: quickCreatePhone.trim(), paymentTermsDays: 0 })
      });
      if (!response.ok) throw new Error("יצירת לקוח נכשלה");
      const created = (await response.json()) as Customer;
      await loadData();
      setInvoiceForm((f) => ({ ...f, customerId: created.id }));
      setQuickCreateOpen(false);
      setQuickCreateName(""); setQuickCreatePhone(""); setQuickCreateEmail("");
      toast(`הלקוח "${created.displayNameHe}" נוצר ונבחר`, "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "יצירת לקוח נכשלה", "error");
    } finally {
      setSavingQuickCreate(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-slate-100" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      <div className="mx-auto max-w-7xl overflow-x-hidden px-3 py-4 sm:px-6 md:px-10 md:py-8" style={{ paddingTop: "max(1rem, env(safe-area-inset-top))" }}>
        <header className="mb-4 rounded-[20px] bg-slate-900 p-4 text-white shadow-lg shadow-slate-200 sm:rounded-[28px] sm:p-5 md:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="space-y-1.5">
              <p className="text-xs text-slate-400 sm:text-sm sm:text-slate-300">מערכת הנהלת חשבונות ישראלית</p>
              <h1 className="text-xl font-semibold leading-snug sm:text-2xl md:text-3xl">פאנל תפעול מהיר לעוסק פטור ולעוסק מורשה</h1>
            </div>

            <div className="grid grid-cols-3 gap-2 md:gap-3">
              <StatCard icon={<Users className="h-5 w-5" />} label="לקוחות פעילים" value={loading ? "—" : String(customers.length)} />
              <StatCard icon={<FilePlus2 className="h-5 w-5" />} label="סה״כ טיוטות" value={loading ? "—" : String(draftInvoices.length)} />
              <StatCard icon={<ReceiptText className="h-5 w-5" />} label="סה״כ מסמכים שהונפקו" value={loading ? "—" : String(issuedInvoices.length)} />
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
            <span className="me-auto text-sm text-slate-400">{user.displayName}</span>
            <button
              className={`flex items-center gap-1.5 rounded-xl p-2 text-white transition sm:px-3 sm:py-1.5 ${activeDrawer === "business" ? "bg-white/25 ring-1 ring-white/40" : "bg-white/10 hover:bg-white/20"}`}
              onClick={() => setActiveDrawer((d) => d === "business" ? null : "business")}
              aria-label="הגדרות עסק"
            >
              <Building2 className="h-4 w-4" />
              <span className="hidden text-sm font-medium sm:inline">הגדרות עסק</span>
            </button>
            <button
              className={`flex items-center gap-1.5 rounded-xl p-2 text-white transition sm:px-3 sm:py-1.5 ${activeDrawer === "user" ? "bg-white/25 ring-1 ring-white/40" : "bg-white/10 hover:bg-white/20"}`}
              onClick={() => setActiveDrawer((d) => d === "user" ? null : "user")}
              aria-label="הגדרות משתמש"
            >
              <Users className="h-4 w-4" />
              <span className="hidden text-sm font-medium sm:inline">הגדרות משתמש</span>
            </button>
            <button
              className="flex items-center gap-1.5 rounded-xl border border-white/20 px-2 py-2 text-white hover:bg-white/10"
              onClick={() => { setGlobalSearchOpen(true); setGlobalSearchQuery(""); }}
              aria-label="חיפוש גלובלי (Ctrl+K)"
              title="חיפוש גלובלי (Ctrl+K)"
            >
              <Search className="h-4 w-4" />
              <span className="hidden rounded bg-white/20 px-1 py-0.5 text-[10px] font-mono sm:inline">Ctrl+K</span>
            </button>
            <button
              className="rounded-xl border border-white/20 p-2 text-white hover:bg-white/10"
              onClick={() => setDarkMode((d) => !d)}
              aria-label={darkMode ? "עבור למצב בהיר" : "עבור למצב כהה"}
            >
              {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <div className="mx-1 h-6 w-px shrink-0 bg-white/20" />
            <button
              className="flex items-center gap-1.5 rounded-xl border border-rose-400/50 bg-rose-500/20 p-2 text-rose-200 hover:bg-rose-500/30 sm:px-3 sm:py-1.5"
              onClick={onLogout}
              aria-label="יציאה"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden text-sm font-medium sm:inline">יציאה</span>
            </button>
          </div>
        </header>

        {/* Document Type Tabs */}
        <nav className="sticky top-0 z-20 mb-6 flex gap-0 overflow-x-auto border-b border-slate-200 bg-white px-4 py-0 dark:border-slate-700 dark:bg-slate-900 sm:px-6">
          {(isPtur
            ? [DocumentType.RECEIPT, DocumentType.PROFORMA, DocumentType.RETURN_NOTE, "REPORTS"] as WorkspaceTab[]
            : [DocumentType.TAX_INVOICE, DocumentType.RECEIPT, DocumentType.INVOICE_RECEIPT, DocumentType.PROFORMA, DocumentType.RETURN_NOTE, "QUOTE", "REPORTS"] as WorkspaceTab[]
          ).map((tab) => (
            <Fragment key={tab}>
              {tab === "REPORTS" ? (
                <div className="my-auto mx-2 h-5 w-px shrink-0 bg-slate-200 dark:bg-slate-700" />
              ) : null}
              <button
                onClick={async () => {
                  if (invoiceFormTouched && tab !== selectedTab && !editingDraftId) {
                    const ok = await confirmAction("יש נתונים לא שמורים בטופס. לעבור לטאב בלי לשמור?");
                    if (!ok) return;
                  }
                  setSelectedTab(tab);
                  if (tab !== "QUOTE" && tab !== "REPORTS" && tab !== DocumentType.RETURN_NOTE) {
                    setInvoiceForm((current) => ({ ...current, documentType: tab as DocumentType }));
                  }
                }}
                className={`px-3 py-3 text-xs font-medium border-b-2 transition-colors whitespace-nowrap sm:py-2 sm:text-sm ${
                  selectedTab === tab
                    ? "border-slate-900 text-slate-900 dark:border-slate-100 dark:text-slate-100"
                    : "border-transparent text-slate-500 hover:text-slate-900"
                }`}
              >
                {getTabLabel(tab)}
              </button>
            </Fragment>
          ))}
        </nav>

        {/* Incomplete business settings banner */}
        {!loading && !settingsBannerDismissed && (!businessSettings.nameHe || !businessSettings.taxId || !businessSettings.addressHe) ? (
          <div className="mx-4 mb-4 flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm sm:mx-6">
            <span className="text-amber-800">⚠️ טרם הוגדרו פרטי העסק — מלאו שם עסק, מספר עוסק וכתובת כדי שיופיעו על המסמכים.</span>
            <div className="flex shrink-0 gap-2">
              <button
                className="rounded-lg border border-amber-300 bg-white px-3 py-1 text-xs font-medium text-amber-800 hover:bg-amber-100"
                onClick={() => setActiveDrawer("business")}
              >הגדרות עסק</button>
              <button
                className="rounded-lg p-1 text-amber-600 hover:text-amber-900"
                onClick={() => { setSettingsBannerDismissed(true); localStorage.setItem("settings-banner-dismissed", "1"); }}
                aria-label="סגור"
              ><X className="h-4 w-4" /></button>
            </div>
          </div>
        ) : null}

        {activeDrawer !== null ? (
          <div className="backdrop-fade-in fixed inset-0 z-40 bg-slate-900/50" onClick={() => setActiveDrawer(null)} />
        ) : null}

        {activeDrawer === "business" ? (
          <BusinessSettingsDrawer
            businessSettings={businessSettings}
            setBusinessSettings={setBusinessSettings}
            serviceItems={serviceItems}
            setServiceItems={setServiceItems}
            newServiceItemName={newServiceItemName}
            setNewServiceItemName={setNewServiceItemName}
            newServiceItemPrice={newServiceItemPrice}
            setNewServiceItemPrice={setNewServiceItemPrice}
            onClose={() => setActiveDrawer(null)}
            onError={setError}
          />
        ) : null}

        {activeDrawer === "user" ? (
          <UserSettingsDrawer
            onClose={() => setActiveDrawer(null)}
            toast={toast}
            confirmAction={confirmAction}
            onRefresh={loadData}
          />
        ) : null}

        {error ? (
          <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
        ) : null}



        <section className="grid min-w-0 gap-5 xl:grid-cols-[1.1fr_1.4fr]">
          <CustomersSection
            customers={customers}
            issuedInvoices={issuedInvoices}
            demoDocs={demoDocs}
            loading={loading}
            customerForm={customerForm}
            setCustomerForm={setCustomerForm}
            updateCustomerField={updateCustomerField}
            editingCustomerId={editingCustomerId}
            setEditingCustomerId={setEditingCustomerId}
            savingCustomer={savingCustomer}
            handleCustomerSubmit={handleCustomerSubmit}
            handleCustomerUpdate={handleCustomerUpdate}
            currencyFormatter={currencyFormatter}
            customerSearch={customerSearch}
            setCustomerSearch={setCustomerSearch}
          />

          <div className="min-w-0 space-y-6">
            {selectedTab === "REPORTS" ? (
              <Panel title='דו"חות' description="ניתוח פיננסי מפורט של פעילות העסק.">
                <ReportsPanel
                  issuedInvoices={issuedInvoices}
                  expenses={expenses}
                  customers={customers}
                  isPtur={isPtur}
                  currencyFormatter={currencyFormatter}
                />
              </Panel>
            ) : (
              <InvoiceWorkspace
                selectedTab={selectedTab}
                setSelectedTab={setSelectedTab}
                invoiceForm={invoiceForm}
                setInvoiceForm={setInvoiceForm}
                setInvoiceFormTouched={setInvoiceFormTouched}
                editingDraftId={editingDraftId}
                setEditingDraftId={setEditingDraftId}
                receiptPaymentForm={receiptPaymentForm}
                setReceiptPaymentForm={setReceiptPaymentForm}
                quoteForm={quoteForm}
                setQuoteForm={setQuoteForm}
                customers={customers}
                serviceItems={serviceItems}
                isPtur={isPtur}
                selectedDocumentType={selectedDocumentType}
                selectedDocumentLabel={selectedDocumentLabel}
                onOpenQuickCreate={() => setQuickCreateOpen(true)}
                draftInvoices={draftInvoices}
                issuedInvoices={issuedInvoices}
                setIssuedInvoices={setIssuedInvoices}
                demoDocs={demoDocs}
                expenses={expenses}
                setExpenses={setExpenses}
                loading={loading}
                draftSearch={draftSearch}
                setDraftSearch={setDraftSearch}
                issuedSearch={issuedSearch}
                setIssuedSearch={setIssuedSearch}
                issuedCustomerFilter={issuedCustomerFilter}
                setIssuedCustomerFilter={setIssuedCustomerFilter}
                issuedFromDate={issuedFromDate}
                setIssuedFromDate={setIssuedFromDate}
                issuedToDate={issuedToDate}
                setIssuedToDate={setIssuedToDate}
                issuedPage={issuedPage}
                setIssuedPage={setIssuedPage}
                duplicatingId={duplicatingId}
                onDuplicate={handleDuplicate}
                onEditDraft={handleEditDraft}
                currencyFormatter={currencyFormatter}
                toast={toast}
                confirmAction={confirmAction}
                promptInput={promptInput}
                onError={setError}
                onRefresh={loadData}
              />
            )}
          </div>
        </section>
      </div>

      {/* Toasts */}
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      {/* Confirm dialog */}
      <ConfirmDialog confirmDialog={confirmDialog} onResolve={resolveConfirm} />

      {/* Prompt dialog */}
      <PromptDialog
        promptDialog={promptDialog}
        promptValue={promptValue}
        onChangeValue={setPromptValue}
        onResolve={resolvePrompt}
      />

      {/* Quick-create customer modal */}
      <QuickCreateCustomerModal
        open={quickCreateOpen}
        onClose={() => setQuickCreateOpen(false)}
        name={quickCreateName}
        setName={setQuickCreateName}
        phone={quickCreatePhone}
        setPhone={setQuickCreatePhone}
        email={quickCreateEmail}
        setEmail={setQuickCreateEmail}
        saving={savingQuickCreate}
        onSubmit={handleQuickCreateCustomer}
      />

      {/* Global search modal */}
      <GlobalSearchModal
        open={globalSearchOpen}
        query={globalSearchQuery}
        onQueryChange={setGlobalSearchQuery}
        onClose={() => setGlobalSearchOpen(false)}
        results={globalSearchResults}
        customers={customers}
        currencyFormatter={currencyFormatter}
        setSelectedTab={setSelectedTab}
        setCustomerSearch={setCustomerSearch}
        setDraftSearch={setDraftSearch}
        setIssuedSearch={setIssuedSearch}
        setIssuedCustomerFilter={setIssuedCustomerFilter}
        setIssuedFromDate={setIssuedFromDate}
        setIssuedToDate={setIssuedToDate}
        setIssuedPage={setIssuedPage}
      />
    </main>
  );
}

export default App;
