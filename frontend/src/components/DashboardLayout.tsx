"use client";

import { ReactNode, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ProfileMenu from "@/components/ProfileMenu";
import {
  ChevronDown, ChevronRight, Cpu, CheckCircle2,
  AlertCircle, Loader2, Minus, Activity,
} from "lucide-react";

interface LogEntry {
  id: string; agent: string; message: string; timestamp: string;
  status: "active" | "completed" | "pending"; isFinal?: boolean;
}
interface DashboardLayoutProps {
  sidebarContent: ReactNode; centralArea: ReactNode; logs: LogEntry[];
  pipelineStatus?: "idle" | "thinking" | "streaming" | "done" | "error";
}

const MAX_LEN = 110;

const AGENT_META: Record<string, { label: string; dot: string; text: string; bg: string }> = {
  System:      { label: "System",      dot: "bg-cyan-400",     text: "text-cyan-400",     bg: "bg-cyan-400/8" },
  Planner:     { label: "Planner",     dot: "bg-violet-400",  text: "text-violet-400",  bg: "bg-violet-400/8" },
  Study:       { label: "Study",       dot: "bg-emerald-400", text: "text-emerald-400", bg: "bg-emerald-400/8" },
  Productivity:{ label: "Scheduler",   dot: "bg-amber-400",   text: "text-amber-400",   bg: "bg-amber-400/8" },
  Memory:      { label: "Memory",      dot: "bg-indigo-400",  text: "text-indigo-400",  bg: "bg-indigo-400/8" },
  Reflection:  { label: "Reflection",  dot: "bg-violet-400",  text: "text-violet-400",  bg: "bg-violet-400/8" },
  User:        { label: "You",         dot: "bg-white",       text: "text-white/90",    bg: "bg-white/4" },
  System_Error:{ label: "Error",       dot: "bg-red-400",     text: "text-red-400",     bg: "bg-red-400/8" },
};

function PipelineRow({ log, isLast }: { log: LogEntry; isLast: boolean }) {
  const [open, setOpen] = useState(false);
  const meta = AGENT_META[log.agent] ?? { label: log.agent, dot: "bg-slate-400", text: "text-slate-400", bg: "bg-slate-400/8" };
  const long = log.message.length > MAX_LEN;
  const msg = open || !long ? log.message : log.message.slice(0, MAX_LEN) + "…";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex gap-2 mb-3"
    >
      {/* Timeline */}
      <div className="w-3 flex flex-col items-center shrink-0 pt-0.5">
        <div className={`w-[7px] h-[7px] rounded-full ${meta.dot} ${log.isFinal ? "ring-1 ring-emerald-400/20" : ""} shrink-0`} />
        {!isLast && <div className="w-px flex-1 mt-1 bg-white/5" style={{ minHeight: 12 }} />}
      </div>

      {/* Bubble */}
      <div className="flex-1 min-w-0 px-2.5 py-2" style={{ background: "rgba(255,255,255,0.055)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 10, boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08)" }}>
        <div className="flex items-center gap-1.5 mb-0.5">
          <span style={{ fontSize: 11, fontWeight: 700 }} className={`uppercase tracking-[0.07em] ${meta.text}`}>{meta.label}</span>
          {log.isFinal && <span className="text-[8px] px-1 py-px rounded bg-emerald-400/15 text-emerald-400 font-semibold glow-pulse">✓</span>}
          <span className="ml-auto text-white/18 tabular-nums shrink-0" style={{ fontSize: 10 }}>{log.timestamp}</span>
        </div>
        <p className="font-light leading-relaxed break-words font-mono" style={{ fontSize: 11, color: "rgba(255,255,255,0.52)" }}>{msg}</p>
        {long && (
          <button onClick={() => setOpen(!open)} className="mt-0.5 flex items-center gap-0.5 text-[8px] text-white/20 hover:text-white/50 transition-colors">
            {open ? <ChevronDown size={8} /> : <ChevronRight size={8} />}
            {open ? "collapse" : "expand"}
          </button>
        )}
      </div>
    </motion.div>
  );
}

const STATUS_MAP = {
  idle:      { icon: <Minus size={9} />,                            label: "Idle",      dot: "bg-white/15",               text: "text-white/20" },
  thinking:  { icon: <Loader2 size={9} className="animate-spin" />, label: "Thinking",  dot: "bg-violet-400 animate-pulse",text: "text-violet-300" },
  streaming: { icon: <Activity size={9} />,                         label: "Streaming", dot: "bg-cyan-400 animate-pulse",  text: "text-cyan-300" },
  done:      { icon: <CheckCircle2 size={9} />,                     label: "Done",      dot: "bg-emerald-400",             text: "text-emerald-300" },
  error:     { icon: <AlertCircle size={9} />,                      label: "Error",     dot: "bg-red-400",                 text: "text-red-300" },
};

