import type { ConfirmState } from "@/types/workspace";

export function ConfirmDialog({ confirmDialog, onResolve }: { confirmDialog: ConfirmState; onResolve: (ok: boolean) => void }) {
  if (!confirmDialog) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/50 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl dark:bg-slate-800">
        <p className="whitespace-pre-line text-sm text-slate-800 dark:text-slate-100">{confirmDialog.message}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
            onClick={() => onResolve(false)}
          >
            ביטול
          </button>
          <button
            type="button"
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 dark:bg-slate-200 dark:text-slate-900"
            onClick={() => onResolve(true)}
            autoFocus
          >
            אישור
          </button>
        </div>
      </div>
    </div>
  );
}
