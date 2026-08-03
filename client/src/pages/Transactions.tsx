import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Download, FileUp, Pause, Pencil, Play, Sparkles, Trash2, X } from "lucide-react";
import { ConfirmDialog, Empty, Input, PageTitle, Panel, Select } from "../components/ui";
import CsvImportPanel from "../components/CsvImportPanel";
import { api } from "../lib/api";
import { getCategories } from "../lib/data";
import { money, todayInput } from "../lib/format";

const emptyForm = {
  type: "expense",
  amount: "",
  category: "Food",
  merchant: "",
  date: todayInput(),
  paymentMethod: "Card",
  note: "",
  isRecurring: false,
  recurringFrequency: "monthly"
};

const emptyFilters = {
  search: "",
  type: "",
  category: "",
  startDate: "",
  endDate: "",
  minAmount: "",
  maxAmount: "",
  transactionId: ""
};

export default function Transactions() {
  const [items, setItems] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [filters, setFilters] = useState(() => ({
    ...emptyFilters,
    transactionId: new URLSearchParams(window.location.search).get("transactionId") || ""
  }));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<any>(emptyForm);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [deleting, setDeleting] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [smartText, setSmartText] = useState("");
  const [smartLoading, setSmartLoading] = useState(false);
  const [smartResult, setSmartResult] = useState<any>(null);

  const categoryOptions = useMemo(() => {
    return categories.filter((category) => category.type === "both" || category.type === form.type);
  }, [categories, form.type]);

  async function load(nextFilters = filters, nextPage = page) {
    setLoading(true);
    try {
      const [txRes, cats] = await Promise.all([
        api.get("/transactions", { params: { limit: 20, page: nextPage, ...clean(nextFilters) } }),
        getCategories()
      ]);
      setItems(txRes.data.items);
      setPage(txRes.data.page);
      setPages(txRes.data.pages);
      setTotal(txRes.data.total);
      setCategories(cats);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load().catch(() => toast.error("Could not load transactions"));
  }, []);

  async function applyFilters(event: React.FormEvent) {
    event.preventDefault();
    await load(filters, 1);
  }

  async function clearFilters() {
    setFilters(emptyFilters);
    window.history.replaceState({}, "", window.location.pathname);
    await load(emptyFilters, 1);
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    const payload = {
      ...form,
      amount: Number(form.amount),
      date: form.date?.slice?.(0, 10) || form.date
    };

    try {
      if (editingId) await api.put(`/transactions/${editingId}`, payload);
      else await api.post("/transactions", payload, { headers: { "Idempotency-Key": crypto.randomUUID() } });
      toast.success(editingId ? "Transaction updated" : "Transaction added");
      resetForm();
      await load(filters, page);
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Could not save transaction");
    } finally {
      setSaving(false);
    }
  }

  async function fillFromDescription() {
    if (!smartText.trim()) return;
    setSmartLoading(true);
    try {
      const { data } = await api.post("/ai/categorize", { text: smartText.trim() });
      const eligibleCategories = categories.filter((category) => category.type === "both" || category.type === data.type);
      const category = eligibleCategories.find((item) => item.name.toLowerCase() === String(data.category).toLowerCase())?.name
        || eligibleCategories.find((item) => item.name === (data.type === "income" ? "Salary" : "Other"))?.name
        || eligibleCategories[0]?.name;
      setForm((current) => ({
        ...current,
        type: data.type,
        amount: data.amount || "",
        category,
        merchant: data.merchant === "Unknown merchant" ? "" : data.merchant,
        date: data.date || todayInput(),
        paymentMethod: data.paymentMethod,
        note: data.note || smartText
      }));
      setSmartResult(data);
      toast.success("Review the suggested fields, then save");
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || error.response?.data?.message || "Could not understand that transaction");
    } finally {
      setSmartLoading(false);
    }
  }

  async function remove() {
    if (!deleteTarget) return;
    const previous = items;
    setDeleting(true);
    setItems((current) => current.filter((item) => item._id !== deleteTarget._id));
    try {
      await api.delete(`/transactions/${deleteTarget._id}`);
      toast.success("Transaction deleted");
      if (editingId === deleteTarget._id) resetForm();
      setDeleteTarget(null);
      await load(filters, page);
    } catch {
      setItems(previous);
      toast.error("Could not delete transaction");
    } finally {
      setDeleting(false);
    }
  }

  async function exportCsv() {
    const { data } = await api.get("/transactions/export/csv", { responseType: "blob", params: clean(filters) });
    const url = URL.createObjectURL(data);
    const link = document.createElement("a");
    link.href = url;
    link.download = "rupeeflow-transactions.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  async function toggleRecurring(tx: any) {
    const status = tx.recurringStatus === "paused" ? "active" : "paused";
    setItems((current) => current.map((item) => item._id === tx._id ? { ...item, recurringStatus: status } : item));
    try {
      await api.patch(`/transactions/${tx._id}/recurring-status`, { status });
      toast.success(status === "paused" ? "Recurring schedule paused" : "Recurring schedule resumed");
    } catch {
      setItems((current) => current.map((item) => item._id === tx._id ? tx : item));
      toast.error("Could not update recurring schedule");
    }
  }

  function startEdit(tx: any) {
    setEditingId(tx._id);
    setForm({
      type: tx.type,
      amount: tx.amount,
      category: tx.category,
      merchant: tx.merchant || "",
      date: tx.date?.slice(0, 10),
      paymentMethod: tx.paymentMethod || "Card",
      note: tx.note || "",
      isRecurring: Boolean(tx.isRecurring),
      recurringFrequency: tx.recurringFrequency || "monthly"
    });
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
    setSmartText("");
    setSmartResult(null);
  }

  return (
    <div className="px-4 py-4 sm:px-6">
      <div className="mb-3 flex flex-col justify-between gap-3 md:flex-row md:items-end">
        <PageTitle title="Transactions" subtitle="Add naturally, import statements, review, filter, and export entries." />
        <div className="flex gap-2">
          <button type="button" onClick={() => setShowImport((value) => !value)} className="inline-flex items-center justify-center gap-2 rounded border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-bold text-indigo-700">
            <FileUp size={16} /> Import CSV
          </button>
          <button type="button" onClick={exportCsv} className="inline-flex items-center justify-center gap-2 rounded bg-[#111827] px-4 py-2 text-sm font-medium text-white">
            <Download size={16} /> Export CSV
          </button>
        </div>
      </div>

      {showImport && <div className="mb-4"><CsvImportPanel onClose={() => setShowImport(false)} onImported={() => load(filters, 1)} /></div>}

      <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
        <div>
          <Panel title={editingId ? "Edit transaction" : "Add transaction"} action={editingId && <button type="button" onClick={resetForm} className="grid size-8 place-items-center rounded hover:bg-[#eff6ff]" title="Cancel edit"><X size={16} /></button>}>
            <form onSubmit={save} className="grid gap-2">
              {!editingId && (
                <div className="mb-2 rounded-xl border border-indigo-100 bg-indigo-50 p-3">
                  <label className="mb-2 block text-xs font-extrabold uppercase tracking-wide text-indigo-700">Describe it naturally</label>
                  <div className="flex gap-2">
                    <Input value={smartText} maxLength={200} onChange={(event) => setSmartText(event.target.value)} placeholder="Paid ₹450 to Zomato via UPI yesterday" className="bg-white" />
                    <button type="button" disabled={smartLoading || !smartText.trim()} onClick={fillFromDescription} className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-indigo-600 px-3 text-sm font-bold text-white disabled:opacity-50">
                      <Sparkles size={15} /> {smartLoading ? "Reading…" : "Fill"}
                    </button>
                  </div>
                  {smartResult && (
                    <p className="mt-2 text-xs text-indigo-800">
                      {smartResult.confidence} confidence{smartResult.ambiguities?.length ? ` · Review: ${smartResult.ambiguities.join(", ")}` : " · All key fields detected"}
                    </p>
                  )}
                </div>
              )}
              <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value, category: e.target.value === "income" ? "Salary" : "Food" })}>
                <option value="expense">Expense</option>
                <option value="income">Income</option>
              </Select>
              <div className="grid grid-cols-2 gap-2">
                <Input required type="number" min="0.01" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="Amount" />
                <Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                  {categoryOptions.map((category) => <option key={category._id}>{category.name}</option>)}
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input required value={form.merchant} onChange={(e) => setForm({ ...form, merchant: e.target.value })} placeholder="Merchant" />
                <Input required type="date" value={form.date?.slice?.(0, 10) || form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Select value={form.paymentMethod} onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}>
                  <option>UPI</option>
                  <option>Card</option>
                  <option>Cash</option>
                  <option>Bank Transfer</option>
                  <option>Wallet</option>
                </Select>
                <Input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Note" />
              </div>
              <label className="flex items-center gap-2 text-sm text-[#374151]">
                <input type="checkbox" checked={form.isRecurring} onChange={(e) => setForm({ ...form, isRecurring: e.target.checked })} />
                Auto-add monthly as recurring
              </label>
              {form.isRecurring && (
                <Select aria-label="Recurring frequency" value={form.recurringFrequency} onChange={(e) => setForm({ ...form, recurringFrequency: e.target.value })}>
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                </Select>
              )}
              <button disabled={saving} className="rounded bg-[#4f46e5] px-4 py-2 font-medium text-white disabled:opacity-60">{saving ? "Saving…" : editingId ? "Save changes" : "Add transaction"}</button>
            </form>
          </Panel>
        </div>

        <Panel title="Transaction table">
          <form onSubmit={applyFilters} className="mb-3 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
            <Input placeholder="Keyword" value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} />
            <Select value={filters.type} onChange={(e) => setFilters({ ...filters, type: e.target.value })}>
              <option value="">All types</option>
              <option value="expense">Expense</option>
              <option value="income">Income</option>
            </Select>
            <Select value={filters.category} onChange={(e) => setFilters({ ...filters, category: e.target.value })}>
              <option value="">All categories</option>
              {categories.map((category) => <option key={category._id}>{category.name}</option>)}
            </Select>
            <Input aria-label="Start date" type="date" value={filters.startDate} onChange={(e) => setFilters({ ...filters, startDate: e.target.value })} />
            <Input aria-label="End date" type="date" value={filters.endDate} onChange={(e) => setFilters({ ...filters, endDate: e.target.value })} />
            <Input aria-label="Minimum amount" type="number" min="0" placeholder="Min amount" value={filters.minAmount} onChange={(e) => setFilters({ ...filters, minAmount: e.target.value })} />
            <Input aria-label="Maximum amount" type="number" min="0" placeholder="Max amount" value={filters.maxAmount} onChange={(e) => setFilters({ ...filters, maxAmount: e.target.value })} />
            <div className="flex gap-2">
              <button className="rounded bg-[#111827] px-3 py-2 text-white">Filter</button>
              <button type="button" onClick={clearFilters} className="rounded border border-[#d1d5db] px-3 py-2">Clear</button>
            </div>
          </form>

          <div className="max-h-[58vh] overflow-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="sticky top-0 bg-white text-[#6b7280]">
                <tr>
                  <th className="py-2">Date</th>
                  <th>Merchant</th>
                  <th>Category</th>
                  <th>Type</th>
                  <th>Mode</th>
                  <th>Recurring</th>
                  <th className="text-right">Amount</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((tx) => (
                  <tr key={tx._id} className="border-t border-[#e5e7eb]">
                    <td className="py-3">{tx.date.slice(0, 10)}</td>
                    <td>{tx.merchant || "Unlabeled"}</td>
                    <td>{tx.category}</td>
                    <td><span className="rounded bg-[#eff6ff] px-2 py-1 text-xs capitalize">{tx.type}</span></td>
                    <td>{tx.paymentMethod}</td>
                    <td>{tx.isRecurring ? tx.recurringStatus === "paused" ? "Paused" : `Yes · ${tx.recurringFrequency}` : tx.recurringTemplate ? "Generated" : "No"}</td>
                    <td className={`text-right font-medium ${tx.type === "income" ? "text-[#4f46e5]" : "text-[#b45309]"}`}>{money(tx.amount, "INR")}</td>
                    <td>
                      <div className="flex justify-end gap-2">
                        {tx.isRecurring && !tx.recurringTemplate && <button type="button" onClick={() => toggleRecurring(tx)} className="inline-flex items-center gap-1 rounded border border-[#d1d5db] px-2 py-1 text-slate-700">{tx.recurringStatus === "paused" ? <Play size={14} /> : <Pause size={14} />}{tx.recurringStatus === "paused" ? "Resume" : "Pause"}</button>}
                        <button type="button" onClick={() => startEdit(tx)} className="inline-flex items-center gap-1 rounded border border-[#d1d5db] px-2 py-1 text-[#4f46e5]">
                          <Pencil size={14} />
                          Edit
                        </button>
                        <button type="button" onClick={() => setDeleteTarget(tx)} className="inline-flex items-center gap-1 rounded border border-[#efcaca] px-2 py-1 text-[#be123c]">
                          <Trash2 size={14} />
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {loading && <div className="p-5 text-center text-sm text-[#6b7280]">Loading transactions...</div>}
            {!loading && !items.length && <Empty text="No matching transactions." />}
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3 text-sm text-slate-600">
            <p>{total} transaction{total === 1 ? "" : "s"} · Page {page} of {pages}</p>
            <div className="flex gap-2">
              <button type="button" disabled={page <= 1 || loading} onClick={() => load(filters, page - 1)} className="rounded border border-slate-300 px-3 py-1.5 disabled:opacity-40">Previous</button>
              <button type="button" disabled={page >= pages || loading} onClick={() => load(filters, page + 1)} className="rounded border border-slate-300 px-3 py-1.5 disabled:opacity-40">Next</button>
            </div>
          </div>
        </Panel>
      </div>
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete transaction?"
        description={`This permanently removes ${deleteTarget?.merchant || "this transaction"} from analytics and budget totals.`}
        onCancel={() => !deleting && setDeleteTarget(null)}
        onConfirm={remove}
        busy={deleting}
      />
    </div>
  );
}

function clean(obj: Record<string, string>) {
  return Object.fromEntries(Object.entries(obj).filter(([, value]) => value !== ""));
}
