export function EmptyState({ text, action, onAction }: { text: string; action?: string; onAction?: () => void }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 p-5 text-center text-sm text-slate-500">
      {text}
      {action && onAction ? (
        <button type="button" onClick={onAction} className="mt-2 block w-full text-xs font-medium text-slate-700 underline underline-offset-2 hover:text-slate-900">
          {action}
        </button>
      ) : null}
    </div>
  );
}
