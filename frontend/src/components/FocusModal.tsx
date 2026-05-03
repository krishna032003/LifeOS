import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface FocusModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStart: (durationMinutes: number, apps: string[]) => void;
  onStop: () => void;
  active: boolean;
  endTime: string | null;
}

const COMMON_APPS = ["WhatsApp", "Discord", "Messages", "Spotify", "Slack", "Mail", "Notes"];

export default function FocusModal({ isOpen, onClose, onStart, onStop, active, endTime }: FocusModalProps) {
  const [selectedApps, setSelectedApps] = useState<string[]>(["WhatsApp", "Discord", "Messages"]);
  const [duration, setDuration] = useState(25);
  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    if (active && endTime) {
      interval = setInterval(() => {
        const remaining = new Date(endTime).getTime() - new Date().getTime();
        if (remaining <= 0) {
          setTimeLeft("00:00");
          onStop(); // Auto stop
        } else {
          const m = Math.floor(remaining / 60000);
          const s = Math.floor((remaining % 60000) / 1000);
          setTimeLeft(`${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`);
        }
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [active, endTime, onStop]);

  const toggleApp = (app: string) => {
    setSelectedApps((prev) => prev.includes(app) ? prev.filter(a => a !== app) : [...prev, app]);
  };

  if (!isOpen && !active) return null;

  return (
    <AnimatePresence>
      {(isOpen || active) && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="w-full max-w-xl overflow-hidden flex flex-col bg-[#0f0f0f] border border-white/10 rounded-3xl shadow-2xl relative"
        >
          {active ? (
            <div className="p-12 flex flex-col items-center justify-center space-y-8 min-h-[400px]">
               <div className="w-20 h-20 rounded-full bg-[#ADFFA6]/20 flex items-center justify-center">
                 <span className="text-4xl animate-pulse">🧘‍♂️</span>
               </div>
               <h2 className="text-2xl font-medium text-white">Deep Work in Progress</h2>
               <div className="text-7xl font-light tracking-tighter text-[#ADFFA6] font-mono">
                 {timeLeft || "..."}
               </div>
               <p className="text-[#838179] text-center max-w-sm">
                 Stay focused. We are currently guarding your attention by blocking your selected distractions.
               </p>
               <button 
                 onClick={onStop}
                 className="mt-8 px-6 py-2.5 rounded-full bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors text-sm font-medium border border-red-500/30"
               >
                 Stop Session Early
               </button>
            </div>
          ) : (
            <>
              {/* Setup Screen */}
              <div className="p-6 border-b border-white/5 flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-medium text-white flex items-center gap-2">
                    <span className="text-2xl">💻</span> Deep Work Shield
                  </h2>
                  <p className="text-xs text-[#838179] mt-1">Block native Mac apps like Opal</p>
                </div>
                <button onClick={onClose} className="text-[#838179] hover:text-white p-2 rounded-lg hover:bg-white/5">
                  ✕
                </button>
              </div>

              <div className="p-6 space-y-8">
                {/* Duration */}
                <div>
                  <label className="text-sm font-medium text-white mb-3 block">Focus Duration (Minutes)</label>
                  <div className="grid grid-cols-4 gap-3">
                    {[15, 25, 45, 60].map(d => (
                      <button
                        key={d}
                        onClick={() => setDuration(d)}
                        className={`py-3 rounded-xl border transition-all text-sm font-medium ${duration === d ? "bg-[#ADFFA6]/10 border-[#ADFFA6] text-[#ADFFA6]" : "bg-white/5 border-white/10 text-white hover:bg-white/10"}`}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Apps */}
                <div>
                  <label className="text-sm font-medium text-white mb-3 block">Apps to Block (Auto-Quit)</label>
                  <div className="flex flex-wrap gap-2">
                    {COMMON_APPS.map(app => {
                      const selected = selectedApps.includes(app);
                      return (
                        <button
                          key={app}
                          onClick={() => toggleApp(app)}
                          className={`px-4 py-2 rounded-full border transition-all text-sm ${selected ? "bg-red-500/10 border-red-500/50 text-red-400" : "bg-white/5 border-white/10 text-[#838179] hover:bg-white/10 hover:text-white"}`}
                        >
                          {app} {selected && "✕"}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-xs text-[#838179] mt-3">
                    When active, if you try to open any of these apps, LifeOS will instantly force-quit them.
                  </p>
                </div>

                <button
                  onClick={() => onStart(duration, selectedApps)}
                  className="w-full py-4 rounded-2xl bg-[#ADFFA6] text-black font-semibold text-base hover:bg-[#9af093] transition-colors shadow-[0_0_20px_rgba(173,255,166,0.3)] hover:shadow-[0_0_30px_rgba(173,255,166,0.5)]"
                >
                  Initiate Deep Work 🚀
                </button>
              </div>
            </>
          )}
        </motion.div>
      </div>
      )}
    </AnimatePresence>
  );
}
