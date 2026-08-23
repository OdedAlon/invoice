import type { Dispatch, SetStateAction } from "react";
import { DocumentType, type CreateDraftInvoiceInput, type Customer, type DraftInvoice } from "@invoice/shared";
import type { ExpenseItem, QuoteFormState, ReceiptPaymentFormState, ServiceItem, WorkspaceTab } from "@/types/workspace";
import { InvoiceForm } from "@/components/invoices/InvoiceForm";
import { DraftsList } from "@/components/invoices/DraftsList";
import { IssuedList } from "@/components/invoices/IssuedList";
import { InvoiceWorkspaceMiniReports } from "@/components/invoices/InvoiceWorkspaceMiniReports";
import { QuoteWorkspace } from "@/components/quotes/QuoteWorkspace";
import { ReturnNoteWorkspace } from "@/components/return-notes/ReturnNoteWorkspace";

export function InvoiceWorkspace({
  selectedTab,
  setSelectedTab,
  invoiceForm,
  setInvoiceForm,
  setInvoiceFormTouched,
  editingDraftId,
  setEditingDraftId,
  receiptPaymentForm,
  setReceiptPaymentForm,
  quoteForm,
  setQuoteForm,
  customers,
  serviceItems,
  isPtur,
  selectedDocumentType,
  selectedDocumentLabel,
  onOpenQuickCreate,
  draftInvoices,
  issuedInvoices,
  setIssuedInvoices,
  demoDocs,
  expenses,
  setExpenses,
  loading,
  draftSearch,
  setDraftSearch,
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
  onEditDraft,
  currencyFormatter,
  toast,
  confirmAction,
  promptInput,
  onError,
  onRefresh
}: {
  selectedTab: WorkspaceTab;
  setSelectedTab: (tab: WorkspaceTab) => void;
  invoiceForm: CreateDraftInvoiceInput;
  setInvoiceForm: Dispatch<SetStateAction<CreateDraftInvoiceInput>>;
  setInvoiceFormTouched: Dispatch<SetStateAction<boolean>>;
  editingDraftId: string | null;
  setEditingDraftId: Dispatch<SetStateAction<string | null>>;
  receiptPaymentForm: ReceiptPaymentFormState;
  setReceiptPaymentForm: Dispatch<SetStateAction<ReceiptPaymentFormState>>;
  quoteForm: QuoteFormState;
  setQuoteForm: Dispatch<SetStateAction<QuoteFormState>>;
  customers: Customer[];
  serviceItems: ServiceItem[];
  isPtur: boolean;
  selectedDocumentType: DocumentType;
  selectedDocumentLabel: string;
  onOpenQuickCreate: () => void;
  draftInvoices: DraftInvoice[];
  issuedInvoices: DraftInvoice[];
  setIssuedInvoices: Dispatch<SetStateAction<DraftInvoice[]>>;
  demoDocs: DraftInvoice[];
  expenses: ExpenseItem[];
  setExpenses: Dispatch<SetStateAction<ExpenseItem[]>>;
  loading: boolean;
  draftSearch: string;
  setDraftSearch: Dispatch<SetStateAction<string>>;
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
  onEditDraft: (invoice: DraftInvoice) => void;
  currencyFormatter: Intl.NumberFormat;
  toast: (message: string, type?: "info" | "success" | "error", action?: { label: string; onClick: () => void }) => void;
  confirmAction: (message: string) => Promise<boolean>;
  promptInput: (label: string, defaultValue?: string) => Promise<string | null>;
  onError: (message: string | null) => void;
  onRefresh: () => Promise<void>;
}) {
  return (
    <>
      {selectedTab === DocumentType.RETURN_NOTE ? (
        <ReturnNoteWorkspace
          customers={customers}
          issuedInvoices={issuedInvoices}
          isPtur={isPtur}
          currencyFormatter={currencyFormatter}
          onError={onError}
          onRefresh={onRefresh}
        />
      ) : selectedTab === "QUOTE" ? (
        <QuoteWorkspace
          quoteForm={quoteForm}
          setQuoteForm={setQuoteForm}
          customers={customers}
          isPtur={isPtur}
          onSelectTab={setSelectedTab}
          onError={onError}
          onRefresh={onRefresh}
        />
      ) : (
        <InvoiceForm
          invoiceForm={invoiceForm}
          setInvoiceForm={setInvoiceForm}
          setInvoiceFormTouched={setInvoiceFormTouched}
          editingDraftId={editingDraftId}
          setEditingDraftId={setEditingDraftId}
          receiptPaymentForm={receiptPaymentForm}
          setReceiptPaymentForm={setReceiptPaymentForm}
          customers={customers}
          serviceItems={serviceItems}
          isPtur={isPtur}
          selectedDocumentType={selectedDocumentType}
          selectedDocumentLabel={selectedDocumentLabel}
          currencyFormatter={currencyFormatter}
          onOpenQuickCreate={onOpenQuickCreate}
          toast={toast}
          onError={onError}
          onRefresh={onRefresh}
        />
      )}

      <DraftsList
        draftInvoices={draftInvoices}
        customers={customers}
        selectedDocumentType={selectedDocumentType}
        selectedDocumentLabel={selectedDocumentLabel}
        loading={loading}
        draftSearch={draftSearch}
        setDraftSearch={setDraftSearch}
        duplicatingId={duplicatingId}
        onDuplicate={onDuplicate}
        onEditDraft={onEditDraft}
        currencyFormatter={currencyFormatter}
        toast={toast}
        confirmAction={confirmAction}
        onError={onError}
        onRefresh={onRefresh}
      />

      <IssuedList
        issuedInvoices={issuedInvoices}
        setIssuedInvoices={setIssuedInvoices}
        customers={customers}
        selectedDocumentType={selectedDocumentType}
        selectedDocumentLabel={selectedDocumentLabel}
        loading={loading}
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
        onDuplicate={onDuplicate}
        currencyFormatter={currencyFormatter}
        toast={toast}
        confirmAction={confirmAction}
        promptInput={promptInput}
        onError={onError}
        onRefresh={onRefresh}
      />

      <InvoiceWorkspaceMiniReports
        issuedInvoices={issuedInvoices}
        demoDocs={demoDocs}
        expenses={expenses}
        setExpenses={setExpenses}
        currencyFormatter={currencyFormatter}
        toast={toast}
        onError={onError}
      />
    </>
  );
}
