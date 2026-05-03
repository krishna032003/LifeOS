"use client";
import { Command, Clock, Brain, BarChart2, Zap, BookOpen, CalendarDays, Target, ChevronRight, TrendingUp } from "lucide-react";

interface Assignment { title?: string; dueDate?: { year: number; month: number; day: number }; courseName?: string; alternateLink?: string; }
interface SidebarProps {
  focusProgress: number; totalFocusMinutes: number; isFocusActive: boolean;
  classroomData: unknown[]; assignmentsData: Assignment[];
  isClassroomLoading: boolean; onSyncClassroom: () => void;
  onNav: (key: string) => void; activeNav: string;
}

const NAV = [
  { key: "command",   label: "Command",       icon: Command,   shortcut: "⌘K" },
  { key: "timetable", label: "Timetable",     icon: Clock,     shortcut: "" },
  { key: "materials", label: "Study RAG",     icon: Brain,     shortcut: "" },
  { key: "review",    label: "Weekly Review", icon: BarChart2, shortcut: "" },
  { key: "focus",     label: "Deep Work",     icon: Zap,       shortcut: "" },
];

function NavItem({ nav, active, onClick, badge }: { nav: typeof NAV[0]; active: boolean; onClick: () => void; badge?: boolean }) {
  const Icon = nav.icon;
  return (
    <button onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[11px] font-medium transition-all duration-150 group mb-0.5 relative
        ${active
          ? "text-white bg-white/8 shadow-sm"
          : "text-white/30 hover:text-white/65 hover:bg-white/4"
        }`}
    >
      {active && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 rounded-r bg-emerald-400" />
      )}
      <Icon size={13} className={`transition-colors ${active ? "text-emerald-400" : "text-white/20 group-hover:text-white/40"}`} />
      <span className="flex-1 text-left">{nav.label}</span>
      {badge && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />}
      {nav.shortcut && <span className="text-[8px] text-white/15 font-mono">{nav.shortcut}</span>}
      {active && <ChevronRight size={9} className="text-white/25" />}
    </button>
  );
}

function ScoreBar({ value }: { value: number }) {
  const gradient = value > 70
    ? "linear-gradient(90deg,#34d399,#10b981)"
    : value > 35
    ? "linear-gradient(90deg,#60a5fa,#34d399)"
    : "linear-gradient(90deg,#a78bfa,#60a5fa)";
  const label = value > 70 ? "Excellent" : value > 35 ? "Good" : "Building…";
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Target size={10} className="text-white/20" />
          <span className="text-[10px] text-white/35">Focus Score</span>
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-[13px] font-bold text-white/80 tabular-nums">{Math.round(value)}</span>
          <span className="text-[9px] text-white/25">%</span>
        </div>
      </div>
      <div className="h-1.5 rounded-full bg-white/5 overflow-hidden relative">
        <div className="h-full rounded-full transition-all duration-700 ease-out" style={{ width: `${value}%`, background: gradient }} />
        {value > 0 && <div className="absolute inset-0 rounded-full" style={{ background: "linear-gradient(transparent 40%,rgba(0,0,0,0.3))" }} />}
      </div>
      <p className="text-[9px] text-white/20 mt-1">{label}</p>
    </div>
  );
}

export default function AppSidebar({
  focusProgress, totalFocusMinutes, isFocusActive,
  classroomData, assignmentsData, isClassroomLoading,
  onSyncClassroom, onNav, activeNav,
}: SidebarProps) {
  const hour = new Date().getHours();
  const timeLabel = hour < 12 ? "Morning" : hour < 17 ? "Afternoon" : "Evening";
  const dateStr = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" });

  return (
    <div className="flex flex-col h-full">
      {/* Session header */}
      <div className="px-4 py-4 border-b border-white/5"
        style={{ background: "linear-gradient(180deg,rgba(52,211,153,0.04) 0%,transparent 100%)" }}>
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400/60" />
          <p className="text-[9px] font-bold tracking-widest text-emerald-400/60 uppercase">{timeLabel}</p>
        </div>
        <p className="text-[11px] text-white/50 font-medium">{dateStr}</p>
      </div>

      {/* Navigation */}
      <div className="px-2.5 py-3 border-b border-white/5">
        <p className="text-[8px] font-bold tracking-widest text-white/15 uppercase px-1.5 mb-2">Workspace</p>
        {NAV.map(n => (
          <NavItem key={n.key} nav={n} active={activeNav === n.key} onClick={() => onNav(n.key)} badge={n.key === "focus" && isFocusActive} />
        ))}
      </div>

      {/* Performance */}
      <div className="px-4 py-4 border-b border-white/5 space-y-4">
        <p className="text-[8px] font-bold tracking-widest text-white/15 uppercase">Performance</p>
        <ScoreBar value={focusProgress} />

        {/* Deep work stat card */}
        <div className="flex items-center gap-3 p-2.5 rounded-xl border border-white/6"
          style={{ background: "linear-gradient(135deg,rgba(16,185,129,0.06),rgba(6,182,212,0.04))" }}>
          <div className="w-7 h-7 rounded-lg bg-emerald-400/10 flex items-center justify-center shrink-0">
            <Zap size={13} className="text-emerald-400" />
          </div>
          <div>
            <p className="text-[9px] text-white/30">Deep Work Logged</p>
            <div className="flex items-baseline gap-1">
              <span className="text-[16px] font-bold text-white/80 tabular-nums leading-tight">{totalFocusMinutes}</span>
              <span className="text-[9px] text-white/25">min</span>
            </div>
          </div>
          <TrendingUp size={11} className="text-emerald-400/30 ml-auto" />
        </div>
      </div>

      {/* Classroom / Deadlines */}
      <div className="flex-1 flex flex-col min-h-0 px-3 py-3 overflow-hidden">
        <div className="flex items-center justify-between mb-3 px-1">
          <div className="flex items-center gap-1.5">
            <BookOpen size={10} className="text-white/20" />
            <p className="text-[8px] font-bold tracking-widest text-white/20 uppercase">Deadlines</p>
          </div>
          <button onClick={onSyncClassroom} disabled={isClassroomLoading}
            className="text-[9px] text-white/20 hover:text-emerald-400 disabled:opacity-40 transition-colors">
            {isClassroomLoading ? "Syncing…" : classroomData.length > 0 ? "↻" : "+ Connect"}
          </button>
        </div>

        {classroomData.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 px-3">
            <div className="w-10 h-10 rounded-2xl border border-white/6 bg-white/2 flex items-center justify-center">
              <CalendarDays size={18} className="text-white/15" />
            </div>
            <p className="text-[10px] text-white/20 leading-relaxed">Connect Google Classroom<br/>to see upcoming deadlines</p>
            <button onClick={onSyncClassroom} disabled={isClassroomLoading}
              className="text-[9px] px-3 py-1.5 rounded-lg border border-white/8 text-white/30 hover:text-white/60 hover:border-white/20 disabled:opacity-40 transition-all">
              {isClassroomLoading ? "Connecting…" : "Sync Classroom"}
            </button>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-1 min-h-0">
            {(() => {
              const nowPlus3Days = new Date();
              nowPlus3Days.setDate(nowPlus3Days.getDate() + 3);
              return assignmentsData.slice(0, 6).map((a, i) => {
                const d = a.dueDate;
                const due = d ? `${d.day}/${d.month}` : "?";
                const urgent = d && new Date(d.year, d.month - 1, d.day) <= nowPlus3Days;
              return (
                <a key={i} href={a.alternateLink} target="_blank" rel="noopener noreferrer"
                  className="flex items-start gap-2 px-2 py-2 rounded-lg hover:bg-white/4 transition-colors group">
                  <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${urgent ? "bg-amber-400" : "bg-white/15"}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-white/55 font-medium truncate group-hover:text-white/75 transition-colors">{a.title}</p>
                    <p className="text-[8px] text-white/20 truncate">{a.courseName}</p>
                  </div>
                  <span className={`text-[8px] tabular-nums font-mono shrink-0 ${urgent ? "text-amber-400" : "text-white/20"}`}>{due}</span>
                </a>
              );
              });
            })()}
            {assignmentsData.length > 6 && (
              <p className="text-[9px] text-white/15 text-center py-1.5">+{assignmentsData.length - 6} more</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
