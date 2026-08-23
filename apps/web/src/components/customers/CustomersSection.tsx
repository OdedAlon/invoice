import { useMemo, useState, type Dispatch, type FormEvent, type SetStateAction } from "react";
import { ChevronDown, Search } from "lucide-react";
import { getDocumentTypeLabel, type CreateCustomerInput, type Customer, type DraftInvoice } from "@invoice/shared";
import { formatDate } from "@/lib/format";
import { emptyCustomerForm } from "@/types/workspace";
import { Panel } from "@/components/common/Panel";
import { Field } from "@/components/common/Field";
import { EmptyState } from "@/components/common/EmptyState";
import { SkeletonList } from "@/components/common/SkeletonList";

const CUSTOMER_PAGE_SIZE = 10;

export function CustomersSection({
  customers,
  issuedInvoices,
  demoDocs,
  loading,
  customerForm,
  setCustomerForm,
  updateCustomerField,
  editingCustomerId,
  setEditingCustomerId,
  savingCustomer,
  handleCustomerSubmit,
  handleCustomerUpdate,
  currencyFormatter,
  customerSearch,
  setCustomerSearch
}: {
  customers: Customer[];
  issuedInvoices: DraftInvoice[];
  demoDocs: DraftInvoice[];
  loading: boolean;
  customerForm: CreateCustomerInput;
  setCustomerForm: Dispatch<SetStateAction<CreateCustomerInput>>;
  updateCustomerField: <Key extends keyof CreateCustomerInput>(key: Key, value: CreateCustomerInput[Key]) => void;
  editingCustomerId: string | null;
  setEditingCustomerId: Dispatch<SetStateAction<string | null>>;
  savingCustomer: boolean;
  handleCustomerSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  handleCustomerUpdate: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  currencyFormatter: Intl.NumberFormat;
  customerSearch: string;
  setCustomerSearch: Dispatch<SetStateAction<string>>;
}) {
  const [expandedCustomerIds, setExpandedCustomerIds] = useState<Set<string>>(new Set());
  const [customerPage, setCustomerPage] = useState(1);

  const customerStats = useMemo(() => {
    const map = new Map<string, { count: number; total: number; lastDate: string }>();
    for (const inv of issuedInvoices) {
      const s = map.get(inv.customerId) ?? { count: 0, total: 0, lastDate: "" };
      s.count++;
      s.total += inv.totalAmount;
      if (!s.lastDate || inv.issueDate > s.lastDate) s.lastDate = inv.issueDate;
      map.set(inv.customerId, s);
    }
    return map;
  }, [issuedInvoices]);

  const filteredCustomers = useMemo(
    () =>
      customerSearch.trim()
        ? customers.filter(
            (c) =>
              c.displayNameHe.toLowerCase().includes(customerSearch.toLowerCase()) ||
              (c.taxId ?? "").includes(customerSearch)
          )
        : customers,
    [customers, customerSearch]
  );

  const customerTotalPages = Math.max(1, Math.ceil(filteredCustomers.length / CUSTOMER_PAGE_SIZE));
  const customerCurrentPage = Math.min(customerPage, customerTotalPages);
  const pagedCustomers = useMemo(
    () => filteredCustomers.slice((customerCurrentPage - 1) * CUSTOMER_PAGE_SIZE, customerCurrentPage * CUSTOMER_PAGE_SIZE),
    [filteredCustomers, customerCurrentPage]
  );

  return (
    <div className="order-last min-w-0 space-y-6 xl:order-first">
      <Panel title={editingCustomerId ? "עריכת לקוח" : "פתיחת לקוח חדש"} description={editingCustomerId ? "עדכן פרטי לקוח קיים." : "הזנה מהירה בעברית, עם שדות מינימליים להתחלה מהירה."} collapsible>
        <form className="grid gap-4" onSubmit={editingCustomerId ? handleCustomerUpdate : handleCustomerSubmit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="שם תצוגה">
              <input className="input" value={customerForm.displayNameHe} onChange={(event) => updateCustomerField("displayNameHe", event.target.value)} placeholder="למשל: יעל לוי" autoComplete="name" />
            </Field>
            <Field label="סוג לקוח">
              <select className="input" value={customerForm.type} onChange={(event) => updateCustomerField("type", event.target.value as CreateCustomerInput["type"])}>
                <option value="PRIVATE">פרטי</option>
                <option value="COMPANY">חברה</option>
              </select>
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="ח.פ / ת.ז">
              <input className="input" value={customerForm.taxId ?? ""} onChange={(event) => updateCustomerField("taxId", event.target.value)} inputMode="numeric" />
            </Field>
            <Field label="ימי אשראי">
              <input className="input" type="number" min="0" step="1" value={customerForm.paymentTermsDays ?? 0} onChange={(event) => updateCustomerField("paymentTermsDays", Number(event.target.value))} inputMode="numeric" />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="אימייל">
              <input className="input" type="email" autoComplete="email" value={customerForm.email ?? ""} onChange={(event) => updateCustomerField("email", event.target.value)} />
            </Field>
            <Field label="טלפון">
              <input className="input" type="tel" autoComplete="tel" inputMode="tel" value={customerForm.phone ?? ""} onChange={(event) => updateCustomerField("phone", event.target.value)} />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="כתובת">
              <input className="input" value={customerForm.addressHe ?? ""} onChange={(event) => updateCustomerField("addressHe", event.target.value)} autoComplete="street-address" />
            </Field>
            <Field label="עיר">
              <input className="input" value={customerForm.cityHe ?? ""} onChange={(event) => updateCustomerField("cityHe", event.target.value)} autoComplete="address-level2" />
            </Field>
          </div>

          <div className="flex justify-end gap-2">
            {editingCustomerId ? (
              <button
                type="button"
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                onClick={() => { setEditingCustomerId(null); setCustomerForm(emptyCustomerForm); }}
              >
                ביטול
              </button>
            ) : null}
            <button className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:opacity-60" disabled={savingCustomer}>
              {savingCustomer ? "שומר..." : editingCustomerId ? "עדכון לקוח" : "שמירת לקוח"}
            </button>
          </div>
        </form>
      </Panel>

      <Panel title="רשימת לקוחות" description="גישה מהירה ללקוחות שנפתחו לאחרונה.">
        <div className="mb-3 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
          <Search className="h-4 w-4 shrink-0 text-slate-400" />
          <input
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
            placeholder="חיפוש לקוח..."
            value={customerSearch}
            onChange={(e) => setCustomerSearch(e.target.value)}
            inputMode="search"
            enterKeyHint="search"
          />
        </div>
        <div className="max-h-[28rem] space-y-3 overflow-y-auto">
          {loading ? <SkeletonList rows={4} /> : null}
          {!loading && customers.length === 0 ? <EmptyState text="עדיין אין לקוחות. צרו את הלקוח הראשון." /> : null}
          {!loading && customers.length > 0 && filteredCustomers.length === 0 ? <EmptyState text="לא נמצאו לקוחות." /> : null}
          {pagedCustomers.map((customer) => {
            const isExpanded = expandedCustomerIds.has(customer.id);
            const toggleExpand = () => setExpandedCustomerIds((prev) => {
              const next = new Set(prev);
              if (next.has(customer.id)) { next.delete(customer.id); } else { next.add(customer.id); }
              return next;
            });
            const customerDocs = [...issuedInvoices, ...demoDocs]
              .filter((inv) => inv.customerId === customer.id)
              .sort((a, b) => b.issueDate.localeCompare(a.issueDate))
              .slice(0, 5);
            return (
            <article key={customer.id} data-customer-id={customer.id} className="rounded-xl border border-slate-200 dark:border-slate-700">
              <button
                type="button"
                className="flex w-full items-center justify-between gap-3 p-3 text-start"
                onClick={toggleExpand}
              >
                <div className="min-w-0">
                  <h3 className="font-medium">{customer.displayNameHe}</h3>
                  <p className="mt-0.5 text-xs text-slate-500">{customer.type === "COMPANY" ? "חברה" : "לקוח פרטי"} • {customer.paymentTermsDays} ימי אשראי</p>
                  {(() => { const s = customerStats.get(customer.id); return s ? <p className="mt-0.5 text-xs text-slate-400">{s.count} מסמכים • {currencyFormatter.format(s.total)}</p> : null; })()}
                </div>
                <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`} />
              </button>
              {isExpanded ? (
                <div className="border-t border-slate-200 px-3 pb-3 pt-2 dark:border-slate-700">
                  <div className="grid gap-1 text-sm text-slate-600 dark:text-slate-400">
                    {customer.taxId ? <span>מספר מזהה: {customer.taxId}</span> : null}
                    {customer.email ? <span>אימייל: {customer.email}</span> : null}
                    {customer.phone ? <span>טלפון: {customer.phone}</span> : null}
                    {customer.addressHe || customer.cityHe ? <span>כתובת: {[customer.addressHe, customer.cityHe].filter(Boolean).join(", ")}</span> : null}
                  </div>
                  {customerDocs.length > 0 ? (
                    <div className="mt-3 space-y-1.5">
                      <p className="text-xs font-medium text-slate-500">מסמכים אחרונים</p>
                      {customerDocs.map((inv) => (
                        <div key={inv.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-2 py-1.5 text-xs dark:bg-slate-700">
                          <span className="text-slate-500">{formatDate(inv.issueDate)} • {getDocumentTypeLabel(inv.documentType)}</span>
                          <span className="font-medium text-slate-800 dark:text-slate-200">{currencyFormatter.format(inv.totalAmount)}</span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      onClick={() => {
                        setEditingCustomerId(customer.id);
                        setCustomerForm({
                          displayNameHe: customer.displayNameHe,
                          legalNameHe: customer.legalNameHe ?? "",
                          type: customer.type as "PRIVATE" | "COMPANY",
                          taxId: customer.taxId ?? "",
                          email: customer.email ?? "",
                          phone: customer.phone ?? "",
                          addressHe: customer.addressHe ?? "",
                          cityHe: customer.cityHe ?? "",
                          paymentTermsDays: customer.paymentTermsDays ?? 0,
                        });
                        // scroll the form into view
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                    >
                      עריכה
                    </button>
                  </div>
                </div>
              ) : null}
            </article>
            );
          })}
          {filteredCustomers.length > CUSTOMER_PAGE_SIZE ? (
            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-900">
              <button
                className="rounded-lg border border-slate-300 px-3 py-1.5 font-medium text-slate-700 hover:bg-white disabled:opacity-40"
                onClick={() => setCustomerPage((p) => Math.max(1, p - 1))}
                disabled={customerCurrentPage === 1}
              >→ הקודם</button>
              <span className="text-slate-500">{customerCurrentPage} / {customerTotalPages}</span>
              <button
                className="rounded-lg border border-slate-300 px-3 py-1.5 font-medium text-slate-700 hover:bg-white disabled:opacity-40"
                onClick={() => setCustomerPage((p) => Math.min(customerTotalPages, p + 1))}
                disabled={customerCurrentPage === customerTotalPages}
              >הבא ←</button>
            </div>
          ) : null}
        </div>
      </Panel>
    </div>
  );
}
