"use client";

import { ReactNode, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ProfileMenu from "@/components/ProfileMenu";
import {
  ChevronDown, ChevronRight, Cpu, CheckCircle2,
  AlertCircle, Loader2, Minus, Activity, GitBranch,
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
  System:      { label: "System",      dot: "bg-sky-400",     text: "text-sky-400",     bg: "bg-sky-400/8" },
  Planner:     { label: "Planner",     dot: "bg-violet-400",  text: "text-violet-400",  bg: "bg-violet-400/8" },
  Study:       { label: "Study",       dot: "bg-emerald-400", text: "text-emerald-400", bg: "bg-emerald-400/8" },
  Productivity:{ label: "Scheduler",   dot: "bg-amber-400",   text: "text-amber-400",   bg: "bg-amber-400/8" },
  Memory:      { label: "Memory",      dot: "bg-cyan-400",    text: "text-cyan-400",    bg: "bg-cyan-400/8" },
  Reflection:  { label: "Reflection",  dot: "bg-pink-400",    text: "text-pink-400",    bg: "bg-pink-400/8" },
  User:        { label: "You",         dot: "bg-white/40",    text: "text-white/50",    bg: "bg-white/4" },
  System_Error:{ label: "Error",       dot: "bg-red-400",     text: "text-red-400",     bg: "bg-red-400/8" },
};

function PipelineRow({ log, isLast }: { log: LogEntry; isLast: boolean }) {
  const [open, setOpen] = useState(false);
  const meta = AGENT_META[log.agent] ?? { label: log.agent, dot: "bg-slate-400", text: "text-slate-400", bg: "bg-slate-400/8" };
  const long = log.message.length > MAX_LEN;
  const msg = open || !long ? log.message : log.message.slice(0, MAX_LEN) + "…";

  return (
    <motion.div
      layout initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
      className="relative flex gap-2.5"
    >
      {/* Timeline */}
      <div className="flex flex-col items-center w-4 shrink-0 pt-0.5">
        <div className={`w-2 h-2 rounded-full ${meta.dot} ${log.isFinal ? "ring-2 ring-offset-1 ring-offset-[#0d0e10] ring-current" : ""} shrink-0`} />
        {!isLast && <div className="w-px flex-1 mt-1.5 bg-white/5" style={{ minHeight: 12 }} />}
      </div>

      {/* Content bubble */}
      <div className={`flex-1 min-w-0 mb-2.5 px-2.5 py-1.5 rounded-lg ${meta.bg} border border-white/5`}>
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className={`text-[9px] font-bold uppercase tracking-wider ${meta.text}`}>{meta.label}</span>
          {log.isFinal && <span className="text-[8px] px-1 py-px rounded bg-emerald-400/15 text-emerald-400 font-semibold">✓ Done</span>}
          <span className="ml-auto text-[8px] text-white/15 tabular-nums shrink-0">{log.timestamp}</span>
        </div>
        <p className="text-[10px] text-white/45 leading-relaxed break-words">{msg}</p>
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
    <div className="h-screen w-screen overflow-hidden flex flex-col text-white font-[family-name:var(--font-geist-sans)]"
      style={{ background: "linear-gradient(135deg,#0b0c0f 0%,#0d0f14 100%)" }}>

      {/* ── Topbar ── */}
      <header className="h-11 flex-shrink-0 flex items-center justify-between px-5
        border-b border-white/5 bg-[#0d0e12]/90 backdrop-blur-2xl z-20 relative">
        {/* subtle glow behind logo */}
        <div className="absolute left-0 top-0 h-full w-48 bg-gradient-to-r from-emerald-500/5 to-transparent pointer-events-none" />
        <div className="flex items-center gap-3 relative z-10">
          <div className="w-6 h-6 rounded-lg flex items-center justify-center shadow-lg shadow-emerald-900/50"
            style={{ background: "linear-gradient(135deg,#34d399,#0ea5e9)" }}>
            <span className="text-[10px] font-black text-black leading-none">L</span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-[13px] font-semibold tracking-tight">LifeOS</span>
            <span className="text-[10px] text-white/20 hidden sm:block">Command Center</span>
          </div>
          {/* live indicator */}
          <div className="flex items-center gap-1 ml-3">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[9px] text-white/20 font-mono">online</span>
          </div>
        </div>
        <div className="flex items-center gap-3 relative z-10">
          <span className="text-[10px] text-white/20 hidden md:block tabular-nums">
            {new Date().toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
          </span>
          <ProfileMenu />
        </div>
      </header>

      {/* ── 3-column body ── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* Left sidebar */}
        <aside className="w-[220px] flex-shrink-0 border-r border-white/5 flex flex-col overflow-y-auto overflow-x-hidden"
          style={{ background: "linear-gradient(180deg,#0e1015 0%,#0b0c10 100%)" }}>
          {sidebarContent}
        </aside>

        {/* Center */}
        <main className="flex-1 min-w-0 flex flex-col overflow-hidden border-r border-white/5"
          style={{ background: "linear-gradient(180deg,#0c0d11 0%,#0b0c0f 100%)" }}>
          {centralArea}
        </main>

        {/* Right — Agent Pipeline */}
        <aside className="w-[220px] flex-shrink-0 flex flex-col overflow-hidden"
          style={{ background: "#0d0e12" }}>

          {/* Pipeline header */}
          <div className="h-9 flex-shrink-0 flex items-center justify-between px-3.5 border-b border-white/5">
            <div className="flex items-center gap-2">
              <GitBranch size={11} className="text-violet-400/60" />
              <span className="text-[9px] font-bold tracking-widest text-white/25 uppercase">Agent Trace</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
              <span className={`text-[9px] font-medium ${st.text} flex items-center gap-1`}>
                {st.icon}{st.label}
              </span>
            </div>
          </div>

          {/* Idle empty */}
          {logs.length <= 1 && pipelineStatus === "idle" && (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 px-5 text-center select-none">
              <div className="w-8 h-8 rounded-xl bg-white/4 border border-white/6 flex items-center justify-center">
                <Cpu size={14} className="text-white/20" />
              </div>
              <p className="text-[10px] text-white/20 leading-relaxed">
                Agent logs stream here when you run a command or send a message.
              </p>
            </div>
          )}

          {/* Log list */}
          {(logs.length > 1 || pipelineStatus !== "idle") && (
            <div className="flex-1 overflow-y-auto px-3 pt-3 min-h-0">
              <AnimatePresence initial={false}>
                {logs.map((log, i) => (
                  <PipelineRow key={log.id} log={log} isLast={i === logs.length - 1} />
                ))}
              </AnimatePresence>
              <div ref={endRef} />
            </div>
          )}

          {/* Footer count */}
          <div className="h-8 flex-shrink-0 border-t border-white/5 flex items-center px-3.5 gap-2">
            <span className="text-[8px] text-white/15 tabular-nums">{logs.length} event{logs.length !== 1 ? "s" : ""}</span>
          </div>
        </aside>
      </div>
    </div>
  );
}
