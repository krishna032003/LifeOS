"use client";
import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { API_BASE } from "@/services/api";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { X, Plus, Trash2, BookOpen, Brain, FileText, ChevronRight, ChevronLeft, ExternalLink, AlertTriangle, Loader2, GraduationCap, PenLine, CheckSquare, Square } from "lucide-react";

interface Material { id:string; title:string; source?:string; courseName?:string; content_available?:boolean; created_at:string; topicName?:string; content_status?:string; content_type?:string; driveFileId?:string; mimeType?:string; }
interface ClassroomCourse { courseId:string; courseName:string; section?:string; topics?:{id:string;name:string}[]; materials:{type:string;title:string;alternateLink?:string;driveFileId?:string;courseId:string;courseName:string;mimeType?:string;sourceType?:string;parentTitle?:string;topicName?:string;content_type?:string;}[]; }
interface QResult { answer?:string; sources?:string[]; fallback_used?:boolean; confidence?:number; missing_content_materials?:{id:string;title:string}[]; chunks_used?:number; selected_materials?:string[]; action_type?:string; }

const ACTIONS = [
  {id:"summarize",label:"Summarize"},{id:"exam_notes",label:"Exam Notes"},{id:"mcqs",label:"Generate MCQs"},
  {id:"important_topics",label:"Key Topics"},{id:"explain_simply",label:"Explain Simply"},{id:"revision_plan",label:"Revision Plan"},
];

const md:Record<string,React.FC<React.ComponentPropsWithoutRef<'code'>&{className?:string}>> = {
  h1:({...p})=><h1 className="text-sm font-bold text-white mt-3 mb-1.5" {...p}/>,
  h2:({...p})=><h2 className="text-xs font-bold text-white/90 mt-3 mb-1" {...p}/>,
  p:({...p})=><p className="mb-2 leading-relaxed text-white/65 text-xs" {...p}/>,
  ul:({...p})=><ul className="list-disc pl-4 mb-3 text-white/70 text-xs space-y-1.5" {...p}/>,
  ol:({...p})=><ol className="list-decimal pl-4 mb-3 text-white/70 text-xs space-y-1.5" {...p}/>,
  li:({...p})=><li className="leading-relaxed" {...p}/>,
  strong:({...p})=><strong className="font-semibold text-white/90" {...p}/>,
  code:({className,children,...p})=>{
    const b=/language-(\w+)/.exec(className||'');
    return b?<pre className="bg-black/50 p-2 rounded-lg text-[10px] font-mono my-2 border border-white/8 overflow-x-auto"><code className={className} {...p}>{children}</code></pre>
      :<code className="bg-white/8 px-1 rounded text-[10px] text-emerald-400 font-mono" {...p}>{children}</code>;
  },
};

