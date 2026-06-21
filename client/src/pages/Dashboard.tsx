import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertCircle, Check, CircleDollarSign, RefreshCw, Target, TrendingUp } from "lucide-react";
import { Empty, PageTitle, Panel } from "../components/ui";
import { api } from "../lib/api";
import { getNudges } from "../lib/data";
import { money, monthInput, pct } from "../lib/format";
import { useAuth } from "../state/AuthContext";

const colors = ["#4f46e5", "#16a34a", "#f59e0b", "#7c3aed", "#c2410c", "#4f46e5", "#be123c", "#65a30d"];

export default function Dashboard() {
  const { user } = useAuth();
  const [month, setMonth] = useState(monthInput());
  const [overview, setOverview] = useState<any>(null);
  const [summary, setSummary] = useState("");
  const [nudges, setNudges] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const [overviewRes, summaryRes, nudgesRes] = await Promise.all([
        api.get("/analytics/overview", { params: { month } }),
        api.get("/ai/monthly-summary", { params: { month } }),
        getNudges()
      ]);
      setOverview(overviewRes.data);
      setSummary(summaryRes.data.paragraph);
      setNudges(nudgesRes);
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Could not load dashboard");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [month]);

  const currency = "INR";
  const totals = overview?.summary || {};

  return (
    <div className="px-4 py-6 sm:px-6">
      <div className="mb-6 flex flex-col justify-between gap-3 md:flex-row md:items-end">
        <PageTitle title="Dashboard" subtitle="Monthly income, expenses, trends, budgets, nudges, and recent activity." />
        <div className="flex items-center gap-2">
          <input type="month" value={month} onChange={(event) => setMonth(event.target.value)} className="rounded border border-[#d1d5db] bg-white px-3 py-2" />
          <button onClick={load} className="grid size-10 place-items-center rounded border border-[#d1d5db] bg-white" title="Refresh"><RefreshCw size={18} /></button>
        </div>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric title="Income" value={money(totals.income, currency)} icon={TrendingUp} tone="green" />
        <Metric title="Expenses" value={money(totals.expenses, currency)} icon={CircleDollarSign} tone="amber" />
        <Metric title="Net cash flow" value={money(totals.net, currency)} icon={Check} tone={totals.net >= 0 ? "green" : "red"} />
        <Metric title="Savings rate" value={pct(totals.savingsRate)} icon={Target} tone={totals.savingsRate >= 20 ? "green" : "amber"} />
      </section>

      {loading ? (
        <div className="mt-6 rounded border border-[#e5e7eb] bg-white p-8 text-center text-[#6b7280]">Loading dashboard...</div>
      ) : (
        <div className="mt-6 space-y-6">
          <Panel title="AI insight banner">
            <p className="text-sm leading-6 text-[#374151]">{summary || "Add transactions to generate a monthly summary."}</p>
          </Panel>

          {nudges.length > 0 && (
            <div className="grid gap-3 md:grid-cols-2">
              {nudges.map((nudge, index) => (
                <div key={index} className="flex items-start gap-3 rounded border border-[#f0d7a1] bg-[#fff8e6] p-3 text-sm text-[#714600]">
                  <AlertCircle size={18} />
                  <p>{nudge.message}</p>
                </div>
              ))}
            </div>
          )}

          <section className="grid gap-6 xl:grid-cols-3">
            <Panel title="Monthly income vs expense">
              <ChartBox>
                <BarChart data={[{ label: month, income: totals.income || 0, expenses: totals.expenses || 0 }]}>
                  <CartesianGrid stroke="#e5e7eb" />
                  <XAxis dataKey="label" />
                  <YAxis tickFormatter={(value) => money(value, currency)} width={80} />
                  <Tooltip formatter={(value) => money(String(value), currency)} />
                  <Bar dataKey="income" fill="#4f46e5" />
                  <Bar dataKey="expenses" fill="#f59e0b" />
                </BarChart>
              </ChartBox>
            </Panel>

            <Panel title="Category-wise spend">
              <ChartBox>
                {overview?.categorySpend?.length ? (
                  <PieChart>
                    <Pie data={overview.categorySpend} dataKey="total" nameKey="category" innerRadius={52} outerRadius={92}>
                      {overview.categorySpend.map((_: any, index: number) => <Cell key={index} fill={colors[index % colors.length]} />)}
                    </Pie>
                    <Tooltip formatter={(value) => money(String(value), currency)} />
                  </PieChart>
                ) : <Empty text="No category spend yet." />}
              </ChartBox>
            </Panel>

            <Panel title="Spending trend">
              <ChartBox>
                <AreaChart data={overview?.spendingTrend || []}>
                  <CartesianGrid stroke="#e5e7eb" />
                  <XAxis dataKey="month" />
                  <YAxis tickFormatter={(value) => money(value, currency)} width={80} />
                  <Tooltip formatter={(value) => money(String(value), currency)} />
                  <Area type="monotone" dataKey="expenses" stroke="#be123c" fill="#fde2e8" />
                </AreaChart>
              </ChartBox>
            </Panel>
          </section>

          <Panel title="Recent transactions">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-left text-sm">
                <thead className="text-[#6b7280]"><tr><th className="py-2">Date</th><th>Merchant</th><th>Category</th><th>Type</th><th className="text-right">Amount</th></tr></thead>
                <tbody>{overview?.recentTransactions?.map((tx: any) => <tr key={tx._id} className="border-t border-[#e5e7eb]"><td className="py-3">{tx.date.slice(0, 10)}</td><td>{tx.merchant || "Unlabeled"}</td><td>{tx.category}</td><td>{tx.type}</td><td className="text-right font-medium">{money(tx.amount, currency)}</td></tr>)}</tbody>
              </table>
              {!overview?.recentTransactions?.length && <Empty text="No transactions yet." />}
            </div>
          </Panel>
        </div>
      )}
    </div>
  );
}

function Metric({ title, value, icon: Icon, tone }: { title: string; value: string; icon: any; tone: string }) {
  const toneClass = tone === "red" ? "bg-[#fff1f1] text-[#be123c]" : tone === "amber" ? "bg-[#fff7df] text-[#b45309]" : "bg-[#eef2ff] text-[#4f46e5]";
  return <div className="rounded border border-[#e5e7eb] bg-white p-4"><div className="flex items-center justify-between"><p className="text-sm text-[#6b7280]">{title}</p><div className={`grid size-9 place-items-center rounded ${toneClass}`}><Icon size={18} /></div></div><p className="mt-3 text-2xl font-semibold">{value}</p></div>;
}

function ChartBox({ children }: { children: React.ReactElement }) {
  return <div className="h-72"><ResponsiveContainer>{children}</ResponsiveContainer></div>;
}
