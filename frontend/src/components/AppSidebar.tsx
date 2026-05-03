"use client";
import { Command, Clock, Brain, BarChart2, Zap, CalendarDays, Target } from "lucide-react";

interface Assignment { title?: string; dueDate?: { year: number; month: number; day: number }; courseName?: string; alternateLink?: string; }
interface SidebarProps {
  focusProgress: number; totalFocusMinutes: number; isFocusActive: boolean;
  classroomData: unknown[]; assignmentsData: Assignment[];
  isClassroomLoading: boolean; onSyncClassroom: () => void;
  onNav: (key: string) => void; activeNav: string;
}

const NAV = [
  { key: "command",   label: "Command",       icon: Command },
  { key: "timetable", label: "Timetable",     icon: Clock },
  { key: "materials", label: "Study RAG",     icon: Brain },
  { key: "review",    label: "Weekly Review", icon: BarChart2 },
  { key: "focus",     label: "Deep Work",     icon: Zap },
];

export default function AppSidebar({
  focusProgress, totalFocusMinutes, isFocusActive,
  classroomData, assignmentsData, isClassroomLoading,
  onSyncClassroom, onNav, activeNav,
}: SidebarProps) {
  const hour = new Date().getHours();
  const timeLabel = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const dateStr = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" });

  const focusLabel = focusProgress > 70 ? "Excellent" : focusProgress > 35 ? "Good" : "Building…";

  return (
    <div className="flex flex-col h-full" style={{ background: "linear-gradient(180deg, rgba(10,20,18,0.85) 0%, rgba(6,7,10,0.8) 100%)", backdropFilter: "blur(32px)", WebkitBackdropFilter: "blur(32px)", borderRight: "1px solid rgba(255,255,255,0.09)", boxShadow: "inset -1px 0 0 rgba(255,255,255,0.04)" }}>

      {/* ── Greeting header ── */}
      <div style={{ padding: '20px 20px 16px', borderBottom: "1px solid rgba(255,255,255,0.07)", background: "rgba(52,211,153,0.02)" }}>
        <p style={{ fontFamily: "'Instrument Serif', serif", fontSize: 24, color: 'rgba(255,255,255,0.9)', lineHeight: 1.2, marginBottom: 4, letterSpacing: '-0.3px', textShadow: '0 0 30px rgba(52,211,153,0.15)' }}>{timeLabel}</p>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.32)', fontWeight: 300, letterSpacing: '0.03em' }}>{dateStr}</p>
      </div>

      {/* ── Nav section ── */}
      <div className="px-3">
        <div className="flex items-center gap-3 mb-3 px-1 mt-4">
          <span style={{ fontSize: 10, letterSpacing: '0.15em', color: 'rgba(255,255,255,0.4)' }} className="uppercase font-semibold">Workspace</span>
          <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, rgba(255,255,255,0.1), transparent)' }} />
        </div>
        {NAV.map(n => {
          const Icon = n.icon;
          const active = activeNav === n.key;
          return (
            <button key={n.key} onClick={() => onNav(n.key)}
              style={{ padding: '9px 10px', borderRadius: 12, marginBottom: 3, background: active ? 'linear-gradient(90deg, rgba(52,211,153,0.15) 0%, rgba(52,211,153,0.06) 100%)' : 'transparent', boxShadow: active ? 'inset 0 0 0 1px rgba(52,211,153,0.2), 0 0 20px rgba(52,211,153,0.08)' : 'none' }}
              className={`w-full flex items-center gap-2.5 cursor-pointer transition-all relative group ${active ? "" : "hover:bg-white/[0.04]"}`}
            >
              {active && (
                <div style={{ position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)', width: 3, height: 20, borderRadius: '0 3px 3px 0', background: 'linear-gradient(180deg, var(--accent-mint), var(--accent-cyan))', boxShadow: '0 0 8px rgba(52,211,153,0.7)' }} />
              )}
              <div className={`w-[26px] h-[26px] rounded-lg flex items-center justify-center transition-transform duration-150 ${active ? "bg-emerald-400/[0.15]" : "bg-white/[0.04] group-hover:translate-x-[3px]"}`}>
                <Icon size={16} className={active ? "text-emerald-400" : "text-white/30"} />
              </div>
              <span style={{ fontSize: 15, fontWeight: active ? 500 : 400, color: active ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.42)' }} className={`flex-1 text-left ${active ? "" : "group-hover:text-white/75"}`}>{n.label}</span>
              {n.key === "focus" && isFocusActive && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              )}
            </button>
          );
        })}
      </div>

      {/* ── Deadlines ── */}
      <div className="px-3 pb-3">
        <div className="flex items-center justify-between mb-3 px-1 mt-4">
          <div className="flex items-center gap-3 flex-1">
            <span style={{ fontSize: 10, letterSpacing: '0.15em', color: 'rgba(255,255,255,0.4)' }} className="uppercase font-semibold">Deadlines</span>
            <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, rgba(255,255,255,0.1), transparent)' }} />
          </div>
          <button onClick={onSyncClassroom} disabled={isClassroomLoading}
            className="text-[12px] text-white/22 hover:text-emerald-400 disabled:opacity-40 transition-colors">
            {isClassroomLoading ? "Syncing…" : classroomData.length > 0 ? "↻" : ""}
          </button>
        </div>

        {classroomData.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center gap-2.5 py-4 px-2">
            <div className="w-9 h-9 rounded-xl border border-white/[0.06] bg-white/[0.02] flex items-center justify-center">
              <CalendarDays size={16} className="text-white/18" />
            </div>
            <p className="text-[11px] text-white/30 font-light leading-relaxed mb-1">Connect Classroom<br/>to see deadlines</p>
            <button onClick={onSyncClassroom} disabled={isClassroomLoading}
              style={{ background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.25)", color: "rgba(52,211,153,0.75)", fontSize: 12, padding: '7px 16px', borderRadius: 20, boxShadow: '0 0 12px rgba(52,211,153,0.1)' }}
              className="btn-connect-shimmer hover:text-emerald-400/80 transition-all duration-300 cursor-pointer hover:border-emerald-400/30">
              {isClassroomLoading ? "Connecting…" : "+ Connect"}
            </button>
          </div>
        ) : (
          <div className="space-y-1 max-h-[140px] overflow-y-auto scrollbar-hidden px-1.5">
            {(() => {
              const nowPlus3Days = new Date();
              nowPlus3Days.setDate(nowPlus3Days.getDate() + 3);
              return assignmentsData.slice(0, 6).map((a, i) => {
                const d = a.dueDate;
                const due = d ? `${d.day}/${d.month}` : "?";
                const urgent = d && new Date(d.year, d.month - 1, d.day) <= nowPlus3Days;
                return (
                  <a key={i} href={a.alternateLink} target="_blank" rel="noopener noreferrer"
                    className="flex items-start gap-2 py-1.5 group">
                    <div className={`w-2 h-2 rounded-full mt-[5px] shrink-0`} style={{ background: urgent ? '#fbbf24' : 'rgba(255,255,255,0.2)' }} />
                    <div className="flex-1 min-w-0">
                      <p style={{ fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.7)' }} className="truncate group-hover:text-white/90 transition-colors">{a.title}</p>
                      <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }} className="truncate mt-0.5">{a.courseName}</p>
                    </div>
                    <span style={{ fontSize: 11 }} className={`tabular-nums shrink-0 ${urgent ? "text-amber-400" : "text-white/30"}`}>{due}</span>
                  </a>
                );
              });
            })()}
          </div>
        )}
      </div>

      {/* ── Bottom stats ── */}
      <div className="mt-auto px-4 pb-4 pt-3">
        <div className="flex items-center gap-3 mb-3 px-1 mt-2">
          <span style={{ fontSize: 10, letterSpacing: '0.15em', color: 'rgba(255,255,255,0.4)' }} className="uppercase font-semibold">Performance</span>
          <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, rgba(255,255,255,0.1), transparent)' }} />
        </div>
        
        {/* Focus Score */}
        <div className="px-2 mb-4">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5">
              <Target size={12} className="text-white/22" />
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>Focus Score</span>
            </div>
            <div className="flex items-baseline gap-0.5">
              <span style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.88)' }} className="tabular-nums">{Math.round(focusProgress)}</span>
              <span className="text-[10px] text-white/30">%</span>
            </div>
          </div>
            <div style={{ height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ width: `${focusProgress}%`, background: "linear-gradient(90deg, #34d399, #06b6d4)", boxShadow: "0 0 6px rgba(52,211,153,0.4)", borderRadius: 10, transition: "width 1s ease-out" }} className="h-full" />
            </div>
            <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', marginTop: 6, textAlign: 'right' }}>{focusLabel}</p>
        </div>

        {/* Deep Work card */}
        <div style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 14, padding: '11px 14px', boxShadow: "0 2px 12px rgba(0,0,0,0.2)" }} className="flex items-center gap-3">
          <span className={`w-2 h-2 rounded-full shrink-0 ${isFocusActive ? "bg-emerald-400 animate-pulse" : "bg-white/20"}`} />
          <div className="flex-1 min-w-0">
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>Deep Work Logged</p>
          </div>
          <div className="flex items-baseline gap-1">
            <span style={{ fontSize: 20, fontWeight: 700, color: 'rgba(255,255,255,0.88)' }} className="tabular-nums">{totalFocusMinutes}</span>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>min</span>
          </div>
        </div>
      </div>
    </div>
  );
}