export default function MaterialsModal({isOpen,onClose,userId}:{isOpen:boolean;onClose:()=>void;userId:string|null}){
  // Flow state
  const [step,setStep]=useState<"source"|"classroom"|"manual"|"browse"|"query">("source");
  // Materials from backend
  const [materials,setMaterials]=useState<Material[]>([]);
  const [selected,setSelected]=useState<Set<string>>(new Set());
  // Classroom
  const [courses,setCourses]=useState<ClassroomCourse[]>([]);
  const [activeCourse,setActiveCourse]=useState<string|null>(null);
  const [classroomLoading,setClassroomLoading]=useState(false);
  const [classroomError,setClassroomError]=useState("");
  const [importing,setImporting]=useState(false);
  const [classroomSelected,setClassroomSelected]=useState<Set<number>>(new Set());
  // Manual add
  const [noteTitle,setNoteTitle]=useState("");
  const [noteContent,setNoteContent]=useState("");
  const [saving,setSaving]=useState(false);
  // Paste content for metadata-only materials
  const [pasteTarget,setPasteTarget]=useState<string|null>(null);
  const [pasteText,setPasteText]=useState("");
  const [pasteSaving,setPasteSaving]=useState(false);
  // Query
  const [query,setQuery]=useState("");
  const [querying,setQuerying]=useState(false);
  const [queryProgress, setQueryProgress]=useState("Analyzing…");
  const [abortController, setAbortController]=useState<AbortController | null>(null);
  const [result,setResult]=useState<QResult|null>(null);
  const [extractingId,setExtractingId]=useState<string|null>(null);
  const [extractErrors,setExtractErrors]=useState<Record<string,string>>({});
  const [driveDebugLogs, setDriveDebugLogs] = useState<Record<string,Record<string,unknown>>>({});
  const [materialsError, setMaterialsError] = useState("");

  const handleDebugDrive=async(matId:string, driveId:string)=>{
    if(!userId) return;
    setDriveDebugLogs(p=>({...p, [matId]: { loading: true }}));
    try{
      const r=await fetch(`${API_BASE}/api/debug/drive?user_id=${userId}&drive_file_id=${driveId}`);
      const d=await r.json();
      setDriveDebugLogs(p=>({...p, [matId]:d}));
    }catch(e:unknown){
      setDriveDebugLogs(p=>({...p, [matId]:{error:(e as Error).message}}));
    }
  };

  const fetchMaterials=useCallback(async()=>{
    if(!userId) return;
    try{
      const r=await fetch(`${API_BASE}/api/materials/${userId}`);
      if(r.ok){
        const d=await r.json();
        setMaterials(d.materials||[]);
        setMaterialsError("");
      } else {
        setMaterialsError("Failed to load materials.");
      }
    }catch{
      setMaterialsError("Network error while loading materials.");
    }
  },[userId]);

  useEffect(()=>{if(isOpen&&userId){fetchMaterials();setStep("source");setResult(null);setCourses([]);setClassroomError("");}},[isOpen,userId,fetchMaterials]);

  const fetchClassroomMaterials=async()=>{
    if(!userId) return;
    setClassroomLoading(true);setClassroomError("");setCourses([]);
    try{
      const r=await fetch(`${API_BASE}/api/classroom/${userId}/materials`);
      if(!r.ok){const e=await r.json().catch(()=>({}));throw new Error(e.detail||"Failed");}
      const d=await r.json();setCourses(d.courses||[]);
    }catch(e:unknown){setClassroomError((e as Error).message||"Failed to load");}
    finally{setClassroomLoading(false);}
  };

  const handleImportSelected=async()=>{
    if(!userId||!activeCourse) return;
    const course=courses.find(c=>c.courseId===activeCourse);
    if(!course) return;
    const mats=course.materials.filter((_,i)=>classroomSelected.has(i));
    if(mats.length===0) return;
    setImporting(true);
    try{
      const r=await fetch(`${API_BASE}/api/materials/import-classroom`,{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({user_id:userId,materials:mats})
      });
      if(r.ok){await fetchMaterials();setClassroomSelected(new Set());setStep("browse");}
    }catch{}finally{setImporting(false);}
  };

  const handleSaveManual=async()=>{
    if(!noteTitle||!noteContent||!userId) return;
    setSaving(true);
    try{
      const r=await fetch(`${API_BASE}/api/materials`,{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({user_id:userId,title:noteTitle,content:noteContent})});
      if(r.ok){setNoteTitle("");setNoteContent("");await fetchMaterials();setStep("browse");}
    }catch{}finally{setSaving(false);}
  };

  const handlePasteContent=async()=>{
    if(!userId||!pasteTarget||!pasteText.trim()) return;
    setPasteSaving(true);
    try{
      await fetch(`${API_BASE}/api/materials/${userId}/${pasteTarget}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({content:pasteText})});
      await fetchMaterials();setPasteTarget(null);setPasteText("");
    }catch{}finally{setPasteSaving(false);}
  };

  const handleExtractContent=async(matId:string, driveFileId:string, mimeType:string)=>{
    if(!userId) return;
    setExtractingId(matId);
    setExtractErrors(prev => ({...prev, [matId]: ""}));
    try{
      const r=await fetch(`${API_BASE}/api/materials/extract-content?user_id=${userId}&drive_file_id=${driveFileId}&mime_type=${encodeURIComponent(mimeType)}&material_id=${matId}`,{method:"POST"});
      const d=await r.json();
      if(d.success||d.content_status==="ready"){
        // Backend auto-updates DB now
        await fetchMaterials();
      } else {
        setExtractErrors(prev => ({...prev, [matId]: d.error || "Extraction failed"}));
      }
    }catch{
      setExtractErrors(prev => ({...prev, [matId]: "Failed to contact server."}));
    }finally{
      setExtractingId(null);
      await fetchMaterials();
    }
  };

  const handleDelete=async(id:string)=>{
    if(!userId) return;
    try{await fetch(`${API_BASE}/api/materials/${userId}/${id}`,{method:"DELETE"});fetchMaterials();}catch{}
  };

  const toggle=(id:string)=>setSelected(p=>{const n=new Set(p);if(n.has(id)){n.delete(id);}else{n.add(id);}return n;});
  const toggleCm=(i:number)=>setClassroomSelected(p=>{const n=new Set(p);if(n.has(i)){n.delete(i);}else{n.add(i);}return n;});

  const handleQuery=async(q?:string,action?:string)=>{
    const fq=q||query;if(!fq||!userId) return;
    
    if (abortController) {
      abortController.abort();
    }
    const controller = new AbortController();
    setAbortController(controller);

    setQuery(fq);
    setQuerying(true);
    setResult(null);
    setQueryProgress("Selecting chunks…");
    try{
      const selectedMats = materials.filter(m => selected.has(m.id));
      const needsExtract = selectedMats.filter(m => m.source==="classroom" && (!m.content_status || m.content_status==="metadata_only") && m.driveFileId);
      
      if (needsExtract.length > 0) {
        setQueryProgress("Extracting missing documents…");
        for (const m of needsExtract) {
          const mime = m.mimeType || m.content_type || "";
          await fetch(`${API_BASE}/api/materials/extract-content?user_id=${userId}&material_id=${m.id}&drive_file_id=${m.driveFileId}&mime_type=${encodeURIComponent(mime)}`,{method:"POST"}).catch(()=>{});
        }
      }

      setQueryProgress("Asking AI…");
      const body:Record<string,unknown>={user_id:userId,query:fq};
      if(selected.size>0) body.material_ids=Array.from(selected);
      if(action) body.quick_action=action;
      
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      
      const r=await fetch(`${API_BASE}/api/materials/query`,{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify(body),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      
      const d=await r.json();
      if (!r.ok && !d.answer) {
        throw new Error(d.detail || "Server error");
      }
      setResult(d);
      
      if (needsExtract.length > 0) fetchMaterials();
    }catch(e: unknown){
      const error = e as Error;
      console.error("[RAG] Query fetch error:", error);
      if (error.name === "AbortError") {
        setResult({answer:"**AI took too long.**\n\nFallback local summary mode triggered.", fallback_used: true});
      } else {
        setResult({answer:`**Connection error.**\n\n${error.message || "Failed to reach backend."}`});
      }
    }finally{
      setQuerying(false);
      setAbortController(null);
    }
  };

  if(!isOpen) return null;

  const courseData=activeCourse?courses.find(c=>c.courseId===activeCourse):null;

  return(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <motion.div initial={{opacity:0,scale:0.96}} animate={{opacity:1,scale:1}}
        className="relative w-full max-w-4xl bg-[#0c0d10] border border-white/8 rounded-2xl shadow-2xl flex flex-col max-h-[88vh] overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/5 shrink-0">
          <div className="flex items-center gap-2">
            <Brain size={15} className="text-emerald-400"/>
            <h2 className="text-[13px] font-bold text-white">Study RAG</h2>
            {selected.size>0&&<span className="text-[9px] px-2 py-0.5 rounded-full bg-emerald-400/15 text-emerald-400">{selected.size} selected</span>}
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white transition-colors"><X size={15}/></button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">

          {/* STEP: SOURCE SELECTION */}
          {step==="source"&&(
            <div className="space-y-4">
              <p className="text-[10px] text-white/30 uppercase tracking-wider font-semibold">Choose Source</p>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={()=>{setStep("classroom");fetchClassroomMaterials();}}
                  className="p-5 rounded-xl border border-white/8 bg-white/3 hover:bg-white/6 hover:border-emerald-400/30 transition-all text-left group">
                  <GraduationCap size={20} className="text-emerald-400/70 mb-2 group-hover:text-emerald-400"/>
                  <p className="text-xs font-semibold text-white/80">Google Classroom</p>
                  <p className="text-[10px] text-white/30 mt-1">Import materials from your courses</p>
                </button>
                <button onClick={()=>setStep("manual")}
                  className="p-5 rounded-xl border border-white/8 bg-white/3 hover:bg-white/6 hover:border-violet-400/30 transition-all text-left group">
                  <PenLine size={20} className="text-violet-400/70 mb-2 group-hover:text-violet-400"/>
                  <p className="text-xs font-semibold text-white/80">Manual Notes</p>
                  <p className="text-[10px] text-white/30 mt-1">Paste your own study text</p>
                </button>
              </div>
              {materials.length>0&&(
                <button onClick={()=>setStep("browse")} className="w-full py-2 bg-white/4 border border-white/8 rounded-lg text-[10px] text-white/40 hover:text-white/70 transition-colors">
                  View {materials.length} saved material{materials.length>1?"s":""} →
                </button>
              )}
            </div>
          )}

          {/* STEP: CLASSROOM */}
          {step==="classroom"&&(
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button onClick={()=>{setStep("source");setActiveCourse(null);}} className="text-white/30 hover:text-white/60"><ChevronLeft size={14}/></button>
                  <p className="text-[10px] text-white/30 uppercase tracking-wider font-semibold">Google Classroom</p>
                </div>
                <div className="text-right">
                  <p className="text-[8px] text-white/30 mb-1">
                    OAuth: {(process.env.NEXT_PUBLIC_CLASSROOM_CLIENT_ID?.trim() || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim())?.endsWith('.apps.googleusercontent.com') ? <span className="text-emerald-400">Configured</span> : <span className="text-red-400">Missing/Invalid</span>}
                  </p>
                  <button onClick={() => {
                    let clientId = process.env.NEXT_PUBLIC_CLASSROOM_CLIENT_ID?.trim();
                    if (!clientId) {
                      clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim();
                    }
                    if (!clientId || !clientId.endsWith(".apps.googleusercontent.com")) {
                      setClassroomError("No valid Google OAuth client ID found. Set NEXT_PUBLIC_CLASSROOM_CLIENT_ID or NEXT_PUBLIC_GOOGLE_CLIENT_ID in frontend/.env.local and restart npm dev.");
                      return;
                    }
                    setClassroomError("");
                    console.log("Using Classroom Client ID:", clientId.substring(0, 5) + "..." + clientId.slice(-25));
                  const redirectUri = `${window.location.origin}/auth/callback`;
                  const params = new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri, response_type: "token", scope: "https://www.googleapis.com/auth/classroom.courses.readonly https://www.googleapis.com/auth/classroom.coursework.me.readonly https://www.googleapis.com/auth/classroom.courseworkmaterials.readonly https://www.googleapis.com/auth/drive.readonly", prompt: "consent" });
                  const popup = window.open(`https://accounts.google.com/o/oauth2/v2/auth?${params}`, "classroom-auth", `width=500,height=600`);
                  if (!popup) { alert("Popup blocked"); return; }
                  const handler = async (event: MessageEvent) => {
                    if (event.origin !== window.location.origin) return;
                    if (event.data?.type === "GOOGLE_AUTH_SUCCESS" && event.data?.accessToken) {
                      window.removeEventListener("message", handler);
                      if (userId) {
                        await fetch(`${API_BASE}/api/classroom/${encodeURIComponent(userId)}/token`, { 
                          method: "POST", 
                          headers: { "Content-Type": "application/json" }, 
                          body: JSON.stringify({ access_token: event.data.accessToken }) 
                        });
                      }
                      alert("Successfully reconnected with Drive access. You can now extract materials.");
                      fetchClassroomMaterials();
                    }
                  };
                  window.addEventListener("message", handler);
                }} className="text-[9px] px-2 py-1 bg-amber-400/10 text-amber-400 border border-amber-400/20 rounded hover:bg-amber-400/20 transition-colors">
                  Reconnect Google Classroom + Drive
                  </button>
                </div>
              </div>

              {classroomLoading&&<div className="py-12 text-center"><Loader2 size={18} className="animate-spin text-emerald-400 mx-auto mb-2"/><p className="text-[10px] text-white/30">Fetching courses…</p></div>}
              {classroomError&&<div className="p-3 rounded-lg bg-red-400/8 border border-red-400/20 text-[10px] text-red-400"><AlertTriangle size={12} className="inline mr-1"/>{classroomError}</div>}

              {!classroomLoading&&!classroomError&&courses.length===0&&!classroomLoading&&(
                <div className="py-12 text-center"><GraduationCap size={24} className="mx-auto mb-2 text-white/15"/><p className="text-[10px] text-white/30">No active courses found</p></div>
              )}

              {/* Course list */}
              {!activeCourse&&courses.length>0&&(
                <div className="grid grid-cols-1 gap-2">
                  {courses.map(c=>(
                    <button key={c.courseId} onClick={()=>{setActiveCourse(c.courseId);setClassroomSelected(new Set());}}
                      className="flex items-center justify-between p-3 rounded-xl border border-white/8 bg-white/3 hover:bg-white/6 hover:border-white/15 transition-all text-left">
                      <div>
                        <p className="text-xs font-medium text-white/80">{c.courseName}</p>
                        <p className="text-[10px] text-white/30">{c.materials.length} material{c.materials.length!==1?"s":""}{c.section?` · ${c.section}`:""}</p>
                      </div>
                      <ChevronRight size={12} className="text-white/20"/>
                    </button>
                  ))}
                </div>
              )}

              {/* Materials in selected course */}
              {activeCourse&&courseData&&(
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <button onClick={()=>setActiveCourse(null)} className="text-white/30 hover:text-white/60"><ChevronLeft size={12}/></button>
                    <p className="text-xs font-medium text-white/70">{courseData.courseName}</p>
                  </div>

                  {courseData.materials.length===0?(
                    <p className="text-[10px] text-white/30 py-8 text-center">No materials found in this course</p>
                  ):(
                    <>
                      <div className="space-y-1.5">
                        {courseData.materials.map((m,i)=>(
                          <div key={i} onClick={()=>toggleCm(i)}
                            className={`flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-all ${classroomSelected.has(i)?"border-emerald-400/40 bg-emerald-400/5":"border-white/6 bg-white/2 hover:bg-white/4"}`}>
                            {classroomSelected.has(i)?<CheckSquare size={13} className="text-emerald-400 mt-0.5 shrink-0"/>:<Square size={13} className="text-white/20 mt-0.5 shrink-0"/>}
                            <div className="flex-1 min-w-0">
                              <p className="text-[11px] text-white/75 font-medium truncate">{m.title}</p>
                              <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                                <span className="text-[9px] text-white/25 px-1.5 py-px rounded bg-white/5">{m.type}</span>
                                {m.content_type&&m.content_type!=="unknown"&&<span className="text-[9px] text-emerald-400/70">{m.content_type}</span>}
                                {m.topicName&&<span className="text-[9px] text-white/40 border border-white/10 px-1 rounded truncate max-w-[100px]">{m.topicName}</span>}
                                {!m.topicName&&m.parentTitle&&<span className="text-[9px] text-white/20 truncate">{m.parentTitle}</span>}
                              </div>
                            </div>
                            {m.alternateLink&&<a href={m.alternateLink} target="_blank" rel="noopener noreferrer" onClick={e=>e.stopPropagation()} className="text-white/20 hover:text-emerald-400 shrink-0"><ExternalLink size={11}/></a>}
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <button onClick={handleImportSelected} disabled={classroomSelected.size===0||importing}
                          className="flex-1 py-2.5 bg-emerald-400/15 border border-emerald-400/25 text-emerald-400 text-xs font-medium rounded-xl hover:bg-emerald-400/20 disabled:opacity-40 transition-colors">
                          {importing?"Importing…":`Import ${classroomSelected.size} Selected`}
                        </button>
                      </div>
                      <p className="text-[9px] text-white/20 leading-relaxed">Imported materials will be metadata-only. Click Auto-Extract in the Saved Materials view to enable AI analysis.</p>
                    </>
                  )}
                  
                  {/* Debug Panel */}
                  <div className="mt-6 pt-4 border-t border-white/10">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[10px] text-white/40 font-mono">DEBUG: Course Data (Real-time)</p>
                      <button onClick={async () => {
                        try {
                          const r = await fetch(`${API_BASE}/api/classroom/${userId}/materials/debug`);
                          const d = await r.json();
                          if (d.counts) {
                            alert(JSON.stringify(d.counts.find((c:{courseId:string}) => c.courseId === activeCourse), null, 2));
                          }
                        } catch { alert("Debug fetch failed"); }
                      }} className="text-[9px] text-emerald-400 hover:underline">Show Counts Json</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP: MANUAL ADD */}
          {step==="manual"&&(
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <button onClick={()=>setStep("source")} className="text-white/30 hover:text-white/60"><ChevronLeft size={14}/></button>
                <p className="text-[10px] text-white/30 uppercase tracking-wider font-semibold">Add Manual Notes</p>
              </div>
              <input value={noteTitle} onChange={e=>setNoteTitle(e.target.value)} placeholder="Title (e.g., Chapter 4 — Deadlocks)"
                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2.5 text-xs text-white placeholder-white/20 focus:outline-none focus:border-emerald-400/40"/>
              <textarea value={noteContent} onChange={e=>setNoteContent(e.target.value)} placeholder="Paste notes, lecture text, or article…"
                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2.5 text-xs text-white placeholder-white/20 focus:outline-none focus:border-emerald-400/40 h-40 resize-none"/>
              <button onClick={handleSaveManual} disabled={saving||!noteTitle||!noteContent}
                className="w-full py-2.5 bg-emerald-400 text-black text-xs font-bold rounded-xl hover:bg-emerald-300 disabled:opacity-40 transition-colors flex items-center justify-center gap-2">
                <Plus size={13}/>{saving?"Saving…":"Save Material"}
              </button>
            </div>
          )}

          {/* STEP: BROWSE SAVED */}
          {step==="browse"&&(
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button onClick={()=>setStep("source")} className="text-white/30 hover:text-white/60"><ChevronLeft size={14}/></button>
                  <p className="text-[10px] text-white/30 uppercase tracking-wider font-semibold">Saved Materials ({materials.length})</p>
                </div>
              </div>

              {materialsError && (
                <div className="p-3 rounded-xl bg-red-400/8 border border-red-400/20 text-[10px] text-red-400 mb-2">
                  <AlertTriangle size={12} className="inline mr-1"/>{materialsError}
                </div>
              )}

              {materials.length===0?(
                <div className="text-center py-12"><BookOpen size={24} className="mx-auto mb-2 text-white/10"/><p className="text-[10px] text-white/30">No materials saved yet</p></div>
              ):(
                <>
                  <p className="text-[9px] text-white/25">Select materials then go to Ask AI.</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {materials.map(m=>(
                      <div key={m.id} onClick={()=>toggle(m.id)}
                        className={`p-3 rounded-xl border cursor-pointer transition-all group relative ${selected.has(m.id)?"border-emerald-400/40 bg-emerald-400/5":"border-white/6 bg-white/2 hover:bg-white/4"}`}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            {selected.has(m.id)?<CheckSquare size={12} className="text-emerald-400 shrink-0"/>:<Square size={12} className="text-white/20 shrink-0"/>}
                            <p className="text-[11px] text-white/75 font-medium truncate">{m.title}</p>
                          </div>
                          <button onClick={e=>{e.stopPropagation();handleDelete(m.id);}} className="opacity-0 group-hover:opacity-100 text-white/20 hover:text-red-400 transition-all shrink-0"><Trash2 size={11}/></button>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1.5 pl-5">
                          <span className="text-[8px] px-1.5 py-px rounded bg-white/5 text-white/25">{m.source==="classroom"?"Classroom":"Manual"}</span>
                          {m.courseName&&<span className="text-[8px] text-white/20 truncate max-w-[80px]">{m.courseName}</span>}
                          {m.topicName&&<span className="text-[8px] text-white/40 border border-white/10 px-1 rounded truncate max-w-[80px]">{m.topicName}</span>}
                          
                          {/* Content Status Badges */}
                          {m.content_status==="ready"&&<span className="text-[8px] px-1.5 py-px rounded bg-emerald-400/10 text-emerald-400 border border-emerald-400/20">Ready</span>}
                          {m.content_status==="metadata_only"&&<span className="text-[8px] px-1.5 py-px rounded bg-amber-400/10 text-amber-400 border border-amber-400/20">Metadata Only</span>}
                          {m.content_status==="extract_failed"&&<span className="text-[8px] px-1.5 py-px rounded bg-red-400/10 text-red-400 border border-red-400/20">Extract Failed</span>}
                          
                          {/* Extract Action for Drive Files */}
                          {m.source==="classroom" && (!m.content_status || m.content_status!=="ready") && m.driveFileId && (
                            <button onClick={(e)=>{e.stopPropagation(); handleExtractContent(m.id, m.driveFileId!, m.mimeType || m.content_type || "");}} disabled={extractingId===m.id}
                              className="text-[8px] text-emerald-400/80 hover:text-emerald-400 hover:underline flex items-center gap-1 ml-auto">
                              {extractingId===m.id ? <><Loader2 size={8} className="animate-spin"/> Extracting...</> : "Auto-Extract"}
                            </button>
                          )}
                          
                          {/* Paste Action for Links/Unknowns */}
                          {m.source==="classroom" && (!m.content_status || m.content_status!=="ready") && !m.driveFileId && (
                            <button onClick={evt=>{evt.stopPropagation();setPasteTarget(m.id);setPasteText("");}}
                              className="text-[8px] text-amber-400 hover:underline ml-auto">+ Paste Content</button>
                          )}
                        </div>
                        
                        {/* Debug Info */}
                        <div className="mt-1.5 pl-5 flex items-center justify-between gap-2">
                          <p className="text-[7px] text-white/10 font-mono">
                            debug: status={m.content_status||'none'} | type={m.content_type||'unknown'} | driveId={m.driveFileId?'yes':'no'} | mime={m.mimeType?.split('/')[1]||m.mimeType||'none'}
                          </p>
                          {m.source==="classroom" && (!m.content_status || m.content_status!=="ready") && m.driveFileId && (
                            <button onClick={(e) => { e.stopPropagation(); handleDebugDrive(m.id, m.driveFileId!); }}
                              className="text-[7px] text-cyan-400/80 hover:text-cyan-400 hover:underline">
                              Debug Drive Access
                            </button>
                          )}
                        </div>
                        
                        {driveDebugLogs[m.id] && (
                          <div className="mt-2 pl-5">
                            <div className="bg-cyan-900/10 border border-cyan-400/20 rounded p-2 text-[8px] font-mono text-cyan-200/80 whitespace-pre-wrap overflow-hidden">
                              {driveDebugLogs[m.id].loading ? "Fetching Drive diagnostics..." : JSON.stringify(driveDebugLogs[m.id], null, 2)}
                            </div>
                          </div>
                        )}
                        
                        {/* Error Message */}
                        {extractErrors[m.id] && (
                          <div className="mt-1.5 pl-5">
                            <p className="text-[9px] text-red-400/90">{extractErrors[m.id]}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Paste content dialog */}
                  {pasteTarget&&(
                    <div className="p-3 rounded-xl border border-amber-400/20 bg-amber-400/5 space-y-2">
                      <p className="text-[10px] text-amber-400 font-medium">Paste text content for: {materials.find(m=>m.id===pasteTarget)?.title}</p>
                      <textarea value={pasteText} onChange={e=>setPasteText(e.target.value)} placeholder="Paste extracted text here…"
                        className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-white/20 focus:outline-none h-28 resize-none"/>
                      <div className="flex gap-2">
                        <button onClick={handlePasteContent} disabled={pasteSaving||!pasteText.trim()}
                          className="px-4 py-1.5 bg-amber-400/20 text-amber-400 text-[10px] font-medium rounded-lg disabled:opacity-40">{pasteSaving?"Saving…":"Save Content"}</button>
                        <button onClick={()=>setPasteTarget(null)} className="px-4 py-1.5 text-white/30 text-[10px] rounded-lg hover:text-white/60">Cancel</button>
                      </div>
                    </div>
                  )}

                  <button onClick={()=>setStep("query")}
                    className="w-full py-2.5 bg-emerald-400/10 border border-emerald-400/20 rounded-xl text-xs text-emerald-400 font-medium hover:bg-emerald-400/15 transition-colors flex items-center justify-center gap-1.5">
                    <ChevronRight size={13}/>Ask AI About {selected.size>0?`${selected.size} Selected`:"All"} Materials
                  </button>
                </>
              )}
            </div>
          )}

          {/* STEP: QUERY */}
          {step==="query"&&(
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <button onClick={()=>setStep("browse")} className="text-white/30 hover:text-white/60"><ChevronLeft size={14}/></button>
                <p className="text-[10px] text-white/30 uppercase tracking-wider font-semibold">Ask AI</p>
              </div>

              {selected.size>0&&(
                <div className="px-3 py-2 rounded-lg bg-emerald-400/8 border border-emerald-400/20 text-[10px] text-emerald-400">
                  Querying {selected.size} material{selected.size>1?"s":""}. <button className="underline" onClick={()=>setSelected(new Set())}>Clear</button>
                </div>
              )}

              <div>
                <p className="text-[9px] text-white/25 uppercase tracking-wider font-semibold mb-2">Quick Actions</p>
                <div className="flex flex-wrap gap-1.5">
                  {ACTIONS.map(a=>(
                    <button key={a.id} onClick={()=>handleQuery(a.label,a.id)} disabled={querying}
                      className="px-2.5 py-1.5 bg-white/4 border border-white/8 rounded-lg text-[10px] text-white/45 hover:bg-white/8 hover:text-white/75 disabled:opacity-30 transition-colors">{a.label}</button>
                  ))}
                </div>
              </div>

              <div className="flex gap-2">
                <input value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")handleQuery();}}
                  placeholder="Ask anything about your materials…"
                  className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2.5 text-xs text-white placeholder-white/20 focus:outline-none focus:border-emerald-400/40"/>
                <button onClick={()=>handleQuery()} disabled={querying||!query}
                  className="px-4 bg-emerald-400 text-black text-xs font-bold rounded-lg hover:bg-emerald-300 disabled:opacity-40 transition-colors">Ask</button>
              </div>

              <div className="min-h-[250px] bg-black/40 border border-white/8 rounded-xl p-5 overflow-y-auto max-h-[60vh] flex flex-col shadow-inner">
                {querying?(
                  <div className="h-full flex-1 flex flex-col items-center justify-center text-emerald-400 text-xs gap-3">
                    <div className="flex items-center"><Loader2 size={14} className="animate-spin mr-2"/>{queryProgress}</div>
                    <button onClick={() => abortController?.abort()} className="px-3 py-1 bg-white/5 border border-white/10 rounded hover:bg-white/10 text-white/50 hover:text-white transition-colors">Cancel</button>
                  </div>
                ):result?(
                  <div className="flex-1 flex flex-col">
                    <div className="flex justify-between items-start mb-4 gap-2">
                        <div className="flex flex-wrap gap-1.5">
                            {result.fallback_used&&<div className="px-2 py-1 rounded bg-yellow-400/8 border border-yellow-400/20 text-[9px] text-yellow-400">Local analysis</div>}
                            {result.action_type&&<div className="px-2 py-1 rounded bg-purple-400/10 border border-purple-400/20 text-[9px] text-purple-400">{result.action_type}</div>}
                            {result.confidence!==undefined&&<div className="px-2 py-1 rounded bg-white/5 border border-white/10 text-[9px] text-white/40">Confidence: {Math.round(result.confidence*100)}%</div>}
                            {result.chunks_used!==undefined&&<div className="px-2 py-1 rounded bg-emerald-400/10 border border-emerald-400/20 text-[9px] text-emerald-400">{result.chunks_used} chunk(s)</div>}
                            {result.selected_materials&&result.selected_materials.length>0&&<div className="px-2 py-1 rounded bg-cyan-400/10 border border-cyan-400/20 text-[9px] text-cyan-400" title={result.selected_materials.join(", ")}>{result.selected_materials.length} material(s)</div>}
                        </div>
                        <button onClick={() => navigator.clipboard.writeText(result.answer || "")} className="text-[10px] text-white/40 hover:text-white transition-colors shrink-0 bg-white/5 px-2 py-1 rounded border border-white/10">Copy Answer</button>
                    </div>
                    {result.missing_content_materials&&result.missing_content_materials.length>0&&(
                      <div className="mb-4 px-3 py-2 rounded bg-amber-400/8 border border-amber-400/20 text-[10px] text-amber-400">
                        <AlertTriangle size={12} className="inline mr-1.5 -mt-0.5"/>{result.missing_content_materials.length} material(s) missing text — <button className="underline font-semibold hover:text-amber-300 transition-colors" onClick={()=>setStep("browse")}>Extract content</button>
                      </div>
                    )}
                    <div className="flex-1 text-[13px]">
                        <ReactMarkdown remarkPlugins={[remarkGfm]} components={md}>{String(result.answer||"")}</ReactMarkdown>
                    </div>
                    {result.sources&&result.sources.length>0&&(
                      <div className="mt-5 pt-3 border-t border-white/5">
                        <p className="text-[9px] text-white/30 uppercase tracking-wider mb-2 font-semibold">Sources Cited</p>
                        <div className="flex flex-wrap gap-1.5">{result.sources.map((s,i)=><span key={i} className="px-2 py-0.5 bg-white/5 border border-white/10 rounded text-[9px] text-white/50">{s}</span>)}</div>
                      </div>
                    )}
                  </div>
                ):(
                  <div className="h-full flex-1 flex items-center justify-center text-white/15 text-xs"><FileText size={14} className="mr-1.5"/>Results appear here</div>
                )}
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
