import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Empty, ErrorState, Input, PageTitle, Panel, Select, Skeleton } from "../components/ui";
import { api } from "../lib/api";
import { getCategories } from "../lib/data";
import { money, monthInput } from "../lib/format";

export default function Budgets() {
  const [month, setMonth] = useState(monthInput());
  const [budgets, setBudgets] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [form, setForm] = useState({ category: "Food", limit: "" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [budgetRes, cats] = await Promise.all([api.get("/budgets", { params: { month } }), getCategories()]);
      setBudgets(budgetRes.data);
      setCategories(cats.filter((c: any) => c.type !== "income"));
    } catch (caught: any) {
      setError(caught.response?.data?.message || "Could not load budgets");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load().catch(() => toast.error("Could not load budgets")); }, [month]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api.post("/budgets", { ...form, month });
      setForm({ ...form, limit: "" });
      toast.success("Budget saved");
      await load();
    } catch (caught: any) {
      toast.error(caught.response?.data?.error?.message || caught.response?.data?.message || "Could not save budget");
    }
  }

  return (
    <div className="px-4 py-6 sm:px-6">
      <PageTitle title="Budgets" subtitle="Set monthly limits and get warned when usage crosses 80%." />
      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <Panel title="Add budget">
          <form onSubmit={save} className="grid gap-3">
            <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
            <Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>{categories.map((c) => <option key={c._id}>{c.name}</option>)}</Select>
            <Input required type="number" placeholder="Monthly limit" value={form.limit} onChange={(e) => setForm({ ...form, limit: e.target.value })} />
            <button className="rounded bg-[#4f46e5] px-4 py-2 font-medium text-white">Save budget</button>
          </form>
        </Panel>
        <Panel title="Usage">
          {error ? <ErrorState message={error} retry={load} /> : loading ? <Skeleton className="h-40" /> : <div className="grid gap-3 md:grid-cols-2">
            {budgets.map((budget) => <div key={budget._id} className="rounded border border-[#e5e7eb] p-4"><div className="flex justify-between"><p className="font-medium">{budget.category}</p><p className={budget.alert ? "text-[#be123c]" : "text-[#6b7280]"}>{budget.percentUsed}% · {budget.status?.replace("_", " ")}</p></div><p className="mt-1 text-sm text-[#6b7280]">{money(budget.spent, "INR")} / {money(budget.limit, "INR")}</p><div className="mt-3 h-2 rounded bg-[#e5e7eb]"><div className={`h-2 rounded ${budget.alert ? "bg-[#be123c]" : "bg-[#4f46e5]"}`} style={{ width: `${Math.min(budget.percentUsed, 100)}%` }} /></div><div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-600"><p>Remaining<br/><strong>{money(budget.remaining, "INR")}</strong></p><p>Projected<br/><strong>{money(budget.projectedSpend, "INR")}</strong></p><p>Daily burn<br/><strong>{money(budget.burnRatePerDay, "INR")}</strong></p><p>Suggested limit<br/><strong>{money(budget.suggestedLimit, "INR")}</strong></p></div></div>)}
          </div>
          }
          {!loading && !error && !budgets.length && <Empty text="No budgets for this month." />}
        </Panel>
      </div>
    </div>
  );
}
