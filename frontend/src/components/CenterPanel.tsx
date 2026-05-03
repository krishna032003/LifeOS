"use client";
import { useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Send, Loader2, Calendar, Brain, BarChart2, BookOpen, Zap, Clock,
  Sparkles, MessageSquare, ArrowRight, CornerDownRight,
} from "lucide-react";

interface ChatMessage { id: string; role: "user" | "ai"; text: string; }
interface Assignment { title?: string; dueDate?: { year: number; month: number; day: number }; courseName?: string; }
interface CenterPanelProps {
  chatHistory: ChatMessage[]; chatInput: string;
  setChatInput: (v: string) => void; onSubmit: (e?: React.FormEvent) => void;
  isThinking: boolean; finalAnswer: string; assignmentsData: Assignment[];
  totalFocusMinutes: number; onAction: (cmd: string, label: string) => void;
  onOpenTimetable: () => void; onOpenFocus: () => void; onOpenMaterials: () => void;
}

/* ─── Markdown renderer ─── */
const MD = {
  h1:     ({...p}) => <h1     className="text-[13px] font-bold text-white mt-3 mb-1.5 pb-1 border-b border-white/8" {...p} />,
  h2:     ({...p}) => <h2     className="text-[12px] font-semibold text-white/85 mt-3 mb-1" {...p} />,
  h3:     ({...p}) => <h3     className="text-[11px] font-semibold text-white/75 mt-2 mb-0.5" {...p} />,
  p:      ({...p}) => <p      className="text-[11px] text-white/50 leading-relaxed mb-2" {...p} />,
  ul:     ({...p}) => <ul     className="list-none pl-0 mb-2 space-y-1" {...p} />,
  ol:     ({...p}) => <ol     className="list-decimal pl-4 mb-2 space-y-0.5 text-[11px] text-white/50" {...p} />,
  li:     ({...p}) => <li     className="text-[11px] text-white/50 flex gap-1.5 leading-relaxed before:content-['▸'] before:text-emerald-400/50 before:text-[9px] before:mt-0.5" {...p} />,
  strong: ({...p}) => <strong className="font-semibold text-white/80" {...p} />,
  code: ({ className, children, ...p }: React.ComponentPropsWithoutRef<"code">) => {
    const block = /language-(\w+)/.exec(className || "");
    return block
      ? <pre className="border border-white/6 rounded-xl overflow-x-auto text-[10px] font-mono p-3 my-2" style={{ background: "#0a0b0f" }}><code className={className} {...p}>{children}</code></pre>
      : <code className="px-1.5 py-px rounded text-[10px] text-emerald-400 font-mono" style={{ background: "rgba(52,211,153,0.08)" }} {...p}>{children}</code>;
  },
};

/* ─── Command bar items ─── */
const CMDS = [
  { label: "Timetable",    icon: Clock,     action: "timetable",     accent: "hover:border-cyan-400/30 hover:text-cyan-300" },
  { label: "Auto-Schedule",icon: Calendar,  action: "auto_schedule", accent: "hover:border-blue-400/30 hover:text-blue-300" },
  { label: "Study RAG",   icon: Brain,     action: "materials",     accent: "hover:border-violet-400/30 hover:text-violet-300" },
  { label: "Weekly Review",icon: BarChart2, action: "weekly_review", accent: "hover:border-emerald-400/30 hover:text-emerald-300" },
  { label: "Study Topics", icon: BookOpen,  action: "study_today",   accent: "hover:border-amber-400/30 hover:text-amber-300" },
  { label: "Deep Work",   icon: Zap,       action: "focus",         accent: "hover:border-pink-400/30 hover:text-pink-300" },
];

