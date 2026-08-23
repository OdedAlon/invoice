import {
  getDocumentTypeLabel,
  BusinessTaxProfile,
  DocumentType,
  PaymentMethod,
  type BusinessSettings,
  type CreateCustomerInput,
  type DraftInvoiceLineInput
} from "@invoice/shared";
import { today } from "@/lib/format";

export const emptyCustomerForm: CreateCustomerInput = {
  displayNameHe: "",
  type: "PRIVATE",
  taxId: "",
  email: "",
  phone: "",
  addressHe: "",
  cityHe: "",
  paymentTermsDays: 0
};

export const emptyInvoiceLine: DraftInvoiceLineInput = {
  descriptionHe: "",
  quantity: 1,
  unitPrice: 0,
  vatRate: 17
};

export const defaultBusinessSettings: BusinessSettings = {
  nameHe: "",
  taxId: "",
  taxProfile: BusinessTaxProfile.MURSHE
};

export type ExpenseItem = {
  id: string;
  date: string;
  category: string;
  amount: number;
  notes?: string;
};

export type ServiceItem = {
  name: string;
  defaultPrice: number;
};

export type QuoteFormState = {
  customerId: string;
  issueDate: string;
  dueDate: string;
  descriptionHe: string;
  amount: string;
  vatRate: string;
  notesHe: string;
};

export const emptyQuoteForm = (customerId = ""): QuoteFormState => ({
  customerId,
  issueDate: today,
  dueDate: today,
  descriptionHe: "",
  amount: "",
  vatRate: "17",
  notesHe: ""
});

export type ReturnNoteLine = {
  descriptionHe: string;
  quantity: string;
  unitPrice: string;
  vatRate: string;
  selected: boolean;
};

export type ReturnNoteFormState = {
  customerId: string;
  sourceInvoiceId: string;
  issueDate: string;
  notesHe: string;
  lines: ReturnNoteLine[];
};

export const emptyReturnNoteForm = (): ReturnNoteFormState => ({
  customerId: "",
  sourceInvoiceId: "",
  issueDate: today,
  notesHe: "",
  lines: [{ descriptionHe: "", quantity: "1", unitPrice: "0", vatRate: "17", selected: true }]
});

export type WorkspaceTab = DocumentType | "QUOTE" | "REPORTS";

export type ReceiptPaymentFormState = {
  method: PaymentMethod;
  cardNumber: string;
  cardType: string;
  installments: string;
  approvalCode: string;
  creditDate: string;
  checkNumber: string;
  checkAccountNumber: string;
  bankName: string;
  branchNumber: string;
  checkDueDate: string;
  transferReference: string;
  transferDate: string;
  transferAccountNumber: string;
  transferBranchNumber: string;
  paymentAppName: string;
  paymentAppTransactionId: string;
  paymentAppPayerPhone: string;
  otherDescription: string;
};

export const emptyReceiptPaymentForm: ReceiptPaymentFormState = {
  method: PaymentMethod.CASH,
  cardNumber: "",
  cardType: "",
  installments: "",
  approvalCode: "",
  creditDate: "",
  checkNumber: "",
  checkAccountNumber: "",
  bankName: "",
  branchNumber: "",
  checkDueDate: "",
  transferReference: "",
  transferDate: "",
  transferAccountNumber: "",
  transferBranchNumber: "",
  paymentAppName: "",
  paymentAppTransactionId: "",
  paymentAppPayerPhone: "",
  otherDescription: ""
};

export type ReportEntry = {
  id: string;
  date: string;
  amount: number;
};

export type Toast = {
  id: number;
  message: string;
  type: "info" | "success" | "error";
  action?: { label: string; onClick: () => void };
};

export type ConfirmState = { message: string; resolve: (ok: boolean) => void } | null;

export type PromptState = { label: string; defaultValue: string; resolve: (val: string | null) => void } | null;

