"use client";
import { useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Send, Loader2, Calendar, Brain, BarChart2, BookOpen, Zap, Clock,
  Sparkles,
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
  h1:     ({...p}) => <h1     style={{ fontFamily: "'Instrument Serif', serif", fontSize: 20, color: 'rgba(255,255,255,0.9)' }} className="mt-3 mb-1.5 pb-1 border-b border-white/[0.07]" {...p} />,
  h2:     ({...p}) => <h2     style={{ fontFamily: "'Instrument Serif', serif", fontSize: 17, color: 'rgba(255,255,255,0.8)' }} className="mt-3 mb-1" {...p} />,
  h3:     ({...p}) => <h3     className="text-[12px] font-medium text-white/65 mt-2 mb-0.5" {...p} />,
  p:      ({...p}) => <p      style={{ fontSize: 14, color: 'rgba(255,255,255,0.58)', fontWeight: 300, lineHeight: 1.75 }} className="mb-2" {...p} />,
  ul:     ({...p}) => <ul     className="list-none pl-0 mb-2 space-y-1" {...p} />,
  ol:     ({...p}) => <ol     className="list-decimal pl-4 mb-2 space-y-0.5 text-[13px] text-white/52 font-light" {...p} />,
  li:     ({...p}) => <li     style={{ fontSize: 14, color: 'rgba(255,255,255,0.55)' }} className="flex gap-1.5 leading-relaxed before:content-['▸'] before:text-emerald-400/50 before:text-[9px] before:mt-0.5" {...p} />,
  strong: ({...p}) => <strong style={{ fontWeight: 500, color: 'rgba(255,255,255,0.82)' }} {...p} />,
  code: ({ className, children, ...p }: React.ComponentPropsWithoutRef<"code">) => {
    const block = /language-(\w+)/.exec(className || "");
    return block
      ? <pre className="border border-white/[0.07] rounded-xl overflow-x-auto text-[11px] font-mono p-3 my-2 bg-white/[0.04]"><code className={className} {...p}>{children}</code></pre>
      : <code style={{ fontSize: 12, color: 'rgba(52,211,153,0.9)', background: 'rgba(52,211,153,0.08)', padding: '2px 7px', borderRadius: 5 }} className="font-mono" {...p}>{children}</code>;
  },
};

/* ─── Command chips ─── */
const CMDS = [
  { label: "Timetable",     icon: Clock,     action: "timetable" },
  { label: "Auto-Schedule", icon: Calendar,  action: "auto_schedule" },
  { label: "Study RAG",     icon: Brain,     action: "materials" },
  { label: "Weekly Review", icon: BarChart2, action: "weekly_review" },
  { label: "Study Topics",  icon: BookOpen,  action: "study_today" },
  { label: "Deep Work",     icon: Zap,       action: "focus" },
];

/* ─── Quick action cards for empty state ─── */
const CARDS = [
  { label: "Plan My Day",       desc: "Auto-schedule tasks & classes",  icon: Calendar, action: "auto_schedule",cmd: "Auto-Schedule My Day" },
  { label: "What to Study",     desc: "AI picks the best topic now",    icon: BookOpen, action: "study_today",  cmd: "What Should I Study Today" },
  { label: "Smart Timetable",   desc: "Build a weekly AI schedule",     icon: Clock,    action: "timetable",    cmd: "" },
  { label: "Study RAG",         desc: "Ask questions about your notes", icon: Brain,    action: "materials",    cmd: "" },
];

