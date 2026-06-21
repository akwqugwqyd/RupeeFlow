import { useState } from "react";
import toast from "react-hot-toast";
import { Landmark } from "lucide-react";
import { useAuth } from "../state/AuthContext";

export default function Login() {
  const { login } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", monthlyIncomeTarget: 150000 });

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    try {
      await login(form, mode);
      toast.success(mode === "login" ? "Signed in" : "Account created");
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Authentication failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="grid min-h-screen grid-cols-1 bg-[#eef2f7] lg:grid-cols-[1fr_440px]">
      <section className="relative hidden overflow-hidden bg-[#0f172a] lg:block">
        <img className="h-full w-full object-cover opacity-75" src="https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=1600&q=80" alt="" />
        <div className="absolute inset-0 bg-[#0f172a]/60" />
        <div className="absolute bottom-12 left-12 max-w-xl text-white">
          <h1 className="text-5xl font-extrabold">RupeeFlow</h1>
          <p className="mt-4 text-lg font-medium text-white/85">Track cash flow, protect budgets, and turn everyday spending into decisions you can defend.</p>
        </div>
      </section>
      <section className="flex items-center justify-center px-5 py-10">
        <form onSubmit={submit} className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3">
            <div className="grid size-11 place-items-center rounded-2xl bg-[#4f46e5] text-white shadow-lg shadow-indigo-200">
              <Landmark size={21} />
            </div>
            <div>
              <p className="text-2xl font-extrabold">RupeeFlow</p>
              <p className="text-sm font-medium text-[#64748b]">{mode === "login" ? "Sign in to your workspace" : "Create your finance workspace"}</p>
            </div>
          </div>

          <div className="mb-5 grid grid-cols-2 rounded border border-[#d1d5db] bg-white p-1">
            <button type="button" onClick={() => setMode("login")} className={`rounded px-3 py-2 text-sm ${mode === "login" ? "bg-[#4f46e5] text-white shadow-sm" : "text-[#64748b]"}`}>Sign in</button>
            <button type="button" onClick={() => setMode("register")} className={`rounded px-3 py-2 text-sm ${mode === "register" ? "bg-[#4f46e5] text-white shadow-sm" : "text-[#64748b]"}`}>Register</button>
          </div>

          {mode === "register" && <Field label="Name" value={form.name} onChange={(name) => setForm({ ...form, name })} />}
          <Field label="Email" type="email" value={form.email} onChange={(email) => setForm({ ...form, email })} />
          <Field label="Password" type="password" value={form.password} onChange={(password) => setForm({ ...form, password })} />
          {mode === "register" && (
            <div className="grid gap-3">
              <div className="rounded border border-[#d1d5db] bg-[#ffffff] px-3 py-2.5 text-sm text-[#374151]">
                Currency: INR
              </div>
              <Field label="Monthly income" type="number" value={form.monthlyIncomeTarget} onChange={(monthlyIncomeTarget) => setForm({ ...form, monthlyIncomeTarget: Number(monthlyIncomeTarget) })} />
            </div>
          )}
          <button disabled={loading} className="mt-4 w-full rounded-xl bg-[#4f46e5] px-4 py-3 font-bold text-white shadow-lg shadow-indigo-200 transition hover:bg-[#4338ca] disabled:opacity-60">
            {loading ? "Working..." : mode === "login" ? "Sign in" : "Create account"}
          </button>
        </form>
      </section>
    </main>
  );
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string | number; onChange: (value: string) => void; type?: string }) {
  return (
    <label className="mb-3 block">
      <span className="mb-1 block text-sm font-bold text-[#334155]">{label}</span>
      <input type={type} value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-lg border border-[#cbd5e1] bg-[#f8fafc] px-3 py-2.5 outline-none transition focus:border-[#4f46e5] focus:bg-white focus:ring-2 focus:ring-indigo-100" required />
    </label>
  );
}
