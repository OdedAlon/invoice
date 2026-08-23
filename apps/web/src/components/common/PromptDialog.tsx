import type { PromptState } from "@/types/workspace";

export function PromptDialog({
  promptDialog,
  promptValue,
  onChangeValue,
  onResolve
}: {
  promptDialog: PromptState;
  promptValue: string;
  onChangeValue: (value: string) => void;
  onResolve: (value: string | null) => void;
}) {
  if (!promptDialog) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/50 px-4">
      <form
        className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl dark:bg-slate-800"
        onSubmit={(e) => { e.preventDefault(); onResolve(promptValue.trim() || null); }}
      >
        <label className="block text-sm font-medium text-slate-800 dark:text-slate-100">{promptDialog.label}</label>
        <input
          autoFocus
          className="input mt-2 w-full"
          value={promptValue}
          onChange={(e) => onChangeValue(e.target.value)}
        />
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
            onClick={() => onResolve(null)}
          >
            ביטול
          </button>
          <button
            type="submit"
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 dark:bg-slate-200 dark:text-slate-900"
          >
            אישור
          </button>
        </div>
      </form>
    </div>
  );
}
