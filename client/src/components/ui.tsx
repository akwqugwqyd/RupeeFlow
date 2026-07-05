import type { ReactNode } from "react";

export function Panel({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="rounded-xl border border-white/80 bg-white/95 p-4 shadow-[0_14px_40px_rgba(15,23,42,0.08)] ring-1 ring-slate-900/5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-[15px] font-bold text-[#111827]">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`min-w-0 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] px-3 py-2 text-sm shadow-inner shadow-slate-200/40 outline-none transition placeholder:text-slate-400 focus:border-[#4f46e5] focus:bg-white focus:ring-2 focus:ring-indigo-100 ${props.className || ""}`} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`min-w-0 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] px-3 py-2 text-sm shadow-inner shadow-slate-200/40 outline-none transition focus:border-[#4f46e5] focus:bg-white focus:ring-2 focus:ring-indigo-100 ${props.className || ""}`} />;
}

export function Empty({ text }: { text: string }) {
  return <div role="status" className="rounded-xl border border-dashed border-[#cbd5e1] bg-[#f8fafc] p-5 text-center text-sm text-[#64748b]">{text}</div>;
}

export function ErrorState({ message, retry }: { message: string; retry?: () => void }) {
  return (
    <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">
      <p className="font-bold">We couldn’t load this data</p>
      <p className="mt-1">{message}</p>
      {retry && <button type="button" onClick={retry} className="mt-3 rounded-lg border border-red-300 bg-white px-3 py-2">Try again</button>}
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`animate-pulse rounded-lg bg-slate-200 ${className}`} />;
}

export function ConfirmDialog({ open, title, description, onCancel, onConfirm, busy = false }: {
  open: boolean;
  title: string;
  description: string;
  onCancel: () => void;
  onConfirm: () => void;
  busy?: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4" role="presentation" onMouseDown={onCancel}>
      <div role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
        <h2 id="confirm-title" className="text-lg font-extrabold">{title}</h2>
        <p className="mt-2 text-sm text-slate-600">{description}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onCancel} disabled={busy} className="rounded-lg border border-slate-300 px-4 py-2">Cancel</button>
          <button type="button" onClick={onConfirm} disabled={busy} className="rounded-lg bg-red-600 px-4 py-2 text-white disabled:opacity-60">{busy ? "Deleting…" : "Delete"}</button>
        </div>
      </div>
    </div>
  );
}

export function PageTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-6">
      <h2 className="text-2xl font-extrabold text-[#111827]">{title}</h2>
      <p className="text-sm font-medium text-[#64748b]">{subtitle}</p>
    </div>
  );
}
