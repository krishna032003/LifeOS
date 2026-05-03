# LifeOS: AI-Powered Student Productivity Command Center

LifeOS is an intelligent, agentic productivity command center designed specifically for students. It utilizes an autonomous Swarm of AI agents (powered by Google Gemini and LangGraph) to analyze student goals, intelligently schedule tasks, and provide actionable study plans.

This project was built as a College Minor Project to demonstrate the practical application of Large Language Models (LLMs) and intelligent agent routing in the ed-tech space.

## 🏗️ Project Architecture
This is a decoupled monorepo containing:
- **`frontend/`**: The client-facing web application.
- **`backend/`**: The API server and AI agent orchestrator.
- **Database**: MongoDB (persistent) with a local JSON fallback (`mock_db.json`).

The architecture follows a standard client-server model. The Next.js frontend sends commands to the FastAPI backend, which routes the intent through a LangGraph directed graph to specialized AI agents (Planner, Study, Productivity, Memory). 

## 🛠️ Technology Stack
* **AI & Orchestration:** LangChain, LangGraph
* **Large Language Model:** Google Gemini 2.5 Flash
* **Backend:** Python, FastAPI, Uvicorn
* **Database:** MongoDB (via Motor AsyncIO)
* **Frontend:** Next.js 14 (App Router), React, TypeScript
* **Styling & UI:** Tailwind CSS, Framer Motion (Glassmorphism & modern UI)
* **Authentication:** Google OAuth2
* **Integrations:** Google Classroom API (optional for assignments)

## ✨ Core Features
1. **Smart Onboarding Profile:** Collects user academics, goals, and hard constraints.
2. **AI Command Center:** A conversational interface that streams real-time AI thought processes.
3. **Smart Timetable Generator:** Automatically packs student tasks into available free time, respecting constraints and inserting breaks.
4. **Agentic Study Planner:** Generates daily study topics based on user goals.
5. **Deep Work Focus Mode:** A distraction-free UI timer with custom app-blocking lists.
6. **Weekly AI Review:** Analyzes past data to calculate a productivity score and provide improvement recommendations.
7. **Offline-Ready Fallbacks:** Built-in robust algorithms if the database or AI APIs fail.

---

## 🚀 Setup Guide

### 1. Backend (Python/FastAPI)
Open a terminal and navigate to the backend folder:
```bash
cd backend
python -m venv .venv

# On Windows:
.venv\Scripts\activate
# On Mac/Linux:
# source .venv/bin/activate

pip install -r requirements.txt
```

**Backend Environment Variables (`backend/.env`):**
Create a `.env` file in the `backend/` directory:
```env
GEMINI_API_KEY=your_google_gemini_api_key
MONGO_URI=mongodb://localhost:27017 # Or your MongoDB Atlas URL
```

**Start the Backend Server:**
```bash
python main.py
```
*(The API will start running on `http://localhost:8000`)*

---

### 2. Frontend (Next.js)
Open a **new** terminal window and navigate to the frontend folder:
```bash
cd frontend
npm install
```

**Frontend Environment Variables (`frontend/.env.local`):**
Create a `.env.local` file in the `frontend/` directory:
```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_google_oauth_client_id.apps.googleusercontent.com
# Optional: Only needed if you want a separate Google Classroom specific Client ID
NEXT_PUBLIC_CLASSROOM_CLIENT_ID=optional_classroom_oauth_client_id.apps.googleusercontent.com
```

*Note: Both Google Client IDs must be generated as "Web application" types in the Google Cloud Console. Android, Desktop, or raw API keys will not work. `NEXT_PUBLIC_CLASSROOM_CLIENT_ID` is optional if `NEXT_PUBLIC_GOOGLE_CLIENT_ID` is already a valid Web OAuth client.*

**Start the Frontend Server:**
```bash
npm run dev
```
*(The web app will start running on `http://localhost:3000`)*

---

## 🎬 Demo Flow
Follow these exact steps for the best demonstration experience:
1. **Start Servers:** Ensure both the backend (`python main.py`) and frontend (`npm run dev`) are actively running.
2. **Access App:** Open a browser to `http://localhost:3000`.
3. **Login & Onboard:** Sign in via Google Auth. Complete the onboarding screen to register your name, major, and primary goals.
4. **Command Center:** Observe the dynamic particle background. 
5. **Smart Timetable:** Click "⚡ Timetable", add a few dummy tasks, and click "Generate". Show how the AI intelligently schedules breaks.
6. **Study Plan:** Click "📚 Study Today" in the dock to trigger the AI Study Agent. Watch the thought-process stream in real-time.
7. **Focus Mode:** Click the "🧘 Deep Work" button to show the custom timer and app-blocker UI.
8. **Weekly Review:** Click "📊 Review" to demonstrate the AI analyzing past performance and returning a health score.
