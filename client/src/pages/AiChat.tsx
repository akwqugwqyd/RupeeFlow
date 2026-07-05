import { useState } from "react";
import toast from "react-hot-toast";
import { Bot, Send } from "lucide-react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Empty, Input } from "../components/ui";
import { api } from "../lib/api";
import { money } from "../lib/format";

export default function AiChat() {
  const [messages, setMessages] = useState<any[]>([
    {
      role: "assistant",
      text: "Ask me things like: How much did I spend on food this month, which budget is risky, or what changed from last month?"
    }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;
    const question = input;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", text: question }]);
    setLoading(true);
    try {
      const history = messages.slice(-8).map((msg) => ({ role: msg.role, text: msg.text }));
      const { data } = await api.post("/ai/chat", { message: question, history });
      setMessages((prev) => [...prev, { role: "assistant", text: data.answer, chart: data.chart, chartTitle: data.chartTitle, evidence: data.evidence, disclaimer: data.disclaimer, mode: data.mode }]);
    } catch (error: any) {
      toast.error(error.response?.data?.message || "AI assistant could not answer");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="px-4 py-4 sm:px-6">
      <section className="flex h-[calc(100vh-150px)] flex-col rounded-2xl border border-white/80 bg-white shadow-[0_18px_50px_rgba(15,23,42,0.1)] ring-1 ring-slate-900/5 lg:h-[calc(100vh-106px)]">
        <div className="border-b border-[#e2e8f0] px-4 py-3">
          <h2 className="font-extrabold text-[#111827]">Conversation</h2>
          <p className="text-sm font-medium text-[#64748b]">Ask questions about spending, budgets, trends, and recent transactions.</p>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-[#f8fafc] p-4" aria-live="polite">
          {messages.map((msg, index) => (
            <div key={index} className={`max-w-3xl rounded-2xl p-3 shadow-sm ${msg.role === "user" ? "ml-auto bg-[#4f46e5] text-white shadow-indigo-200" : "border border-[#e2e8f0] bg-white text-[#111827] shadow-slate-200/70"}`}>
              <div className="flex items-start gap-2">
                {msg.role === "assistant" && <Bot size={18} className="mt-0.5 text-[#4f46e5]" />}
                <p className="text-sm font-medium leading-6">{msg.text}</p>
              </div>
              {msg.chart?.length > 0 && (
                <div className="mt-3 h-48">
                  {msg.chartTitle && <p className="mb-2 text-xs font-bold text-[#64748b]">{msg.chartTitle}</p>}
                  <ResponsiveContainer>
                    <BarChart data={msg.chart}>
                      <XAxis dataKey="label" />
                      <YAxis tickFormatter={(v) => money(v, "INR")} width={75} />
                      <Tooltip formatter={(v) => money(String(v), "INR")} />
                      <Bar dataKey="value" fill="#4f46e5" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
              {msg.evidence?.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {msg.evidence.map((item: any, evidenceIndex: number) => <span key={evidenceIndex} className="rounded-full bg-indigo-50 px-2 py-1 text-xs font-bold text-indigo-700">{item.label}: {money(item.value, "INR")}</span>)}
                </div>
              )}
              {msg.disclaimer && <p className="mt-3 border-t border-slate-100 pt-2 text-xs text-slate-500">{msg.disclaimer}</p>}
            </div>
          ))}
          {loading && <Empty text="Thinking through your transactions..." />}
        </div>

        <form onSubmit={send} className="flex gap-2 border-t border-[#e2e8f0] bg-white p-3">
          <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder="How much did I spend on food this month?" />
          <button disabled={loading || !input.trim()} aria-label="Send question" className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#4f46e5] text-white shadow-lg shadow-indigo-200 transition hover:bg-[#4338ca] disabled:opacity-50" title="Send"><Send size={18} /></button>
        </form>
      </section>
    </div>
  );
}
