import { useState } from "react";
import { Building2, ChevronDown } from "lucide-react";

export function Panel({
  title,
  description,
  children,
  collapsible,
  id
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  collapsible?: boolean;
  id?: string;
}) {
  const [open, setOpen] = useState(!collapsible);
  return (
    <section id={id} className="rounded-[16px] bg-white p-3 shadow-sm shadow-slate-200 dark:bg-slate-800 dark:shadow-slate-950 sm:rounded-[24px] sm:p-5">
      <div className={`flex items-start gap-2 ${open ? "mb-4" : ""}`}>
        <div className="rounded-xl bg-slate-100 p-2 text-slate-700 dark:bg-slate-700 dark:text-slate-300">
          <Building2 className="h-4 w-4" />
        </div>
        <div className="flex-1">
          <h2 className="text-base font-semibold">{title}</h2>
          <p className="mt-0.5 text-xs leading-5 text-slate-500">{description}</p>
        </div>
        {collapsible !== undefined ? (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-700"
            aria-expanded={open}
          >
            <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
          </button>
        ) : null}
      </div>
      {open ? children : null}
    </section>
  );
}
