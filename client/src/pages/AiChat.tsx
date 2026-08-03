import { useState } from "react";
import toast from "react-hot-toast";
import { Bot, Calculator, ExternalLink, Send } from "lucide-react";
import { Link } from "react-router-dom";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Empty, Input } from "../components/ui";
import { api } from "../lib/api";
import { money } from "../lib/format";

type Evidence = {
  kind: "metric" | "transaction";
  label: string;
  value: number;
  transactionId?: string;
  date?: string;
  category?: string;
  merchant?: string;
  type?: "income" | "expense";
};

type Calculation = { label: string; expression: string; result: number; unit?: string };
type Message = {
  role: "user" | "assistant";
  text: string;
  chart?: Array<{ label: string; value: number }>;
  chartTitle?: string;
  evidence?: Evidence[];
  calculations?: Calculation[];
  suggestedQuestions?: string[];
  disclaimer?: string;
  confidence?: "high" | "medium" | "low";
};

const starterQuestions = [
  "How much did I spend on food this month?",
  "Which budget is most at risk?",
  "What changed from last month?"
];

export default function AiChat() {
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", text: "Ask about your spending, budgets, trends, or recent transactions. Every number will be backed by your tracked data.", suggestedQuestions: starterQuestions }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  async function ask(question: string) {
    const cleanQuestion = question.trim();
    if (!cleanQuestion || loading) return;
    setInput("");
    setMessages((previous) => [...previous, { role: "user", text: cleanQuestion }]);
    setLoading(true);
    try {
      const history = messages.slice(-8).map((message) => ({ role: message.role, text: message.text }));
      const { data } = await api.post("/ai/chat", { message: cleanQuestion, history });
      setMessages((previous) => [...previous, {
        role: "assistant",
        text: data.answer,
        chart: data.chart,
        chartTitle: data.chartTitle,
        evidence: data.evidence,
        calculations: data.calculations,
        suggestedQuestions: data.suggestedQuestions,
        disclaimer: data.disclaimer,
        confidence: data.confidence
      }]);
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || error.response?.data?.message || "AI assistant could not answer");
    } finally {
      setLoading(false);
    }
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    void ask(input);
  }

  return (
    <div className="px-4 py-4 sm:px-6">
      <section className="flex h-[calc(100vh-150px)] flex-col rounded-2xl border border-white/80 bg-white shadow-[0_18px_50px_rgba(15,23,42,0.1)] ring-1 ring-slate-900/5 lg:h-[calc(100vh-106px)]">
        <div className="border-b border-[#e2e8f0] px-4 py-3">
          <h2 className="font-extrabold text-[#111827]">Explainable finance copilot</h2>
          <p className="text-sm font-medium text-[#64748b]">Answers use read-only finance tools and link back to supporting transactions.</p>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-[#f8fafc] p-4" aria-live="polite">
          {messages.map((message, index) => (
            <div key={index} className={`max-w-3xl rounded-2xl p-3 shadow-sm ${message.role === "user" ? "ml-auto bg-[#4f46e5] text-white shadow-indigo-200" : "border border-[#e2e8f0] bg-white text-[#111827] shadow-slate-200/70"}`}>
              <div className="flex items-start gap-2">
                {message.role === "assistant" && <Bot size={18} className="mt-0.5 shrink-0 text-[#4f46e5]" />}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="text-sm font-medium leading-6">{message.text}</p>
                    {message.confidence && <span className={`rounded-full px-2 py-1 text-[10px] font-extrabold uppercase ${message.confidence === "high" ? "bg-emerald-100 text-emerald-700" : message.confidence === "low" ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-600"}`}>{message.confidence} confidence</span>}
                  </div>

                  {message.chart?.length ? (
                    <div className="mt-3 h-48">
                      {message.chartTitle && <p className="mb-2 text-xs font-bold text-[#64748b]">{message.chartTitle}</p>}
                      <ResponsiveContainer>
                        <BarChart data={message.chart}>
                          <XAxis dataKey="label" />
                          <YAxis tickFormatter={(value) => money(value, "INR")} width={75} />
                          <Tooltip formatter={(value) => money(String(value), "INR")} />
                          <Bar dataKey="value" fill="#4f46e5" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : null}

                  {message.calculations?.length ? (
                    <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <p className="mb-2 flex items-center gap-1 text-xs font-extrabold uppercase tracking-wide text-slate-500"><Calculator size={13} /> Calculation</p>
                      {message.calculations.map((calculation, calculationIndex) => (
                        <div key={calculationIndex} className="flex flex-wrap items-center justify-between gap-2 text-xs">
                          <span><strong>{calculation.label}:</strong> {calculation.expression}</span>
                          <strong>{calculation.unit === "%" ? `${calculation.result}%` : money(calculation.result)}</strong>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {message.evidence?.length ? (
                    <div className="mt-3">
                      <p className="mb-2 text-xs font-extrabold uppercase tracking-wide text-slate-500">Evidence</p>
                      <div className="flex flex-wrap gap-2">
                        {message.evidence.map((item, evidenceIndex) => item.kind === "transaction" && item.transactionId ? (
                          <Link key={`${item.transactionId}-${evidenceIndex}`} to={`/transactions?transactionId=${item.transactionId}`} className="group rounded-lg border border-indigo-100 bg-indigo-50 px-2.5 py-2 text-xs text-indigo-800 hover:border-indigo-300">
                            <span className="flex items-center gap-1 font-extrabold">{item.merchant || item.label}<ExternalLink size={11} className="opacity-60 group-hover:opacity-100" /></span>
                            <span>{item.date} · {item.category} · {money(item.value)}</span>
                          </Link>
                        ) : (
                          <span key={`metric-${evidenceIndex}`} className="rounded-full bg-slate-100 px-2.5 py-1.5 text-xs font-bold text-slate-700">{item.label}: {money(item.value)}</span>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {message.suggestedQuestions?.length ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {message.suggestedQuestions.map((question) => <button type="button" key={question} disabled={loading} onClick={() => ask(question)} className="rounded-full border border-indigo-200 bg-white px-3 py-1.5 text-xs font-bold text-indigo-700 hover:bg-indigo-50 disabled:opacity-50">{question}</button>)}
                    </div>
                  ) : null}
                  {message.disclaimer && <p className="mt-3 border-t border-slate-100 pt-2 text-xs text-slate-500">{message.disclaimer}</p>}
                </div>
              </div>
            </div>
          ))}
          {loading && <Empty text="Checking your finance data…" />}
        </div>

        <form onSubmit={submit} className="flex gap-2 border-t border-[#e2e8f0] bg-white p-3">
          <Input value={input} onChange={(event) => setInput(event.target.value)} placeholder="How much did I spend on food this month?" />
          <button disabled={loading || !input.trim()} aria-label="Send question" className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#4f46e5] text-white shadow-lg shadow-indigo-200 transition hover:bg-[#4338ca] disabled:opacity-50" title="Send"><Send size={18} /></button>
        </form>
      </section>
    </div>
  );
}
