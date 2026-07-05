import { useState } from "react";
import toast from "react-hot-toast";
import { Download } from "lucide-react";
import { Empty, ErrorState, Input, PageTitle, Panel, Select, Skeleton } from "../components/ui";
import { api } from "../lib/api";
import { money } from "../lib/format";

function yearStart() {
  return `${new Date().getFullYear()}-01-01`;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

export default function Reports() {
  const [filters, setFilters] = useState({ startDate: yearStart(), endDate: today(), granularity: "month" });
  const [periods, setPeriods] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [hasRun, setHasRun] = useState(false);

  async function run(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const exclusiveEnd = new Date(`${filters.endDate}T00:00:00.000Z`);
      exclusiveEnd.setUTCDate(exclusiveEnd.getUTCDate() + 1);
      const { data } = await api.get("/analytics/report", {
        params: { ...filters, endDate: exclusiveEnd.toISOString().slice(0, 10) }
      });
      setPeriods(data.periods);
      setHasRun(true);
    } catch (caught: any) {
      setError(caught.response?.data?.message || "Could not generate report");
    } finally {
      setLoading(false);
    }
  }

  function exportReport() {
    const header = ["period", "income", "expenses", "net", "savingsRate"];
    const csv = [header.join(","), ...periods.map((row) => header.map((key) => JSON.stringify(row[key] ?? "")).join(","))].join("\n");
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `rupeeflow-${filters.granularity}-report.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Report exported");
  }

  return (
    <div className="px-4 py-6 sm:px-6">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
        <PageTitle title="Reports" subtitle="Generate deterministic monthly, quarterly, or yearly cash-flow statements." />
        <button type="button" disabled={!periods.length} onClick={exportReport} className="mb-6 inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-40"><Download size={16} />Export report</button>
      </div>
      <Panel title="Report range">
        <form onSubmit={run} className="grid gap-3 md:grid-cols-4">
          <label className="text-sm font-bold text-slate-700">From<Input required type="date" className="mt-1 w-full" value={filters.startDate} onChange={(event) => setFilters({ ...filters, startDate: event.target.value })} /></label>
          <label className="text-sm font-bold text-slate-700">Through<Input required type="date" className="mt-1 w-full" value={filters.endDate} onChange={(event) => setFilters({ ...filters, endDate: event.target.value })} /></label>
          <label className="text-sm font-bold text-slate-700">Group by<Select className="mt-1 w-full" value={filters.granularity} onChange={(event) => setFilters({ ...filters, granularity: event.target.value })}><option value="month">Month</option><option value="quarter">Quarter</option><option value="year">Year</option></Select></label>
          <button disabled={loading} className="self-end rounded-lg bg-indigo-600 px-4 py-2 text-white disabled:opacity-50">{loading ? "Generating…" : "Generate report"}</button>
        </form>
      </Panel>
      <div className="mt-6">
        {error ? <ErrorState message={error} /> : loading ? <Skeleton className="h-64" /> : hasRun && !periods.length ? <Empty text="No transactions fall inside this report range." /> : periods.length > 0 && (
          <Panel title="Cash-flow statement">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="text-slate-500"><tr><th className="py-2">Period</th><th className="text-right">Income</th><th className="text-right">Expenses</th><th className="text-right">Net</th><th className="text-right">Savings rate</th></tr></thead>
                <tbody>{periods.map((row) => <tr key={row.period} className="border-t border-slate-100"><td className="py-3 font-bold">{row.period}</td><td className="text-right">{money(row.income, "INR")}</td><td className="text-right">{money(row.expenses, "INR")}</td><td className={`text-right font-bold ${row.net < 0 ? "text-red-600" : "text-emerald-700"}`}>{money(row.net, "INR")}</td><td className="text-right">{row.savingsRate}%</td></tr>)}</tbody>
              </table>
            </div>
          </Panel>
        )}
      </div>
    </div>
  );
}
