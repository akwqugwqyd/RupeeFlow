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
  return <div className="rounded-xl border border-dashed border-[#cbd5e1] bg-[#f8fafc] p-5 text-center text-sm text-[#64748b]">{text}</div>;
}

export function PageTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-6">
      <h2 className="text-2xl font-extrabold text-[#111827]">{title}</h2>
      <p className="text-sm font-medium text-[#64748b]">{subtitle}</p>
    </div>
  );
}
