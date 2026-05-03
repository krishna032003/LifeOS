"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { streamAgentChat, API_BASE } from "@/services/api";
import DashboardLayout from "@/components/DashboardLayout";
import AppSidebar from "@/components/AppSidebar";
import CenterPanel from "@/components/CenterPanel";
import WeeklyReviewModal from "@/components/WeeklyReviewModal";
import FocusModal from "@/components/FocusModal";
import TimetableModal from "@/components/TimetableModal";
import MaterialsModal from "@/components/MaterialsModal";
import { motion } from "framer-motion";

interface Course { id?: string; name?: string; section?: string; descriptionHeading?: string; alternateLink?: string; }
interface Assignment { title?: string; dueDate?: { year: number; month: number; day: number }; dueTime?: { hours: number; minutes: number }; courseName?: string; alternateLink?: string; }

type PipelineStatus = "idle" | "thinking" | "streaming" | "done" | "error";

export default function Home() {
  const router = useRouter();

  // Auth / loading
  const [userId, setUserId] = useState<string | null>(null);
  const [isAppLoading, setIsAppLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  // Agent state
  const [isThinking, setIsThinking] = useState(false);
  const [pipelineStatus, setPipelineStatus] = useState<PipelineStatus>("idle");
  const [logs, setLogs] = useState([{ id: "1", agent: "System", message: "LifeOS initialized. Standing by.", timestamp: "", status: "completed" as const }]);

  // Focus tracking
  const [focusProgress, setFocusProgress] = useState(0);
  const [totalFocusMinutes, setTotalFocusMinutes] = useState(0);

  // Chat
  const [chatInput, setChatInput] = useState("");
  const [chatHistory, setChatHistory] = useState<{ id: string; role: "user" | "ai"; text: string }[]>([]);
  const [finalAnswer, setFinalAnswer] = useState("");

  // Sidebar nav
  const [activeNav, setActiveNav] = useState("command");

  // Modals
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [isReviewLoading, setIsReviewLoading] = useState(false);
  const [reviewData, setReviewData] = useState(null);
  const [isFocusOpen, setIsFocusOpen] = useState(false);
  const [isFocusActive, setIsFocusActive] = useState(false);
  const [focusEndTime, setFocusEndTime] = useState<string | null>(null);
  const [isTimetableOpen, setIsTimetableOpen] = useState(false);
  const [isMaterialsOpen, setIsMaterialsOpen] = useState(false);

  // Classroom
  const [isClassroomLoading, setIsClassroomLoading] = useState(false);
  const [classroomData, setClassroomData] = useState<Course[]>([]);
  const [assignmentsData, setAssignmentsData] = useState<Assignment[]>([]);

  useEffect(() => {
    setMounted(true);
    setLogs(prev => [{ ...prev[0], timestamp: new Date().toLocaleTimeString() }]);
    checkUser();

    fetch(`${API_BASE}/api/focus/status`)
      .then(r => r.json())
      .then(d => { if (d.active) { setIsFocusActive(true); setFocusEndTime(d.end_time); } })
      .catch(() => {});

    // Activity-based focus score
    let activityLevel = 0;
    const tick = () => { activityLevel += 0.05; if (activityLevel > 100) activityLevel = 100; setFocusProgress(p => Math.min(100, Math.max(0, Math.floor(p + activityLevel * 0.05)))); };
    const decay = setInterval(() => { activityLevel = Math.max(0, activityLevel - 2); if (activityLevel === 0) setFocusProgress(p => Math.max(0, p - 1)); }, 2000);
    window.addEventListener("mousemove", tick);
    window.addEventListener("click", tick);
    window.addEventListener("keydown", tick);
    return () => { window.removeEventListener("mousemove", tick); window.removeEventListener("click", tick); window.removeEventListener("keydown", tick); clearInterval(decay); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const checkUser = async () => {
    const id = localStorage.getItem("lifeos_user_id");
    if (!id) { router.push("/login"); return; }
    setUserId(id);
    try {
      const r = await fetch(`${API_BASE}/api/user/${encodeURIComponent(id)}`);
      if (r.status === 404) { localStorage.removeItem("lifeos_user_id"); router.push("/login"); return; }
      if (r.ok) { const d = await r.json(); if (d.total_focus_minutes) setTotalFocusMinutes(d.total_focus_minutes); }
    } catch { /* backend may be offline */ } finally { setIsAppLoading(false); }
  };

  const addLog = (agent: string, message: string, isFinal = false) => {
    setLogs(prev => [...prev, { id: Date.now().toString() + Math.random(), agent, message, timestamp: new Date().toLocaleTimeString(), status: "completed", isFinal } as typeof prev[0]]);
  };

  const handleCommand = async (commandType: string, label: string) => {
    if (isThinking) return;
    setIsThinking(true);
    setFinalAnswer("");
    setPipelineStatus("thinking");
    addLog("User", `Triggered: ${label}`);

    if (commandType === "weekly_review") { setIsReviewOpen(true); setIsReviewLoading(true); setReviewData(null); }

    try {
      addLog("System", "Connecting to Agent Swarm…");
      const uid = userId ?? localStorage.getItem("lifeos_user_id") ?? "guest";
      await streamAgentChat(uid, label, commandType, {
        onPipelineLog: (node, message) => { setPipelineStatus("streaming"); addLog(node, message); },
        onStateUpdate: (focus) => { if (focus > 0) setFocusProgress(focus); },
        onFinalResponse: (message) => {
          if (commandType === "weekly_review") {
            try { setReviewData(JSON.parse(message)); } catch { /* ignore */ }
            setIsReviewLoading(false);
            addLog("System", "Weekly AI Review ready.", true);
          } else {
            setFinalAnswer(message);
            addLog("Reflection", "Final response ready.", true);
          }
          setPipelineStatus("done");
        },
        onError: (error) => {
          addLog("System_Error", error);
          setPipelineStatus("error");
          if (commandType === "weekly_review") setIsReviewLoading(false);
        },
        onDone: () => { setIsThinking(false); },
      });
    } catch {
      addLog("System_Error", "Failed to connect to backend engine.");
      setPipelineStatus("error");
      setIsThinking(false);
      if (commandType === "weekly_review") setIsReviewLoading(false);
    }
  };

  const handleChatSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!chatInput.trim() || isThinking) return;
    const input = chatInput.trim();
    setChatInput("");
    setFinalAnswer("");
    const uid = Date.now().toString();
    const aiId = uid + "_ai";
    setChatHistory(prev => [...prev, { role: "user", text: input, id: uid }, { role: "ai", text: "", id: aiId }]);
    setIsThinking(true);
    setPipelineStatus("thinking");
    addLog("User", `Chat: ${input}`);

    try {
      const activeUid = userId ?? localStorage.getItem("lifeos_user_id") ?? "guest";
      await streamAgentChat(activeUid, input, "general_chat", {
        onPipelineLog: (node, message) => { setPipelineStatus("streaming"); addLog(node, message); },
        onStateUpdate: (focus) => { if (focus > 0) setFocusProgress(focus); },
        onFinalResponse: (message) => {
          setChatHistory(prev => prev.map(m => m.id === aiId ? { ...m, text: message } : m));
          setFinalAnswer(message);
          addLog("Reflection", "Final response ready.", true);
          setPipelineStatus("done");
        },
        onError: (error) => {
          addLog("System_Error", error);
          setChatHistory(prev => prev.map(m => m.id === aiId ? { ...m, text: `Error: ${error}` } : m));
          setPipelineStatus("error");
        },
        onDone: () => { setIsThinking(false); },
      });
    } catch {
      addLog("System_Error", "Failed to connect to backend engine.");
      setPipelineStatus("error");
      setIsThinking(false);
    }
  };

  const handleNav = (key: string) => {
    setActiveNav(key);
    if (key === "timetable") setIsTimetableOpen(true);
    if (key === "materials") setIsMaterialsOpen(true);
    if (key === "focus")     setIsFocusOpen(true);
    if (key === "review")    handleCommand("weekly_review", "Generate Weekly Review");
  };

  const handleStartFocus = async (duration: number, apps: string[]) => {
    try {
      const r = await fetch(`${API_BASE}/api/focus/start`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ duration_minutes: duration, blocked_apps: apps, user_id: userId }) });
      const d = await r.json();
      setIsFocusActive(true); setFocusEndTime(d.end_time); setIsFocusOpen(false);
      addLog("System", `Deep Work activated for ${duration}min.`);
    } catch { /* ignore */ }
  };

  const handleStopFocus = async () => {
    try {
      await fetch(`${API_BASE}/api/focus/stop`, { method: "POST" });
      setIsFocusActive(false); setFocusEndTime(null); setIsFocusOpen(false);
      addLog("System", "Deep Work deactivated.");
      setTimeout(() => checkUser(), 1000);
    } catch { /* ignore */ }
  };

  const openClassroomAuthPopup = (): Promise<string> => new Promise((resolve, reject) => {
    let clientId = process.env.NEXT_PUBLIC_CLASSROOM_CLIENT_ID?.trim();
    if (!clientId) {
      clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim();
    }
    if (!clientId || !clientId.endsWith(".apps.googleusercontent.com")) {
      addLog("System", "No valid Google OAuth client ID found. Set NEXT_PUBLIC_CLASSROOM_CLIENT_ID or NEXT_PUBLIC_GOOGLE_CLIENT_ID in frontend/.env.local and restart npm dev.");
      reject(new Error("Classroom Client ID invalid"));
      return;
    }
    console.log("Using Classroom Client ID:", clientId.substring(0, 5) + "..." + clientId.slice(-25));
    const redirectUri = `${window.location.origin}/auth/callback`;
    const params = new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri, response_type: "token", scope: "https://www.googleapis.com/auth/classroom.courses.readonly https://www.googleapis.com/auth/classroom.coursework.me.readonly https://www.googleapis.com/auth/classroom.courseworkmaterials.readonly https://www.googleapis.com/auth/drive.readonly", prompt: "consent" });
    const popup = window.open(`https://accounts.google.com/o/oauth2/v2/auth?${params}`, "classroom-auth", `width=500,height=600`);
    if (!popup) { reject(new Error("Popup blocked")); return; }
    const handler = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (!event.data?.type?.startsWith("GOOGLE_AUTH")) return;
      window.removeEventListener("message", handler);
      if (event.data.type === "GOOGLE_AUTH_ERROR") { reject(new Error(event.data.error)); return; }
      if (event.data.accessToken) resolve(event.data.accessToken); else reject(new Error("No token"));
    };
    window.addEventListener("message", handler);
    const poll = setInterval(() => { if (popup.closed) { clearInterval(poll); window.removeEventListener("message", handler); reject(new Error("Window closed")); } }, 500);
  });

  const handleSyncClassroom = async () => {
    if (isThinking) return;
    setIsClassroomLoading(true);
    setClassroomData([]); setAssignmentsData([]);
    addLog("System", "Fetching Classroom data…");
    try {
      const uid = userId ?? localStorage.getItem("lifeos_user_id") ?? "guest";
      const fetchCourses = async () => { const r = await fetch(`${API_BASE}/api/classroom/${encodeURIComponent(uid)}`); if (!r.ok) { const e = await r.json().catch(() => ({})); throw { status: r.status, message: e.detail ?? "Failed" }; } return r.json(); };
      let data;
      try { data = await fetchCourses(); }
      catch (err: unknown) {
        const e = err as { status?: number; message?: string };
        if ((e.status === 400 && e.message?.includes("access token")) || e.status === 401) {
          addLog("System", "Opening Classroom auth popup…");
          const token = await openClassroomAuthPopup();
          await fetch(`${API_BASE}/api/classroom/${encodeURIComponent(uid)}/token`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ access_token: token }) });
          data = await fetchCourses();
        } else throw err;
      }
      setClassroomData(data.courses || []);
      setAssignmentsData(data.assignments || []);
      addLog("System", `Fetched ${data.courses?.length || 0} courses, ${data.assignments?.length || 0} assignments.`);
    } catch (err: unknown) {
      const e = err as Error;
      addLog("System_Error", e.message || "Failed to fetch Classroom data");
    } finally { setIsClassroomLoading(false); }
  };

  if (!mounted || isAppLoading) {
    return (
      <div className="min-h-screen bg-[#080809] flex items-center justify-center">
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} className="w-7 h-7 border-2 border-emerald-400/20 border-t-emerald-400 rounded-full" />
      </div>
    );
  }

  return (
    <div className="relative w-full h-screen overflow-hidden bg-[#080809]">
      {/* Subtle background gradient */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-emerald-500/3 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[200px] bg-purple-500/3 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 h-full flex flex-col">
        <DashboardLayout
          sidebarContent={
            <AppSidebar
              focusProgress={focusProgress}
              totalFocusMinutes={totalFocusMinutes}
              isFocusActive={isFocusActive}
              classroomData={classroomData}
              assignmentsData={assignmentsData}
              isClassroomLoading={isClassroomLoading}
              onSyncClassroom={handleSyncClassroom}
              onNav={handleNav}
              activeNav={activeNav}
            />
          }
          centralArea={
            <CenterPanel
              chatHistory={chatHistory}
              chatInput={chatInput}
              setChatInput={setChatInput}
              onSubmit={handleChatSubmit}
              isThinking={isThinking}
              finalAnswer={finalAnswer}
              assignmentsData={assignmentsData}
              totalFocusMinutes={totalFocusMinutes}
              onAction={handleCommand}
              onOpenTimetable={() => setIsTimetableOpen(true)}
              onOpenFocus={() => setIsFocusOpen(true)}
              onOpenMaterials={() => setIsMaterialsOpen(true)}
            />
          }
          logs={logs}
          pipelineStatus={pipelineStatus}
        />
      </div>

      <WeeklyReviewModal isOpen={isReviewOpen} onClose={() => setIsReviewOpen(false)} isLoading={isReviewLoading} data={reviewData} />
      <FocusModal isOpen={isFocusOpen} onClose={() => setIsFocusOpen(false)} onStart={handleStartFocus} onStop={handleStopFocus} active={isFocusActive} endTime={focusEndTime} />
      <TimetableModal isOpen={isTimetableOpen} onClose={() => setIsTimetableOpen(false)} userId={userId} />
      <MaterialsModal isOpen={isMaterialsOpen} onClose={() => setIsMaterialsOpen(false)} userId={userId} />
    </div>
  );
}
