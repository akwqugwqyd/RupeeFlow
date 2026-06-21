import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { BarChart3, Bot, Download, LogOut, Settings, Tags, WalletCards } from "lucide-react";
import { api } from "../lib/api";
import { useAuth } from "../state/AuthContext";

export default function AppShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();

  async function exportCsv() {
    const { data } = await api.get("/transactions/export/csv", { responseType: "blob" });
    const url = URL.createObjectURL(data);
    const link = document.createElement("a");
    link.href = url;
    link.download = "rupeeflow-transactions.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-screen bg-[#eef2f7]">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-slate-800 bg-[#0f172a] px-5 py-6 text-white shadow-2xl shadow-slate-950/20 lg:block">
        <div className="flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-2xl bg-slate-100 text-slate-900 shadow-lg shadow-slate-950/20">
            <WalletCards size={20} />
          </div>
          <div>
            <p className="text-lg font-extrabold">RupeeFlow</p>
          </div>
        </div>
        <nav className="mt-10 space-y-1">
          <NavItem to="/" icon={BarChart3} label="Dashboard" />
          <NavItem to="/transactions" icon={WalletCards} label="Transactions" />
          <NavItem to="/budgets" icon={Tags} label="Budgets" />
          <NavItem to="/ai-chat" icon={Bot} label="AI Chat" />
          <NavItem to="/settings" icon={Settings} label="Settings" />
        </nav>
      </aside>

      <main className="lg:pl-64">
        <header className="sticky top-0 z-10 border-b border-white/70 bg-white/85 px-4 py-3 shadow-sm shadow-slate-200/70 backdrop-blur sm:px-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-[#64748b]">Welcome back</p>
              <h1 className="text-xl font-extrabold text-[#111827]">{user?.name}</h1>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={exportCsv} className="grid size-10 place-items-center rounded-xl border border-[#cbd5e1] bg-white text-[#334155] shadow-sm transition hover:border-[#4f46e5] hover:text-[#4f46e5]" title="Export CSV">
                <Download size={18} />
              </button>
              <button onClick={logout} className="grid size-10 place-items-center rounded-xl border border-[#cbd5e1] bg-white text-[#334155] shadow-sm transition hover:border-[#4f46e5] hover:text-[#4f46e5]" title="Sign out">
                <LogOut size={18} />
              </button>
            </div>
          </div>
        </header>
        <nav className="no-scrollbar flex gap-2 overflow-x-auto border-b border-[#e2e8f0] bg-white px-4 py-2 lg:hidden">
          <NavPill to="/" label="Dashboard" />
          <NavPill to="/transactions" label="Transactions" />
          <NavPill to="/budgets" label="Budgets" />
          <NavPill to="/ai-chat" label="AI Chat" />
          <NavPill to="/settings" label="Settings" />
        </nav>
        {children}
      </main>
    </div>
  );
}

function NavItem({ to, icon: Icon, label }: { to: string; icon: React.ElementType; label: string }) {
  return (
    <NavLink to={to} end={to === "/"} className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-bold transition ${isActive ? "bg-slate-100 text-slate-950 shadow-lg shadow-slate-950/20" : "text-slate-300 hover:bg-slate-700/70 hover:text-white"}`}>
      <Icon size={18} />
      {label}
    </NavLink>
  );
}

function NavPill({ to, label }: { to: string; label: string }) {
  return <NavLink to={to} end={to === "/"} className={({ isActive }) => `shrink-0 rounded-xl border px-3 py-1.5 text-sm font-bold ${isActive ? "border-[#4f46e5] bg-[#eef2ff] text-[#4f46e5]" : "border-[#e2e8f0] text-[#64748b]"}`}>{label}</NavLink>;
}