/* ─── Empty workspace ─── */
function EmptyWorkspace({ onAction, onOpenTimetable, onOpenMaterials, onOpenFocus, assignmentsData, totalFocusMinutes }: {
  onAction: (c: string, l: string) => void;
  onOpenTimetable: () => void; onOpenMaterials: () => void; onOpenFocus: () => void;
  assignmentsData: Assignment[]; totalFocusMinutes: number;
}) {
  const next = assignmentsData[0];

  const handleCard = (card: typeof CARDS[0]) => {
    if (card.action === "timetable")    return onOpenTimetable();
    if (card.action === "materials")    return onOpenMaterials();
    if (card.action === "focus")        return onOpenFocus();
    if (card.cmd) return onAction(card.action, card.cmd);
  };

  return (
    <div className="flex-1 overflow-y-auto px-[18px] pb-4 scrollbar-hidden">
      
      {/* Hero text strip */}
      <div style={{ textAlign: 'center', padding: '28px 24px 20px' }}>
        <p style={{ 
          fontFamily: "'Instrument Serif', serif",
          fontSize: 38, fontWeight: 400, 
          color: 'rgba(255,255,255,0.88)',
          lineHeight: 1.05, letterSpacing: '-1px',
          marginBottom: 8
        }}>
          Your mind,{' '}
          <em style={{ fontStyle: 'normal', color: 'rgba(255,255,255,0.28)' }}>finally</em>
          {' '}in order.
        </p>
        <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.32)', fontWeight: 300, lineHeight: 1.7, maxWidth: 380, margin: '0 auto' }}>
          One OS for your study, schedule, focus, and reflection.
        </p>
      </div>

      {/* Metrics row */}
      <div className="grid grid-cols-3 gap-2.5 mb-5">
        {[
          { label: "Next Deadline", value: next?.title ?? "None", sub: next?.courseName ?? "Sync Classroom", color: "rgba(251,191,36,0.7)" },
          { label: "Focus Logged", value: `${totalFocusMinutes}m`, sub: "deep work total", color: "rgba(52,211,153,0.7)" },
          { label: "AI Status", value: "Ready", sub: "Gemini 2.5 connected", color: "rgba(96,165,250,0.7)" },
        ].map(s => (
          <div key={s.label} style={{ background: "rgba(255,255,255,0.038)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", borderRadius: 14, padding: '14px 18px', border: "1px solid rgba(255,255,255,0.08)" }}>
            <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: s.color, marginBottom: 6 }}>{s.label}</p>
            <p style={{ fontFamily: "'Instrument Serif', serif", fontSize: 20, color: 'rgba(255,255,255,0.88)', marginBottom: 2 }} className="truncate">{s.value}</p>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', fontWeight: 300 }} className="truncate">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Quick Actions label */}
      <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.22)', marginBottom: 12, paddingLeft: 4 }}>Quick Actions</p>

      {/* 2×2 grid */}
      <div className="grid grid-cols-2 gap-2.5 pb-3">
        {CARDS.map(c => {
          const Icon = c.icon;
          return (
            <button key={c.label} onClick={() => handleCard(c)}
              style={{ background: "rgba(255,255,255,0.038)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: '18px 20px', cursor: 'pointer', transition: 'all 0.2s' }}
              className="flex items-start gap-3 text-left group hover:bg-white/[0.06] hover:-translate-y-[2px]">
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,0.07)' }} className="flex items-center justify-center shrink-0">
                <Icon size={18} className="text-white/40 group-hover:text-white/70 transition-colors" />
              </div>
              <div>
                <p style={{ fontSize: 15, fontWeight: 500, color: 'rgba(255,255,255,0.85)', marginBottom: 4 }}>{c.label}</p>
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.32)', fontWeight: 300, lineHeight: 1.5 }}>{c.desc}</p>
              </div>
            </button>
          );
        })}
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
    <div className="flex flex-col h-full min-h-0" style={{ background: "transparent" }}>

      {/* ── Content area ── */}
      {isEmpty ? (
        <EmptyWorkspace
          onAction={onAction} onOpenTimetable={onOpenTimetable}
          onOpenMaterials={onOpenMaterials} onOpenFocus={onOpenFocus}
          assignmentsData={assignmentsData} totalFocusMinutes={totalFocusMinutes}
        />
      ) : (
        <div className="flex-1 overflow-y-auto min-h-0 px-4 py-4 space-y-3 scrollbar-hidden">

          {/* Final answer panel */}
          <AnimatePresence>
            {finalAnswer && (
              <motion.div key="ans" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                style={{ background: "rgba(255,255,255,0.028)", backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)" }}
                className="rounded-2xl overflow-hidden border border-white/[0.09]">
                {/* header */}
                <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/[0.07]">
                  <Sparkles size={11} className="text-emerald-400" />
                  <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em' }} className="text-emerald-400 uppercase">LifeOS Response</span>
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
              <div style={msg.role === "user"
                ? { background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.09)", fontSize: 14, padding: '12px 16px', borderRadius: '18px 18px 4px 18px' }
                : { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", fontSize: 14, padding: '12px 16px', borderRadius: '18px 18px 18px 4px' }
              } className={`max-w-[85%] text-white/90`}>
                {msg.role === "ai" && !msg.text
                  ? <div className="flex gap-1.5 items-center">
                      <Loader2 size={13} className="animate-spin text-emerald-400" />
                      <span className="text-[12px] text-white/40 font-light">Thinking…</span>
                    </div>
                  : msg.role === "ai"
                    ? <ReactMarkdown remarkPlugins={[remarkGfm]} components={MD}>{msg.text}</ReactMarkdown>
                    : <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.8)' }}>{msg.text}</p>
                }
              </div>
            </div>
          ))}
          <div ref={endRef} />
        </div>
      )}

      {/* ── Input zone ── */}
      <div style={{ background: "rgba(255,255,255,0.032)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", borderTop: "1px solid rgba(255,255,255,0.08)", padding: '14px 18px 12px', flexShrink: 0 }}>
        {/* Text input */}
        <form onSubmit={onSubmit} className="flex items-end gap-2">
          <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 14 }} className="overflow-hidden flex-1 focus-within:ring-1 focus-within:ring-emerald-400/20 transition-all">
            <textarea
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSubmit(); } }}
              disabled={isThinking}
              placeholder="Message LifeOS…   (Shift+Enter for newline)"
              rows={1}
              style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)' }}
              className="w-full bg-transparent px-5 py-3 outline-none resize-none placeholder-white/20 font-light disabled:opacity-40 min-h-[46px] max-h-[120px] scrollbar-hidden"
            />
          </div>
          <button type="submit" disabled={isThinking || !chatInput.trim()}
            style={{ background: 'linear-gradient(135deg, #1a9e70, #0369a1)', width: 44, height: 44, borderRadius: 12 }}
            className="flex-shrink-0 flex items-center justify-center disabled:opacity-30 disabled:grayscale transition-all active:scale-95 hover:scale-[1.08] cursor-pointer">
            {isThinking ? <Loader2 size={16} className="animate-spin text-white" /> : <Send size={15} className="text-white" />}
          </button>
        </form>

        {/* Command chips */}
        <div className="flex gap-1.5 mt-3 flex-wrap">
          {CMDS.map(c => {
            const Icon = c.icon;
            return (
              <button key={c.action} disabled={isThinking} onClick={() => handleChip(c.action)}
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 100, padding: '6px 14px', fontSize: 12, color: "rgba(255,255,255,0.42)", cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.18s', fontWeight: 400 }}
                className="hover:text-white/85 hover:border-white/20 flex items-center gap-1.5 disabled:opacity-20 group">
                <Icon size={11} className="opacity-50 group-hover:opacity-80 transition-opacity" />
                <span>{c.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