export default function DashboardLayout({ sidebarContent, centralArea, logs, pipelineStatus = "idle" }: DashboardLayoutProps) {
  const endRef = useRef<HTMLDivElement>(null);
  const st = STATUS_MAP[pipelineStatus];

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [logs]);

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col" style={{ fontFamily: "var(--font-body)", background: "transparent" }}>

      {/* ── Topbar ── */}
      <header className="h-[56px] flex-shrink-0 flex items-center justify-between px-8 z-20 relative" style={{ background: "rgba(6,7,10,0.75)", backdropFilter: "blur(32px)", WebkitBackdropFilter: "blur(32px)", borderBottom: "1px solid rgba(255,255,255,0.09)", boxShadow: "0 1px 0 rgba(255,255,255,0.06), 0 4px 24px rgba(0,0,0,0.4)" }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8, flexShrink: 0,
            background: 'linear-gradient(135deg, #34d399, #0ea5e9)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, fontWeight: 800, color: '#000'
          }}>L</div>
          <span style={{ fontFamily: "'Instrument Serif', serif", fontSize: 22, letterSpacing: '-0.4px', color: 'rgba(255,255,255,0.92)', textShadow: '0 0 20px rgba(52,211,153,0.2)' }}>
            LifeOS
          </span>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.22)', marginLeft: 2 }} className="hidden sm:block">
            Command Center
          </span>
        </div>

        {/* Right */}
        <div className="flex items-center gap-4 relative z-10">
          <span className="text-[12px] text-white/35 tabular-nums tracking-wide uppercase font-light">
            {new Date().toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
          </span>
          <ProfileMenu />
        </div>
        <div className="topbar-glow" />
      </header>

      {/* ── 3-column body ── */}
      <div className="flex flex-1 min-h-0 overflow-hidden" style={{ background: "transparent", gap: 0 }}>

        {/* Left sidebar */}
        <aside className="w-[230px] flex-shrink-0 flex flex-col overflow-hidden" style={{ background: "transparent" }}>
          {sidebarContent}
        </aside>

        {/* Center */}
        <main className="flex-1 min-w-0 flex flex-col overflow-hidden" style={{ background: "transparent" }}>
          {centralArea}
        </main>

        {/* Right — Agent Pipeline */}
        <aside className="w-[230px] flex-shrink-0 flex flex-col overflow-hidden anim-5" style={{ background: "rgba(6,7,10,0.7)", backdropFilter: "blur(28px)", WebkitBackdropFilter: "blur(28px)", borderLeft: "1px solid rgba(52,211,153,0.12)", boxShadow: "inset 1px 0 0 rgba(52,211,153,0.06), -4px 0 32px rgba(0,0,0,0.3)" }}>

          {/* Pipeline header */}
          <div className="h-[40px] flex-shrink-0 flex items-center justify-between px-[14px]" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.15em', color: 'rgba(255,255,255,0.35)', textShadow: '0 0 12px rgba(52,211,153,0.2)' }}>AGENT TRACE</span>
            <div className="flex items-center gap-1.5">
              <div className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
              <span style={{ fontSize: 11 }} className={`${st.text} flex items-center gap-1`}>
                {st.icon}{st.label}
              </span>
            </div>
          </div>

          {/* Idle empty */}
          {logs.length <= 1 && pipelineStatus === "idle" && (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 px-5 text-center select-none">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "rgba(52,211,153,0.07)", border: "1px solid rgba(52,211,153,0.18)", boxShadow: "0 0 24px rgba(52,211,153,0.15)" }}>
                <Cpu size={14} className="text-white/20" />
              </div>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.32)', lineHeight: 1.7 }} className="text-center font-light leading-relaxed">
                Agent logs stream here when you run a command or send a message.
              </p>
            </div>
          )}

          {/* Log list */}
          {(logs.length > 1 || pipelineStatus !== "idle") && (
            <div className="flex-1 overflow-y-auto px-3 pt-3 min-h-0 scrollbar-none">
              <AnimatePresence initial={false}>
                {logs.map((log, i) => (
                  <PipelineRow key={log.id} log={log} isLast={i === logs.length - 1} />
                ))}
              </AnimatePresence>
              <div ref={endRef} />
            </div>
          )}

          {/* Footer count */}
          <div className="h-8 flex-shrink-0 flex items-center px-3.5 gap-2" style={{ borderTop: "1px solid rgba(255,255,255,0.07)", background: "rgba(6,7,10,0.6)", boxShadow: "0 -1px 0 rgba(255,255,255,0.06)" }}>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }} className="tabular-nums">{logs.length} event{logs.length !== 1 ? "s" : ""}</span>
          </div>
        </aside>
      </div>
    </div>
  );
}
