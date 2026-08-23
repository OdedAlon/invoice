import { useState, type FormEvent } from "react";
import { X } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { today } from "@/lib/format";
import { Field } from "@/components/common/Field";

export function UserSettingsDrawer({
  onClose,
  toast,
  confirmAction,
  onRefresh
}: {
  onClose: () => void;
  toast: (message: string, type?: "info" | "success" | "error") => void;
  confirmAction: (message: string) => Promise<boolean>;
  onRefresh: () => Promise<void>;
}) {
  const [pwCurrent, setPwCurrent] = useState("");
  const [pwNew, setPwNew] = useState("");
  const [pwConfirm, setPwConfirm] = useState("");
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSaving, setPwSaving] = useState(false);
  const [pwSuccess, setPwSuccess] = useState(false);

  async function handleChangePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPwError(null);
    setPwSuccess(false);
    if (pwNew.length < 8) { setPwError("הסיסמה החדשה חייבת להכיל לפחות 8 תווים"); return; }
    if (pwNew !== pwConfirm) { setPwError("הסיסמאות החדשות אינן תואמות"); return; }
    setPwSaving(true);
    try {
      const res = await apiFetch("/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: pwCurrent, newPassword: pwNew })
      });
      const data = (await res.json()) as { ok?: boolean; message?: string };
      if (!res.ok) { setPwError(data.message ?? "שינוי הסיסמה נכשל"); return; }
      setPwCurrent(""); setPwNew(""); setPwConfirm("");
      setPwSuccess(true);
    } catch {
      setPwError("שגיאת רשת — נסה שוב");
    } finally {
      setPwSaving(false);
    }
  }

  async function handleExportData() {
    try {
      const response = await apiFetch("/v1/export");
      if (!response.ok) { toast("ייצוא נכשל", "error"); return; }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `invoice-backup-${today}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast("הנתונים יוצאו בהצלחה", "success");
    } catch {
      toast("שגיאת רשת — ייצוא נכשל", "error");
    }
  }

  async function handleImportZip(file: File) {
    if (!await confirmAction(`ייבוא הנתונים מ"${file.name}"?\nלקוחות וחשבוניות קיימים עם אותו מזהה יוחלפו. הפעולה בלתי הפיכה.`)) return;
    try {
      const res = await apiFetch("/v1/import/full", {
        method: "POST",
        headers: { "Content-Type": "application/octet-stream" },
        body: file
      });
      const data = (await res.json()) as { ok?: boolean; message?: string; importedCustomers?: number; importedInvoices?: number; skippedInvoices?: number };
      if (!res.ok) {
        toast(data.message ?? "ייבוא נכשל", "error");
        return;
      }
      toast(`ייבוא הושלם! לקוחות: ${data.importedCustomers}, חשבוניות: ${data.importedInvoices}`, "success");
      await onRefresh();
    } catch {
      toast("ייבוא הנתונים נכשל — נסה שוב", "error");
    }
  }

  return (
    <aside className="drawer-slide-in fixed inset-0 z-50 flex flex-col overflow-hidden bg-white shadow-2xl dark:bg-slate-900 sm:inset-y-0 sm:left-auto sm:right-0 sm:w-full sm:max-w-2xl">
      <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-5 py-4 dark:border-slate-700 dark:bg-slate-900">
        <div>
          <h2 className="text-base font-semibold">הגדרות משתמש</h2>
          <p className="text-xs text-slate-500">פרטי חשבון אישי — סיסמה, ייצוא וייבוא נתונים.</p>
        </div>
        <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="סגירה">
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-5">
      <div className="border-t border-violet-200 pt-6">
        <h3 className="mb-1 text-base font-semibold">שינוי סיסמה</h3>
        <p className="mb-4 text-sm text-slate-500">יש להזין את הסיסמה הנוכחית לאישור זהות.</p>
        <form className="grid max-w-sm gap-3" onSubmit={handleChangePassword}>
          <Field label="סיסמה נוכחית">
            <input
              className="input"
              type="password"
              autoComplete="current-password"
              value={pwCurrent}
              onChange={(e) => setPwCurrent(e.target.value)}
              required
            />
          </Field>
          <Field label="סיסמה חדשה (מינימום 8 תווים)">
            <input
              className="input"
              type="password"
              autoComplete="new-password"
              value={pwNew}
              onChange={(e) => { setPwNew(e.target.value); setPwSuccess(false); }}
              required
              minLength={8}
            />
          </Field>
          <Field label="אימות סיסמה חדשה">
            <input
              className="input"
              type="password"
              autoComplete="new-password"
              value={pwConfirm}
              onChange={(e) => { setPwConfirm(e.target.value); setPwSuccess(false); }}
              required
              minLength={8}
            />
          </Field>
          {pwError ? (
            <p className="text-sm text-rose-600">{pwError}</p>
          ) : null}
          {pwSuccess ? (
            <p className="text-sm text-emerald-700">הסיסמה שונתה בהצלחה</p>
          ) : null}
          <div className="flex justify-end">
            <button
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60"
              disabled={pwSaving}
            >
              {pwSaving ? "שומר..." : "שינוי סיסמה"}
            </button>
          </div>
        </form>
      </div>

      <div className="mt-6 border-t border-violet-200 pt-6">
        <h3 className="mb-1 text-base font-semibold">גיבוי ושחזור נתונים</h3>
        <p className="mb-4 text-sm text-slate-500">ייצא את כל הנתונים כ-ZIP לגיבוי, או יבא מייצוא קודם.</p>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            className="flex items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-800 hover:bg-emerald-100"
            onClick={handleExportData}
          >
            ⬇ ייצוא כל הנתונים (ZIP)
          </button>
          <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-800 hover:bg-amber-100">
            ⬆ ייבוא מ-ZIP
            <input
              type="file"
              accept=".zip"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleImportZip(file);
                e.target.value = "";
              }}
            />
          </label>
        </div>
      </div>
      </div>
    </aside>
  );
}
