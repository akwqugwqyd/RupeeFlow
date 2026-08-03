import { useState } from "react";
import toast from "react-hot-toast";
import { FileUp, RefreshCw, X } from "lucide-react";
import { api } from "../lib/api";
import { money } from "../lib/format";
import { Empty, Panel, Select } from "./ui";

type MappingKey = "date" | "merchant" | "amount" | "debit" | "credit" | "type" | "category" | "paymentMethod" | "note";
type Mapping = Partial<Record<MappingKey, string>>;
type Candidate = {
  rowNumber: number;
  transaction: null | {
    type: "income" | "expense";
    amount: number;
    category: string;
    merchant: string;
    note: string;
    date: string;
    paymentMethod: string;
  };
  errors: string[];
  duplicate: boolean;
  duplicateReason?: "file" | "account";
};
type Preview = {
  headers: string[];
  mapping: Mapping;
  candidates: Candidate[];
  truncated: boolean;
  summary: { total: number; invalid: number; duplicates: number; ready: number };
};

const fields: Array<{ key: MappingKey; label: string; required?: boolean }> = [
  { key: "date", label: "Date", required: true },
  { key: "merchant", label: "Merchant / narration", required: true },
  { key: "amount", label: "Single amount" },
  { key: "debit", label: "Debit / withdrawal" },
  { key: "credit", label: "Credit / deposit" },
  { key: "type", label: "Income / expense type" },
  { key: "category", label: "Category" },
  { key: "paymentMethod", label: "Payment method" },
  { key: "note", label: "Note" }
];

export default function CsvImportPanel({ onClose, onImported }: { onClose: () => void; onImported: () => Promise<void> }) {
  const [csv, setCsv] = useState("");
  const [fileName, setFileName] = useState("");
  const [mapping, setMapping] = useState<Mapping>({});
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);

  async function chooseFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 200_000) {
      toast.error("Choose a CSV smaller than 200 KB (up to roughly 500 rows)");
      event.target.value = "";
      return;
    }
    const text = await file.text();
    setCsv(text);
    setFileName(file.name);
    await requestPreview(text);
  }

  async function requestPreview(nextCsv = csv, nextMapping?: Mapping) {
    if (!nextCsv) return;
    setLoading(true);
    try {
      const { data } = await api.post<Preview>("/transactions/import/preview", {
        csv: nextCsv,
        ...(nextMapping && { mapping: nextMapping })
      });
      setPreview(data);
      setMapping(data.mapping);
    } catch (error: any) {
      setPreview(null);
      toast.error(error.response?.data?.error?.message || error.response?.data?.message || "Could not read this CSV");
    } finally {
      setLoading(false);
    }
  }

  async function commit() {
    if (!preview) return;
    const transactions = preview.candidates
      .filter((candidate) => candidate.transaction && !candidate.duplicate && !candidate.errors.length)
      .map((candidate) => candidate.transaction);
    if (!transactions.length) return;
    setImporting(true);
    try {
      const { data } = await api.post("/transactions/import/commit", { transactions });
      toast.success(`Imported ${data.imported} transaction${data.imported === 1 ? "" : "s"}${data.skipped ? `; skipped ${data.skipped}` : ""}`);
      await onImported();
      onClose();
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || error.response?.data?.message || "Could not import transactions");
    } finally {
      setImporting(false);
    }
  }

  return (
    <Panel title="Import a bank statement" action={<button type="button" onClick={onClose} aria-label="Close import" className="grid size-8 place-items-center rounded-lg hover:bg-slate-100"><X size={17} /></button>}>
      <div className="space-y-4">
        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-indigo-200 bg-indigo-50 px-4 py-5 text-sm font-bold text-indigo-700 hover:border-indigo-400">
          <FileUp size={19} />
          {fileName || "Choose a CSV statement"}
          <input type="file" accept=".csv,text/csv" onChange={chooseFile} className="sr-only" />
        </label>

        {preview && (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {fields.map((field) => (
                <label key={field.key} className="grid gap-1 text-xs font-bold text-slate-600">
                  {field.label}{field.required ? " *" : ""}
                  <Select value={mapping[field.key] || ""} onChange={(event) => setMapping((current) => ({ ...current, [field.key]: event.target.value }))}>
                    <option value="">Not mapped</option>
                    {preview.headers.map((header) => <option key={header} value={header}>{header}</option>)}
                  </Select>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" disabled={loading} onClick={() => requestPreview(csv, mapping)} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-bold disabled:opacity-50">
                <RefreshCw size={15} className={loading ? "animate-spin" : ""} /> Apply mapping
              </button>
              <p className="text-sm text-slate-600">
                {preview.summary.ready} ready · {preview.summary.duplicates} duplicate · {preview.summary.invalid} invalid
              </p>
              {preview.truncated && <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-bold text-amber-800">First 500 rows shown</span>}
            </div>

            <div className="max-h-72 overflow-auto rounded-xl border border-slate-200">
              <table className="w-full min-w-[760px] text-left text-xs">
                <thead className="sticky top-0 bg-slate-50 text-slate-500"><tr><th className="p-2">Row</th><th>Date</th><th>Merchant</th><th>Type</th><th>Category</th><th className="text-right">Amount</th><th className="px-2">Status</th></tr></thead>
                <tbody>
                  {preview.candidates.map((candidate) => (
                    <tr key={candidate.rowNumber} className="border-t border-slate-100">
                      <td className="p-2">{candidate.rowNumber}</td>
                      <td>{candidate.transaction?.date || "—"}</td>
                      <td className="max-w-52 truncate">{candidate.transaction?.merchant || "—"}</td>
                      <td className="capitalize">{candidate.transaction?.type || "—"}</td>
                      <td>{candidate.transaction?.category || "—"}</td>
                      <td className="text-right">{candidate.transaction ? money(candidate.transaction.amount) : "—"}</td>
                      <td className="px-2">
                        {candidate.errors.length ? <span className="font-bold text-red-600" title={candidate.errors.join(", ")}>Invalid</span>
                          : candidate.duplicate ? <span className="font-bold text-amber-700">Duplicate ({candidate.duplicateReason === "file" ? "file" : "account"})</span>
                            : <span className="font-bold text-emerald-700">Ready</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end">
              <button type="button" onClick={commit} disabled={importing || preview.summary.ready === 0} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
                {importing ? "Importing…" : `Import ${preview.summary.ready} transaction${preview.summary.ready === 1 ? "" : "s"}`}
              </button>
            </div>
          </>
        )}
        {!preview && loading && <Empty text="Reading and validating your statement…" />}
        {!preview && !loading && <p className="text-center text-xs text-slate-500">Supports quoted CSV values, DD/MM/YYYY dates, and separate debit/credit columns. Nothing is saved until you confirm.</p>}
      </div>
    </Panel>
  );
}