/* ─── Empty workspace ─── */
function EmptyWorkspace({ onAction, onOpenTimetable, onOpenMaterials, onOpenFocus, assignmentsData, totalFocusMinutes }: {
  onAction: (c: string, l: string) => void;
  onOpenTimetable: () => void; onOpenMaterials: () => void; onOpenFocus: () => void;
  assignmentsData: Assignment[]; totalFocusMinutes: number;
}) {
  const next = assignmentsData[0];
  const CARDS = [
    { label: "Plan My Day",          desc: "Auto-schedule based on your tasks",   icon: Calendar, color: "from-blue-500/8 to-cyan-500/4",    border: "border-blue-400/12",   accent: "text-blue-300",   action: () => onAction("auto_schedule","Auto-Schedule My Day") },
    { label: "What to Study",        desc: "AI picks the best topic right now",   icon: BookOpen, color: "from-emerald-500/8 to-teal-500/4", border: "border-emerald-400/12",accent: "text-emerald-300",action: () => onAction("study_today","What Should I Study Today") },
    { label: "Smart Timetable",      desc: "Build a weekly AI-powered schedule",  icon: Clock,    color: "from-cyan-500/8 to-sky-500/4",     border: "border-cyan-400/12",   accent: "text-cyan-300",   action: onOpenTimetable },
    { label: "Study RAG",            desc: "Ask questions about your notes",      icon: Brain,    color: "from-violet-500/8 to-purple-500/4", border: "border-violet-400/12", accent: "text-violet-300", action: onOpenMaterials },
    { label: "Weekly Review",        desc: "AI analysis of your productivity",    icon: BarChart2,color: "from-amber-500/8 to-orange-500/4", border: "border-amber-400/12",  accent: "text-amber-300",  action: () => onAction("weekly_review","Generate Weekly Review") },
    { label: "Deep Work Session",    desc: "Start a focus timer with blockers",   icon: Zap,      color: "from-pink-500/8 to-rose-500/4",    border: "border-pink-400/12",   accent: "text-pink-300",   action: onOpenFocus },
  ];

  return (
    <div className="flex-1 overflow-y-auto px-5 py-5">
      {/* Status strip */}
      <div className="grid grid-cols-3 gap-2 mb-5">
        {[
          {
            label: "Next Deadline",
            value: next?.title ?? "None synced",
            sub: next?.courseName ?? "Sync Classroom →",
            accent: "from-amber-500/6 to-transparent",
            border: "border-amber-400/10",
          },
          {
            label: "Focus Logged",
            value: `${totalFocusMinutes}`,
            sub: "minutes deep work",
            accent: "from-emerald-500/6 to-transparent",
            border: "border-emerald-400/10",
          },
          {
            label: "AI Status",
            value: "Ready",
            sub: "Gemini 2.5 connected",
            accent: "from-blue-500/6 to-transparent",
            border: "border-blue-400/10",
          },
        ].map(s => (
          <div key={s.label}
            className={`p-3 rounded-xl border bg-gradient-to-br ${s.accent} ${s.border}`}>
            <p className="text-[8px] font-bold uppercase tracking-wider text-white/25 mb-1.5">{s.label}</p>
            <p className="text-[12px] font-bold text-white/75 truncate leading-tight">{s.value}</p>
            <p className="text-[9px] text-white/25 truncate mt-0.5">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Action grid */}
      <p className="text-[9px] font-bold tracking-widest text-white/15 uppercase mb-3">Quick Actions</p>
      <div className="grid grid-cols-2 gap-2 mb-5">
        {CARDS.map(c => {
          const Icon = c.icon;
          return (
            <button key={c.label} onClick={c.action}
              className={`flex items-start gap-3 p-3.5 rounded-xl border bg-gradient-to-br text-left group transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] ${c.color} ${c.border} hover:border-opacity-30`}>
              <div className={`w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center shrink-0 group-hover:bg-white/8 transition-colors`}>
                <Icon size={13} className={`${c.accent} opacity-70 group-hover:opacity-100 transition-opacity`} />
              </div>
              <div>
                <p className="text-[11px] font-semibold text-white/65 group-hover:text-white/85 transition-colors leading-tight">{c.label}</p>
                <p className="text-[9px] text-white/25 mt-0.5 leading-tight">{c.desc}</p>
              </div>
              <ArrowRight size={10} className={`ml-auto mt-1 ${c.accent} opacity-0 group-hover:opacity-50 transition-opacity shrink-0`} />
            </button>
          );
        })}
      </div>

      {/* Chat hint */}
      <div className="flex items-center gap-3 p-3 rounded-xl border border-white/5"
        style={{ background: "linear-gradient(135deg,rgba(255,255,255,0.015),transparent)" }}>
        <MessageSquare size={13} className="text-white/15 shrink-0" />
        <div>
          <p className="text-[10px] text-white/35 font-medium">Or just chat below</p>
          <p className="text-[9px] text-white/20 mt-0.5">Ask LifeOS anything — schedule, study, review, or focus.</p>
        </div>
        <CornerDownRight size={11} className="text-white/15 ml-auto shrink-0" />
      </div>
    </div>
  );
}

/* ─── Main component ─── */
export default function CenterPanel({
  chatHistory, chatInput, setChatInput, onSubmit, isThinking,
  finalAnswer, assignmentsData, totalFocusMinutes,
  onAction, onOpenTimetable, onOpenFocus, onOpenMaterials,
}: CenterPanelProps) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatHistory, finalAnswer]);

  const handleChip = (action: string) => {
    if (action === "timetable")    return onOpenTimetable();
    if (action === "focus")        return onOpenFocus();
    if (action === "materials")    return onOpenMaterials();
    if (action === "auto_schedule")return onAction("auto_schedule","Auto-Schedule My Day");
    if (action === "weekly_review")return onAction("weekly_review","Generate Weekly Review");
    if (action === "study_today")  return onAction("study_today","What Should I Study Today");
  };

  const isEmpty = chatHistory.length === 0 && !finalAnswer;

  return (
    <div className="flex flex-col h-full min-h-0">

      {/* ── Content area ── */}
      {isEmpty ? (
        <EmptyWorkspace
          onAction={onAction} onOpenTimetable={onOpenTimetable}
          onOpenMaterials={onOpenMaterials} onOpenFocus={onOpenFocus}
          assignmentsData={assignmentsData} totalFocusMinutes={totalFocusMinutes}
        />
      ) : (
        <div className="flex-1 overflow-y-auto min-h-0 px-4 py-4 space-y-3">

          {/* Final answer panel */}
          <AnimatePresence>
            {finalAnswer && (
              <motion.div key="ans" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="rounded-2xl overflow-hidden border border-emerald-400/15"
                style={{ background: "linear-gradient(135deg,rgba(16,185,129,0.06),rgba(6,182,212,0.03))" }}>
                {/* header */}
                <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/5"
                  style={{ background: "rgba(16,185,129,0.05)" }}>
                  <Sparkles size={11} className="text-emerald-400" />
                  <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-widest">LifeOS Response</span>
                  <div className="ml-auto flex items-center gap-1">
                    <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-[8px] text-emerald-400/50">Live</span>
                  </div>
                </div>
                <div className="px-4 py-3">
                  <ReactMarkdown remarkPlugins={[remarkGfm]} components={MD}>{finalAnswer}</ReactMarkdown>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Chat history */}
          {chatHistory.map(msg => (
            <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[78%] px-4 py-2.5 rounded-2xl text-[11px] leading-relaxed ${
                msg.role === "user"
                  ? "rounded-br-sm border border-white/8 text-white/70"
                  : "rounded-bl-sm border border-white/5 text-white/50"
              }`}
              style={msg.role === "user"
                ? { background: "linear-gradient(135deg,rgba(255,255,255,0.07),rgba(255,255,255,0.04))" }
                : { background: "linear-gradient(135deg,#111317,#0f1014)" }}>
                {msg.role === "ai" && !msg.text
                  ? <div className="flex gap-1 items-center">
                      <Loader2 size={11} className="animate-spin text-emerald-400" />
                      <span className="text-[10px] text-white/25">Thinking…</span>
                    </div>
                  : msg.role === "ai"
                    ? <ReactMarkdown remarkPlugins={[remarkGfm]} components={MD}>{msg.text}</ReactMarkdown>
                    : <p>{msg.text}</p>
                }
              </div>
            </div>
          ))}
          <div ref={endRef} />
        </div>
      )}

      {/* ── Input zone ── */}
      <div className="flex-shrink-0 border-t border-white/5"
        style={{ background: "linear-gradient(180deg,#0d0e13,#0b0c10)" }}>

        {/* Text input */}
        <div className="px-4 pt-3 pb-2">
          <form onSubmit={onSubmit} className="flex items-end gap-2">
            <div className="flex-1 rounded-xl overflow-hidden border border-white/7 transition-all duration-200 focus-within:border-emerald-400/25"
              style={{ background: "linear-gradient(135deg,#111419,#0f1015)" }}>
              <textarea
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSubmit(); } }}
                disabled={isThinking}
                placeholder="Message LifeOS…   (Shift+Enter for newline)"
                rows={1}
                className="w-full bg-transparent text-white/70 px-4 py-2.5 outline-none resize-none text-[11px] placeholder-white/15 disabled:opacity-40 min-h-[42px] max-h-[100px]"
              />
            </div>
            <button type="submit" disabled={isThinking || !chatInput.trim()}
              className="h-[42px] w-[42px] flex-shrink-0 rounded-xl flex items-center justify-center disabled:opacity-30 disabled:grayscale transition-all active:scale-95 hover:scale-105"
              style={{ background: "linear-gradient(135deg,#34d399,#0ea5e9)" }}>
              {isThinking ? <Loader2 size={14} className="animate-spin text-black" /> : <Send size={13} className="text-black" />}
            </button>
          </form>
        </div>

        {/* Command bar */}
        <div className="px-4 pb-3 flex gap-1.5 overflow-x-auto scrollbar-none">
          {CMDS.map(c => {
            const Icon = c.icon;
            return (
              <button key={c.action} disabled={isThinking} onClick={() => handleChip(c.action)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-white/6 text-white/30 shrink-0 group transition-all duration-150 hover:border-opacity-100 ${c.accent} disabled:opacity-20`}
                style={{ background: "rgba(255,255,255,0.02)" }}>
                <Icon size={10} className="opacity-50 group-hover:opacity-80 transition-opacity" />
                <span className="text-[10px] font-medium whitespace-nowrap">{c.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
