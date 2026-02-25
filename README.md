# LifeOS: AI Command Center (V2)

LifeOS is an intelligent, agentic productivity command center. It uses an autonomous Swarm of AI agents (powered by Gemini and LangGraph) to analyze your goals, strictly schedule your time, and provide direct actionable plans for what you should study or focus on.

## Architecture Structure
This is a monorepo containing both the Next.js frontend and the FastAPI/LangGraph backend.

- `frontend/` - Next.js (React), Tailwind CSS, Framer Motion
- `backend/` - FastAPI, Langchain, LangGraph, MongoDB

---

## 🚀 Quick Setup Guide

### 1. Backend (Python/FastAPI) Setup

Open a terminal and navigate to the backend folder:
```bash
cd backend
```

**Create a Virtual Environment & Install Dependencies:**
```bash
python -m venv .venv
# On Windows:
.venv\Scripts\activate
# On Mac/Linux:
# source .venv/bin/activate

pip install -r requirements.txt
```

**Set up your Environment Variables:**
Create a `.env` file in the `backend/` directory based on the `.env.example` file. You will need:
- `GEMINI_API_KEY`: Your Google Gemini API Key.
- `MONGO_URI`: Your MongoDB connection string (or just use `mongodb://localhost:27017` if you have local Mongo running).

**Start the Backend Server:**
```bash
python main.py
```
*The API will start running on `http://localhost:8000`*

---

### 2. Frontend (Next.js) Setup

Open a **new** terminal window and navigate to the frontend folder:
```bash
cd frontend
```

**Install Node Dependencies:**
```bash
npm install
```

**Start the Development Server:**
```bash
npm run dev
```
*The web app will start running on `http://localhost:3000`*

---

## 🛠️ Usage Flow
1. Navigate to **`http://localhost:3000`**.
2. If this is your first time, you will immediately be taken to the Onboarding Flow to register your name, academics, and goals.
3. Once initialized, the Command Center will render. You can trigger agentic actions like "Auto-Schedule My Day" or "What Should I Study Today".

## Core Technologies
* **AI Routing:** LangGraph (Stateful Agent Workflows)
* **LLM:** Google Gemini 2.5 Flash
* **State Management:** MongoDB (AsyncIO Motor)
* **Frontend:** Next.js 14 App Router
* **Styling/Animations:** Tailwind CSS & Framer Motion (Opal Design System)
