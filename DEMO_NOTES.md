# 🎤 LifeOS Viva & Presentation Guide

This document contains a structured plan for your college minor project demonstration. Keep it open on a second screen or printed out during your viva.

## 🎯 What to Highlight
Evaluators are looking for technical depth, practicality, and completion. Emphasize:
1. **Agentic AI:** You didn't just build a wrapper; you built an intelligent routing system using LangGraph.
2. **Real-time Streaming:** Mention the Server-Sent Events (SSE) pipeline that streams the AI's "thought process" live to the UI.
3. **Robustness:** Highlight the programmatic fallback mechanisms. The app handles database outages and API failures gracefully.
4. **UI/UX:** Point out the glassmorphism, fluid Framer Motion animations, and custom particle engine.

---

## ⏱️ 2-Minute Demo Script

**1. Introduction (0:00 - 0:20)**
> "Good morning. My minor project is LifeOS, an AI-powered student productivity command center. The goal is to solve student burnout by using an autonomous Swarm of AI agents to organize tasks, schedule time, and generate study plans. It is built using Next.js, FastAPI, MongoDB, and LangGraph."

**2. Onboarding & Dashboard (0:20 - 0:45)**
> *(Action: Open `localhost:3000`, login via Google, and land on the dashboard)*
> "Here is the main interface. The system knows my profile, my academic major, and my constraints from onboarding. This isn't a static to-do list; it's a dynamic command center."

**3. Smart Timetable (0:45 - 1:15)**
> *(Action: Click "⚡ Timetable", add two tasks like 'OS Assignment' (60m) and 'Read Chapter' (30m), enter '120' available minutes, click Generate)*
> "For example, using the Smart Timetable, I can input raw tasks and my available time. The AI (powered by Gemini) processes this and outputs a structured JSON schedule, automatically inserting short breaks to prevent fatigue. If the AI is down, I built a local programmatic algorithm that falls back instantly to do the same thing."

**4. LangGraph Agent Action (1:15 - 1:45)**
> *(Action: Click "📚 Study Today" in the dock)*
> "When I request a study plan, watch the pipeline box. The FastAPI backend receives the request, the LangGraph Planner Agent routes it to the specific Study Agent, and the thought process is streamed to the frontend via Server-Sent Events in real-time."

**5. Deep Work & Conclusion (1:45 - 2:00)**
> *(Action: Open "🧘 Deep Work" modal, start a 25 min session)*
> "Finally, the Deep Work mode provides a distraction-free UI timer that integrates with the user's intent. LifeOS ultimately provides a complete, intelligent ecosystem for student success. Thank you."

---

## 🛟 Fallback & Disaster Recovery Plan

If things go wrong during the live demo, don't panic. The system is designed to survive.

**Scenario A: "The AI is taking too long or Gemini API fails."**
*   **What happens:** The Timetable Generator automatically switches to a local Python scheduling algorithm. The schedule will still generate instantly.
*   **What to say:** *"It seems the external AI API is currently rate-limited, but as a fallback, I implemented a robust local scheduling algorithm that guarantees the user still gets their timetable."*

**Scenario B: "MongoDB Atlas is down / Won't connect."**
*   **What happens:** The FastAPI backend will catch the database timeout and automatically switch to reading/writing from `mock_db.json` in memory.
*   **What to say:** *"Since cloud databases can be unreliable during presentations, the architecture includes a thread-safe JSON dictionary fallback. The app continues to function perfectly."*

**Scenario C: "Google Login throws an Invalid Token error."**
*   **What happens:** Next.js throws an error.
*   **Fix:** Ensure `NEXT_PUBLIC_GOOGLE_CLIENT_ID` in the frontend matches the Client ID used in your Google Cloud Console. Clear `localStorage` via browser DevTools (Application tab) and refresh.

---

## 🔧 Pre-Flight Checklist
Before calling the examiner over:
- [ ] Ensure `.env.local` exists in `frontend/`
- [ ] Ensure `.env` exists in `backend/`
- [ ] Run `python main.py` in terminal 1. Wait for `Uvicorn running on http://0.0.0.0:8000`
- [ ] Run `npm run dev` in terminal 2. Wait for `Ready in ...`
- [ ] Ensure your browser zoom is at 100%.
- [ ] Have a few tasks ready in your mind to type quickly for the Timetable.

---

## 🔐 Google Cloud OAuth Setup

If you need to set up Google Classroom RAG extraction from scratch, configure your Google Cloud Console exactly as follows:

1. **Create OAuth Client ID**
   - **Application Type**: Web application
   - **Authorized JavaScript origins**: `http://localhost:3000`
   - **Authorized redirect URIs**: `http://localhost:3000/auth/callback`

2. **Environment Variables Required**
   - Frontend (`frontend/.env.local`):
     ```env
     NEXT_PUBLIC_CLASSROOM_CLIENT_ID=<web oauth client id ending with .apps.googleusercontent.com>
     NEXT_PUBLIC_GOOGLE_CLIENT_ID=<same or another valid web oauth client id>
     ```
   - Backend (`backend/.env`):
     ```env
     GOOGLE_CLIENT_ID=<backend verification client id>
     ```

3. **Enable APIs in Google Cloud Console**
   - Google Classroom API
   - Google Drive API

*Note: The Classroom reconnect logic explicitly relies on `NEXT_PUBLIC_CLASSROOM_CLIENT_ID`, while normal app login uses `NEXT_PUBLIC_GOOGLE_CLIENT_ID`.*
