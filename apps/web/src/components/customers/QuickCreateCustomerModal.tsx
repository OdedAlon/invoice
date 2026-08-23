import { X } from "lucide-react";
import { Field } from "@/components/common/Field";

export function QuickCreateCustomerModal({
  open,
  onClose,
  name,
  setName,
  phone,
  setPhone,
  email,
  setEmail,
  saving,
  onSubmit
}: {
  open: boolean;
  onClose: () => void;
  name: string;
  setName: (value: string) => void;
  phone: string;
  setPhone: (value: string) => void;
  email: string;
  setEmail: (value: string) => void;
  saving: boolean;
  onSubmit: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/60 px-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl dark:bg-slate-800" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold">לקוח חדש</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600" aria-label="סגירה"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-3">
          <Field label="שם לקוח *">
            <input autoFocus className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="שם מלא / שם חברה" />
          </Field>
          <Field label="טלפון">
            <input className="input" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </Field>
          <Field label="אימייל">
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
        </div>
        <div className="mt-4 flex gap-2">
          <button
            className="flex-1 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60 dark:bg-slate-200 dark:text-slate-900"
            onClick={onSubmit}
            disabled={saving || !name.trim()}
          >
            {saving ? "שומר..." : "צור לקוח"}
          </button>
          <button className="rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50" onClick={onClose}>ביטול</button>
        </div>
      </div>
    </div>
  );
}
