import type { Toast } from "@/types/workspace";

export function ToastStack({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  return (
    <div className="pointer-events-none fixed left-1/2 z-[60] flex w-full max-w-sm -translate-x-1/2 flex-col gap-2 px-4" style={{ bottom: "max(1rem, env(safe-area-inset-bottom))" }}>
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-center justify-between gap-3 rounded-xl px-4 py-3 text-sm shadow-lg transition ${
            t.type === "success"
              ? "border border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
              : t.type === "error"
              ? "border border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-200"
              : "border border-slate-200 bg-white text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          }`}
          role="status"
        >
          <span>{t.message}</span>
          {t.action ? (
            <button
              className="shrink-0 rounded-lg border border-current/30 px-3 py-1 text-xs font-semibold opacity-80 hover:opacity-100"
              onClick={() => { t.action!.onClick(); onDismiss(t.id); }}
            >
              {t.action.label}
            </button>
          ) : null}
        </div>
      ))}
    </div>
  );
}
