import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Download, Pencil, Trash2, X } from "lucide-react";
import { Empty, Input, PageTitle, Panel, Select } from "../components/ui";
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
  isRecurring: false
};

const emptyFilters = {
  search: "",
  type: "",
  category: ""
};

export default function Transactions() {
  const [items, setItems] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [filters, setFilters] = useState(emptyFilters);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<any>(emptyForm);
  const [loading, setLoading] = useState(false);

  const categoryOptions = useMemo(() => {
    return categories.filter((category) => category.type === "both" || category.type === form.type);
  }, [categories, form.type]);

  async function load(nextFilters = filters) {
    setLoading(true);
    try {
      const [txRes, cats] = await Promise.all([
        api.get("/transactions", { params: { limit: 100, ...clean(nextFilters) } }),
        getCategories()
      ]);
      setItems(txRes.data.items);
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
    await load();
  }

  async function clearFilters() {
    setFilters(emptyFilters);
    await load(emptyFilters);
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    const payload = {
      ...form,
      amount: Number(form.amount),
      date: form.date?.slice?.(0, 10) || form.date,
      recurringFrequency: "monthly"
    };

    if (editingId) await api.put(`/transactions/${editingId}`, payload);
    else await api.post("/transactions", payload);

    toast.success(editingId ? "Transaction updated" : "Transaction added");
    resetForm();
    await load();
  }

  async function remove(id: string) {
    const ok = window.confirm("Delete this transaction?");
    if (!ok) return;
    await api.delete(`/transactions/${id}`);
    toast.success("Transaction deleted");
    if (editingId === id) resetForm();
    await load();
  }

  async function exportCsv() {
    const { data } = await api.get("/transactions/export/csv", { responseType: "blob" });
    const url = URL.createObjectURL(data);
    const link = document.createElement("a");
    link.href = url;
    link.download = "rupeeflow-transactions.csv";
    link.click();
    URL.revokeObjectURL(url);
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
      isRecurring: Boolean(tx.isRecurring)
    });
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
  }

  return (
    <div className="px-4 py-4 sm:px-6">
      <div className="mb-3 flex flex-col justify-between gap-3 md:flex-row md:items-end">
        <PageTitle title="Transactions" subtitle="Add, edit, delete, filter, mark recurring, and export entries." />
        <button type="button" onClick={exportCsv} className="inline-flex items-center justify-center gap-2 rounded bg-[#111827] px-4 py-2 text-sm font-medium text-white">
          <Download size={16} />
          Export CSV
        </button>
      </div>

      <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
        <div>
          <Panel title={editingId ? "Edit transaction" : "Add transaction"} action={editingId && <button type="button" onClick={resetForm} className="grid size-8 place-items-center rounded hover:bg-[#eff6ff]" title="Cancel edit"><X size={16} /></button>}>
            <form onSubmit={save} className="grid gap-2">
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
              <button className="rounded bg-[#4f46e5] px-4 py-2 font-medium text-white">{editingId ? "Save changes" : "Add transaction"}</button>
            </form>
          </Panel>
        </div>

        <Panel title="Transaction table">
          <form onSubmit={applyFilters} className="mb-3 grid gap-2 md:grid-cols-[minmax(180px,1fr)_140px_160px_auto]">
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
                    <td>{tx.isRecurring ? "Yes" : "No"}</td>
                    <td className={`text-right font-medium ${tx.type === "income" ? "text-[#4f46e5]" : "text-[#b45309]"}`}>{money(tx.amount, "INR")}</td>
                    <td>
                      <div className="flex justify-end gap-2">
                        <button type="button" onClick={() => startEdit(tx)} className="inline-flex items-center gap-1 rounded border border-[#d1d5db] px-2 py-1 text-[#4f46e5]">
                          <Pencil size={14} />
                          Edit
                        </button>
                        <button type="button" onClick={() => remove(tx._id)} className="inline-flex items-center gap-1 rounded border border-[#efcaca] px-2 py-1 text-[#be123c]">
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
        </Panel>
      </div>
    </div>
  );
}

function clean(obj: Record<string, string>) {
  return Object.fromEntries(Object.entries(obj).filter(([, value]) => value !== ""));
}