export const monthOptions = [
  { value: "ALL", label: "כל השנה" },
  { value: "01", label: "ינואר" },
  { value: "02", label: "פברואר" },
  { value: "03", label: "מרץ" },
  { value: "04", label: "אפריל" },
  { value: "05", label: "מאי" },
  { value: "06", label: "יוני" },
  { value: "07", label: "יולי" },
  { value: "08", label: "אוגוסט" },
  { value: "09", label: "ספטמבר" },
  { value: "10", label: "אוקטובר" },
  { value: "11", label: "נובמבר" },
  { value: "12", label: "דצמבר" }
];

export function getTabDocumentType(tab: WorkspaceTab): DocumentType {
  if (tab === "QUOTE" || tab === "REPORTS") return DocumentType.PROFORMA;
  return tab;
}

export function getTabLabel(tab: WorkspaceTab) {
  if (tab === "QUOTE") return "הצעת מחיר";
  if (tab === "REPORTS") return 'דו"חות';
  return getDocumentTypeLabel(tab);
}

export function normalizePaymentDetails(details: Record<string, string | number | boolean | undefined>) {
  const entries = Object.entries(details).filter(([, value]) => {
    if (value === undefined) {
      return false;
    }

    if (typeof value === "string") {
      return value.trim().length > 0;
    }

    return true;
  });

  return Object.fromEntries(entries) as Record<string, string | number | boolean>;
}

export function buildReceiptPaymentPayload(form: ReceiptPaymentFormState) {
  switch (form.method) {
    case PaymentMethod.CREDIT:
      return {
        method: PaymentMethod.CREDIT,
        details: normalizePaymentDetails({
          cardNumber: form.cardNumber.trim(),
          cardType: form.cardType.trim(),
          installments: Number(form.installments) || 1,
          approvalCode: form.approvalCode.trim(),
          date: form.creditDate
        })
      };
    case PaymentMethod.CHECK:
      return {
        method: PaymentMethod.CHECK,
        details: normalizePaymentDetails({
          checkNumber: form.checkNumber.trim(),
          bankName: form.bankName.trim(),
          branchNumber: form.branchNumber.trim(),
          accountNumber: form.checkAccountNumber.trim(),
          dueDate: form.checkDueDate
        })
      };
    case PaymentMethod.BANK_TRANSFER:
      return {
        method: PaymentMethod.BANK_TRANSFER,
        details: normalizePaymentDetails({
          reference: form.transferReference.trim(),
          transferDate: form.transferDate,
          bankName: form.bankName.trim(),
          branchNumber: form.transferBranchNumber.trim(),
          accountNumber: form.transferAccountNumber.trim()
        })
      };
    case PaymentMethod.PAYMENT_APP:
      return {
        method: PaymentMethod.PAYMENT_APP,
        details: normalizePaymentDetails({
          appName: form.paymentAppName.trim(),
          transactionId: form.paymentAppTransactionId.trim(),
          payerPhone: form.paymentAppPayerPhone.trim()
        })
      };
    case PaymentMethod.OTHER:
      return {
        method: PaymentMethod.OTHER,
        details: normalizePaymentDetails({
          description: form.otherDescription.trim()
        })
      };
    case PaymentMethod.CASH:
    default:
      return {
        method: PaymentMethod.CASH,
        details: normalizePaymentDetails({})
      };
  }
}

export function validateReceiptPayment(form: ReceiptPaymentFormState) {
  switch (form.method) {
    case PaymentMethod.CREDIT:
      return form.cardNumber.trim().length > 0;
    case PaymentMethod.CHECK:
      return form.checkNumber.trim().length > 0;
    case PaymentMethod.BANK_TRANSFER:
      return form.transferReference.trim().length > 0;
    case PaymentMethod.PAYMENT_APP:
      return form.paymentAppName.trim().length > 0;
    case PaymentMethod.OTHER:
      return form.otherDescription.trim().length > 0;
    case PaymentMethod.CASH:
    default:
      return true;
  }
}
