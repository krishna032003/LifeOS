"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Send } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import FocusRing from "@/components/FocusRing";
import ParticleBackground from "@/components/ParticleBackground";
import { useRouter } from "next/navigation";
import { streamAgentChat } from "@/services/api";

import WeeklyReviewModal from "@/components/WeeklyReviewModal";
import FocusModal from "@/components/FocusModal";

export default function Home() {
  const router = useRouter();
  const [isThinking, setIsThinking] = useState(false);
  const [isAppLoading, setIsAppLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  // Hardcoded for demo
  const [focusProgress, setFocusProgress] = useState(0);
  const [totalFocusMinutes, setTotalFocusMinutes] = useState(0);

  const [logs, setLogs] = useState([
    {
      id: "1",
      agent: "System",
      message: "LifeOS initialized. Standing by.",
      timestamp: "", // Hydrated below
      status: "completed" as const
    }
  ]);

  // Modal states
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [isReviewLoading, setIsReviewLoading] = useState(false);
  const [reviewData, setReviewData] = useState(null);

  // Classroom Data
  const [isClassroomLoading, setIsClassroomLoading] = useState(false);
  const [classroomData, setClassroomData] = useState<any[]>([]);
  const [assignmentsData, setAssignmentsData] = useState<any[]>([]);

  // Focus Modal states
  const [isFocusOpen, setIsFocusOpen] = useState(false);
  const [isFocusActive, setIsFocusActive] = useState(false);
  const [focusEndTime, setFocusEndTime] = useState<string | null>(null);

  // Handle Hydration mismatch for timestamps & Activity Tracking
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    setLogs(prev => [{ ...prev[0], timestamp: new Date().toLocaleTimeString() }]);
    checkUser();

    // Check if focus session is active
    fetch("http://localhost:8000/api/focus/status")
      .then(res => res.json())
      .then(data => {
        if (data.active) {
          setIsFocusActive(true);
          setFocusEndTime(data.end_time);
        }
      })
      .catch(console.error);

    // Dynamic Activity Tracking
    let activityLevel = 0;
    const handleActivity = () => {
      activityLevel += 0.05; // Slower increment because mousemove fires very rapidly
      if (activityLevel > 100) activityLevel = 100;
      setFocusProgress((prev) => Math.min(100, Math.max(0, Math.floor(prev + activityLevel * 0.05))));
    };

    const decayInterval = setInterval(() => {
      activityLevel = Math.max(0, activityLevel - 2);
      if (activityLevel === 0) {
        setFocusProgress((prev) => Math.max(0, prev - 1)); // Decay back down to 0%
      }
    }, 2000);

    window.addEventListener("mousemove", handleActivity);
    window.addEventListener("click", handleActivity);
    window.addEventListener("keydown", handleActivity);

    return () => {
      window.removeEventListener("mousemove", handleActivity);
      window.removeEventListener("click", handleActivity);
      window.removeEventListener("keydown", handleActivity);
      clearInterval(decayInterval);
    };
  }, []);

  const checkUser = async () => {
    const storedId = localStorage.getItem("lifeos_user_id");
    if (!storedId) {
      router.push("/login");
      return;
    }
    setUserId(storedId);
    try {
      const res = await fetch(`http://localhost:8000/api/user/${encodeURIComponent(storedId)}`);
      if (res.status === 404) {
        // Stale session — clear it and force re-login
        localStorage.removeItem("lifeos_user_id");
        localStorage.removeItem("lifeos_user_email");
        localStorage.removeItem("lifeos_user_name");
        router.push("/login");
      } else if (res.ok) {
        const userData = await res.json();
        if (userData.total_focus_minutes) {
          setTotalFocusMinutes(userData.total_focus_minutes);
        }
      }
    } catch (err) {
      console.warn("Backend might be down or not connecting.", err);
    } finally {
      setIsAppLoading(false);
    }
  };

  const addLog = (agent: string, message: string) => {
    setLogs(prev => [...prev, {
      id: Date.now().toString() + Math.random(),
      agent,
      message,
      timestamp: new Date().toLocaleTimeString(),
      status: "completed"
    }]);
  };

  const handleCommand = async (commandType: string, label: string) => {
    if (isThinking) return;

    setIsThinking(true);
    addLog("User", `Triggered Action: ${label}`);

    if (commandType === "weekly_review") {
      setIsReviewOpen(true);
      setIsReviewLoading(true);
      setReviewData(null);
    }

    try {
      addLog("System", "Connecting to Agent Swarm...");
      const activeUserId = userId ?? localStorage.getItem("lifeos_user_id") ?? "guest";

      await streamAgentChat(activeUserId, label, commandType, {
        onPipelineLog: (node, message) => {
          addLog(node, message);
        },
        onStateUpdate: (focus, intent) => {
          if (focus > 0) setFocusProgress(focus);
        },
        onFinalResponse: (message, summary) => {
          if (commandType === "weekly_review") {
            try {
              const parsedJSON = JSON.parse(message);
              setReviewData(parsedJSON);
            } catch (e) {
              console.error("Failed to parse review JSON:", message);
            }
            setIsReviewLoading(false);
            addLog("System", `Weekly AI Review generated and displayed.`);
          } else {
            addLog("System", `Final Output: ${message}`);
          }
        },
        onError: (error) => {
          console.error(error);
          addLog("System_Error", error);
          if (commandType === "weekly_review") setIsReviewLoading(false);
        },
        onDone: () => {
          setIsThinking(false);
        }
      });

    } catch (error) {
      console.error(error);
      addLog("System_Error", "Failed to connect to backend engine.");
      setIsThinking(false);
      if (commandType === "weekly_review") setIsReviewLoading(false);
    }
  };

  const handleStartFocus = async (duration: number, apps: string[]) => {
    try {
      const res = await fetch("http://localhost:8000/api/focus/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ duration_minutes: duration, blocked_apps: apps, user_id: userId })
      });
      const data = await res.json();
      setIsFocusActive(true);
      setFocusEndTime(data.end_time);
      setIsFocusOpen(false); // Close setup modal
      addLog("System", `Deep Work Shield activated for ${duration} minutes. Blocked apps: ${apps.join(', ')}`);
    } catch (e) {
      console.error("Failed to start focus", e);
    }
  };

  const handleStopFocus = async () => {
    try {
      await fetch("http://localhost:8000/api/focus/stop", { method: "POST" });
      setIsFocusActive(false);
      setFocusEndTime(null);
      setIsFocusOpen(false);
      addLog("System", "Deep Work Shield deactivated early.");
      setTimeout(() => checkUser(), 1000); // Wait for backend to log time, then refresh
    } catch (e) {
      console.error("Failed to stop focus", e);
    }
  };

  const openClassroomAuthPopup = (): Promise<string> => {
    return new Promise((resolve, reject) => {
      const clientId = process.env.NEXT_PUBLIC_CLASSROOM_CLIENT_ID?.trim();
      if (!clientId) {
        reject(new Error("Classroom Client ID not set in .env.local"));
        return;
      }

      const redirectUri = `${window.location.origin}/auth/callback`;
      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: "token", 
        scope: "https://www.googleapis.com/auth/classroom.courses.readonly https://www.googleapis.com/auth/classroom.coursework.me.readonly",
        prompt: "consent",
      });
      
      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
      
      const popup = window.open(
        authUrl,
        "classroom-auth",
        `width=500,height=600,left=${Math.round(window.screenX + (window.outerWidth - 500) / 2)},top=${Math.round(window.screenY + (window.outerHeight - 600) / 2.5)},toolbar=no,menubar=no`
      );

      if (!popup) {
        reject(new Error("Popup blocked. Please allow popups."));
        return;
      }

      const handler = (event: MessageEvent) => {
        if (event.origin !== window.location.origin) return;
        if (!event.data?.type?.startsWith("GOOGLE_AUTH")) return;

        window.removeEventListener("message", handler);
        
        if (event.data.type === "GOOGLE_AUTH_ERROR") {
          reject(new Error(event.data.error || "Classroom auth cancelled"));
          return;
        }

        if (event.data.accessToken) {
          resolve(event.data.accessToken);
        } else {
          reject(new Error("No access token received"));
        }
      };

      window.addEventListener("message", handler);
      
      const pollClosed = setInterval(() => {
        if (popup.closed) {
          clearInterval(pollClosed);
          window.removeEventListener("message", handler);
          reject(new Error("Auth window closed"));
        }
      }, 500);
    });
  };

  const handleSyncClassroom = async () => {
    if (isThinking) return;
    setIsClassroomLoading(true);
    setClassroomData([]);
    setAssignmentsData([]);
    
    addLog("System", "Fetching Google Classroom data...");
    
    try {
      const activeUserId = userId ?? localStorage.getItem("lifeos_user_id") ?? "guest";
      
      const fetchCourses = async () => {
        const res = await fetch(`http://localhost:8000/api/classroom/${encodeURIComponent(activeUserId)}`);
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw { status: res.status, message: err.detail ?? "Failed to fetch classroom data" };
        }
        return res.json();
      };
      
      let data;
      try {
        data = await fetchCourses();
      } catch (err: any) {
        if ((err.status === 400 && err.message.includes("access token not found")) || err.status === 401) {
          addLog("System", "Classroom token missing or expired. Opening Google auth popup...");
          const token = await openClassroomAuthPopup();
          
          await fetch(`http://localhost:8000/api/classroom/${encodeURIComponent(activeUserId)}/token`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ access_token: token })
          });
          
          addLog("System", "Token acquired. Fetching data...");
          data = await fetchCourses();
        } else {
          throw err;
        }
      }
      
      setClassroomData(data.courses || []);
      setAssignmentsData(data.assignments || []);
      addLog("System", `Successfully fetched ${data.courses?.length || 0} courses and ${data.assignments?.length || 0} assignments.`);
    } catch (error: any) {
      console.error(error);
      addLog("System_Error", error.message || "Failed to fetch Google Classroom data");
    } finally {
      setIsClassroomLoading(false);
    }
  };


  const sidebarContent = (
    <div className="flex flex-col items-center gap-12 pt-8">
      <FocusRing progress={focusProgress} label="Performance Focus Score" />
      
      <div className="w-full text-center pb-4 border-b border-white/5">
        <p className="text-xs font-semibold tracking-widest text-silver uppercase mb-1">Deep Work Logged</p>
        <p className="text-3xl font-bold text-mint">{totalFocusMinutes} <span className="text-sm font-normal text-gray-400">mins</span></p>
      </div>

      <div className="w-full space-y-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-sm font-semibold tracking-widest text-silver uppercase">
            Google Classroom
          </h3>
          {classroomData.length > 0 && (
            <button 
               onClick={handleSyncClassroom}
               disabled={isClassroomLoading}
               className="text-[10px] px-2 py-1 bg-white/10 hover:bg-white/20 text-white rounded transition-colors"
            >
               {isClassroomLoading ? "..." : "↻ Sync"}
            </button>
          )}
        </div>

        {classroomData.length === 0 ? (
          <div className="p-6 rounded-xl bg-black/40 border border-white/5 text-center">
            <span className="text-2xl mb-2 block">📚</span>
            <p className="text-sm text-gray-400 mb-3">No courses synced yet.</p>
            <button 
              onClick={handleSyncClassroom}
              disabled={isClassroomLoading}
              className="text-xs px-4 py-2 bg-[#ADFFA6] text-black font-semibold rounded-lg hover:bg-[#9af093] transition-colors shadow-[0_0_15px_rgba(173,255,166,0.2)] disabled:opacity-50"
            >
              {isClassroomLoading ? "Syncing..." : "Sync Now"}
            </button>
          </div>
        ) : (
          <div className="space-y-6 max-h-[500px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
            {assignmentsData.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-mint flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-mint animate-pulse"></span>
                  UPCOMING DEADLINES
                </h4>
                {assignmentsData.slice(0, 5).map((work: any, idx: number) => {
                   const d = work.dueDate;
                   const t = work.dueTime;
                   const dateString = d ? `${d.month}/${d.day}/${d.year}` : "No due date";
                   const timeString = t ? `${t.hours}:${(t.minutes||0).toString().padStart(2, '0')}` : "";
                   return (
                     <div key={`cw-${idx}`} className="p-3 rounded-xl bg-mint/5 border border-mint/20 hover:border-mint/40 transition-colors">
                       <div className="flex justify-between items-start mb-1">
                         <span className="text-white font-medium text-sm truncate pr-2" title={work.title}>{work.title}</span>
                         <span className="text-[10px] text-mint bg-mint/10 px-2 py-0.5 rounded-full shrink-0 whitespace-nowrap">
                           {dateString} {timeString}
                         </span>
                       </div>
                       <p className="text-[10px] text-silver truncate mb-2">{work.courseName}</p>
                       <a href={work.alternateLink} target="_blank" rel="noopener noreferrer" className="text-[10px] text-[#ADFFA6] hover:underline inline-block">
                         Open Assignment ↗
                       </a>
                     </div>
                   );
                })}
              </div>
            )}
            
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-silver">ACTIVE COURSES</h4>
              {classroomData.map((course: any, idx: number) => (
                <div key={idx} className="p-4 rounded-xl bg-black/40 border border-white/5 hover:border-white/10 transition-colors">
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-mint font-medium text-sm truncate pr-2" title={course.name}>{course.name}</span>
                    {course.section && <span className="text-[10px] text-silver bg-white/10 px-2 py-0.5 rounded-full shrink-0 truncate max-w-[80px]" title={course.section}>{course.section}</span>}
                  </div>
                  <p className="text-xs text-gray-400 truncate">{course.descriptionHeading || "Active Course"}</p>
                  <a href={course.alternateLink} target="_blank" rel="noopener noreferrer" className="text-[10px] text-[#ADFFA6] hover:underline mt-2 inline-block">
                    View in Classroom ↗
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const centralArea = (
    <div className="flex-1 flex flex-col items-center justify-end pb-12 w-full z-10">
      {/* Floating Action Dock */}
      <div className="flex flex-row gap-2 sm:gap-4 p-3 sm:p-4 rounded-3xl bg-black/40 backdrop-blur-xl border border-white/10 shadow-2xl transition-all hover:bg-black/50">
        <button
          disabled={isThinking}
          onClick={() => handleCommand("auto_schedule", "Auto-Schedule My Day")}
          className="relative flex flex-col items-center justify-center p-3 w-16 h-16 sm:w-20 sm:h-20 rounded-2xl hover:bg-white/10 transition-all text-white hover:scale-110 group disabled:opacity-50"
        >
          <span className="text-2xl sm:text-3xl mb-1 group-hover:-translate-y-1 transition-transform">📅</span>
          <span className="text-[10px] font-medium opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap absolute -top-8 bg-black/80 px-2 py-1 rounded pointer-events-none">Schedule</span>
        </button>

        <button
          disabled={isThinking}
          onClick={() => setIsFocusOpen(true)}
          className="relative flex flex-col items-center justify-center p-3 w-16 h-16 sm:w-20 sm:h-20 rounded-2xl hover:bg-white/10 transition-all text-white hover:scale-110 group disabled:opacity-50"
        >
          <span className="text-2xl sm:text-3xl mb-1 group-hover:-translate-y-1 transition-transform">💻</span>
          <span className="text-[10px] font-medium opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap absolute -top-8 bg-black/80 px-2 py-1 rounded pointer-events-none">Deep Work</span>
        </button>

        <button
          disabled={isThinking}
          onClick={() => handleCommand("weekly_review", "Generate Weekly Review")}
          className="relative flex flex-col items-center justify-center p-3 w-16 h-16 sm:w-20 sm:h-20 rounded-2xl hover:bg-white/10 transition-all text-white hover:scale-110 group disabled:opacity-50"
        >
          <span className="text-2xl sm:text-3xl mb-1 group-hover:-translate-y-1 transition-transform">📊</span>
          <span className="text-[10px] font-medium opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap absolute -top-8 bg-black/80 px-2 py-1 rounded pointer-events-none">Review</span>
        </button>

        <button
          disabled={isThinking}
          onClick={() => handleCommand("study_today", "What Should I Study Today")}
          className="relative flex flex-col items-center justify-center p-3 w-16 h-16 sm:w-20 sm:h-20 rounded-2xl hover:bg-white/10 transition-all text-white hover:scale-110 group disabled:opacity-50"
        >
          <span className="text-2xl sm:text-3xl mb-1 group-hover:-translate-y-1 transition-transform">📚</span>
          <span className="text-[10px] font-medium opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap absolute -top-8 bg-black/80 px-2 py-1 rounded pointer-events-none">Study Topics</span>
        </button>
        
        <button
          disabled={isThinking}
          onClick={() => handleCommand("study_plan", "Generate Study Plan")}
          className="relative flex flex-col items-center justify-center p-3 w-16 h-16 sm:w-20 sm:h-20 rounded-2xl hover:bg-white/10 transition-all text-white hover:scale-110 group disabled:opacity-50"
        >
          <span className="text-2xl sm:text-3xl mb-1 group-hover:-translate-y-1 transition-transform">🎯</span>
          <span className="text-[10px] font-medium opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap absolute -top-8 bg-black/80 px-2 py-1 rounded pointer-events-none">Study Plan</span>
        </button>
      </div>
    </div>
  );

  if (!mounted) return null;

  if (isAppLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-mint">
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} className="w-8 h-8 flex border-2 border-mint/20 border-t-mint rounded-full" />
      </div>
    );
  }

  return (
    <div className="relative w-full h-full min-h-screen">
      <ParticleBackground />
      <div className="relative z-10 w-full h-full pointer-events-none">
        <div className="pointer-events-auto">
          <DashboardLayout
            sidebarContent={sidebarContent}
            centralArea={centralArea}
            logs={logs}
          />
        </div>
      </div>
      <WeeklyReviewModal
        isOpen={isReviewOpen}
        onClose={() => setIsReviewOpen(false)}
        isLoading={isReviewLoading}
        data={reviewData}
      />
      <FocusModal
        isOpen={isFocusOpen}
        onClose={() => setIsFocusOpen(false)}
        onStart={handleStartFocus}
        onStop={handleStopFocus}
        active={isFocusActive}
        endTime={focusEndTime}
      />
    </div>
  );
}
