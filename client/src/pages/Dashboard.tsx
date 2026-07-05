import { useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertCircle, Check, CircleDollarSign, RefreshCw, Target, TrendingUp } from "lucide-react";
import { Empty, ErrorState, PageTitle, Panel, Skeleton } from "../components/ui";
import { useAsyncData } from "../hooks/useAsyncData";
import { getDashboard } from "../lib/financeApi";
import { money, monthInput, pct } from "../lib/format";

const colors = ["#4f46e5", "#16a34a", "#f59e0b", "#7c3aed", "#c2410c", "#4f46e5", "#be123c", "#65a30d"];

export default function Dashboard() {
  const [month, setMonth] = useState(monthInput());
  const { data, loading, error, reload } = useAsyncData(() => getDashboard(month), [month]);
  const overview = data?.overview;
  const summary = data?.summary || "";
  const nudges = data?.nudges || [];

  const currency = "INR";
  const totals = overview?.summary;

  return (
    <div className="px-4 py-6 sm:px-6">
      <div className="mb-6 flex flex-col justify-between gap-3 md:flex-row md:items-end">
        <PageTitle title="Dashboard" subtitle="Monthly income, expenses, trends, budgets, nudges, and recent activity." />
        <div className="flex items-center gap-2">
          <input type="month" value={month} onChange={(event) => setMonth(event.target.value)} className="rounded border border-[#d1d5db] bg-white px-3 py-2" />
          <button onClick={reload} aria-label="Refresh dashboard" className="grid size-10 place-items-center rounded border border-[#d1d5db] bg-white" title="Refresh"><RefreshCw size={18} className={loading ? "animate-spin" : ""} /></button>
        </div>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric title="Income" value={money(totals?.income || 0, currency)} detail={changeLabel(totals?.incomeChange)} icon={TrendingUp} tone="green" />
        <Metric title="Expenses" value={money(totals?.expenses || 0, currency)} detail={changeLabel(totals?.expenseChange)} icon={CircleDollarSign} tone="amber" />
        <Metric title="Net cash flow" value={money(totals?.net || 0, currency)} icon={Check} tone={(totals?.net || 0) >= 0 ? "green" : "red"} />
        <Metric title="Savings rate" value={pct(totals?.savingsRate || 0)} icon={Target} tone={(totals?.savingsRate || 0) >= 20 ? "green" : "amber"} />
      </section>

      {error ? (
        <div className="mt-6"><ErrorState message={error} retry={reload} /></div>
      ) : loading ? (
        <div className="mt-6 grid gap-4 md:grid-cols-2"><Skeleton className="h-64" /><Skeleton className="h-64" /></div>
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

          <div className="grid gap-3 md:grid-cols-[220px_1fr]">
            <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-4">
              <p className="text-sm font-bold text-indigo-700">Financial health</p>
              <p className="mt-1 text-3xl font-extrabold text-indigo-950">{overview?.financialHealth?.score ?? 0}<span className="text-base">/100</span></p>
              <p className="mt-1 text-xs font-bold capitalize text-indigo-700">{overview?.financialHealth?.status?.replace("_", " ")}</p>
            </div>
            <Panel title="Unusual spending">
              {overview?.unusualSpending?.length ? <div className="flex flex-wrap gap-2">{overview.unusualSpending.map((item) => <span key={item.category} className="rounded-full bg-amber-100 px-3 py-2 text-sm text-amber-900"><strong>{item.category}</strong> is {item.increasePercent}% above its 3-month average</span>)}</div> : <p className="text-sm text-slate-600">No category is more than 50% above its three-month average.</p>}
            </Panel>
          </div>

          <section className="grid gap-6 xl:grid-cols-3">
            <Panel title="Six-month cash flow">
              <ChartBox>
                <BarChart data={overview?.cashflow || []}>
                  <CartesianGrid stroke="#e5e7eb" />
                  <XAxis dataKey="month" />
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

          <section className="grid gap-6 lg:grid-cols-2">
            <Panel title="Budget intelligence">
              <div className="space-y-3">
                {overview?.budgetUsage?.slice(0, 6).map((budget) => (
                  <div key={budget._id} className="rounded-lg border border-slate-200 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-bold">{budget.category}</p>
                      <span className={`rounded-full px-2 py-1 text-xs font-bold ${budget.status === "over" ? "bg-red-100 text-red-700" : budget.status === "healthy" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-800"}`}>{budget.status.replace("_", " ")}</span>
                    </div>
                    <p className="mt-1 text-sm text-slate-600">{money(budget.remaining, currency)} remaining · projected {money(budget.projectedSpend, currency)}</p>
                    <div className="mt-2 h-2 overflow-hidden rounded bg-slate-100"><div className={`h-full ${budget.status === "over" ? "bg-red-500" : budget.status === "healthy" ? "bg-indigo-500" : "bg-amber-500"}`} style={{ width: `${Math.min(budget.percentUsed, 100)}%` }} /></div>
                  </div>
                ))}
                {!overview?.budgetUsage?.length && <Empty text="Set category budgets to see burn-rate warnings." />}
              </div>
            </Panel>
            <Panel title="Upcoming recurring payments">
              <div className="divide-y divide-slate-100">
                {overview?.upcomingRecurring?.map((item) => (
                  <div key={item._id} className="flex items-center justify-between gap-4 py-3">
                    <div><p className="font-bold">{item.merchant || item.category}</p><p className="text-sm text-slate-500">{item.nextDate.slice(0, 10)} · {item.category}</p></div>
                    <p className="font-bold">{money(item.amount, currency)}</p>
                  </div>
                ))}
                {!overview?.upcomingRecurring?.length && <Empty text="No active recurring transactions." />}
              </div>
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

function Metric({ title, value, detail, icon: Icon, tone }: { title: string; value: string; detail?: string; icon: any; tone: string }) {
  const toneClass = tone === "red" ? "bg-[#fff1f1] text-[#be123c]" : tone === "amber" ? "bg-[#fff7df] text-[#b45309]" : "bg-[#eef2ff] text-[#4f46e5]";
  return <div className="rounded border border-[#e5e7eb] bg-white p-4"><div className="flex items-center justify-between"><p className="text-sm text-[#6b7280]">{title}</p><div className={`grid size-9 place-items-center rounded ${toneClass}`}><Icon size={18} /></div></div><p className="mt-3 text-2xl font-semibold">{value}</p>{detail && <p className="mt-1 text-xs text-slate-500">{detail}</p>}</div>;
}

function ChartBox({ children }: { children: React.ReactElement }) {
  return <div className="h-72"><ResponsiveContainer>{children}</ResponsiveContainer></div>;
}

function changeLabel(value: number | null | undefined) {
  if (value === null) return "No previous-month baseline";
  if (value === undefined) return "";
  return `${value > 0 ? "+" : ""}${value}% vs previous month`;
}
