# PROJECT REPORT: LifeOS - AI-Powered Student Productivity Command Center

## 1. Problem Statement
Modern students face overwhelming academic workloads, extracurricular commitments, and constant digital distractions. Traditional productivity apps (like basic to-do lists or manual calendars) require significant manual effort to maintain and do not intelligently adapt to a student's specific constraints, goals, or cognitive fatigue. 

## 2. Objectives
* To design an intelligent, autonomous productivity system tailored for students.
* To utilize Large Language Models (LLMs) to automatically generate optimal daily schedules and study plans.
* To implement a decoupled, modern web architecture using Next.js and FastAPI.
* To ensure system reliability with programmatic fallbacks for critical AI or database failures.

## 3. Existing System Limitations
* **Static Nature:** Traditional apps rely on the user to accurately estimate time and manually block out calendar events.
* **Lack of Context:** Standard to-do lists do not know a student's major, upcoming deadlines, or personal goals.
* **High Friction:** Planning a day takes time; many students abandon productivity tools because the tools themselves become a chore.

## 4. Proposed System
LifeOS is an AI-driven command center. Instead of the user telling the app exactly what to do, the user inputs their raw tasks, goals, and constraints. An autonomous swarm of specialized AI agents analyzes this data to generate structured schedules, dynamic study plans, and performance reviews.

## 5. Architecture
LifeOS utilizes a decoupled client-server architecture:
*   **Client (Frontend):** A Next.js web application that provides a modern, interactive dashboard. It communicates with the backend via REST API and Server-Sent Events (SSE) for real-time streaming.
*   **Server (Backend):** A Python FastAPI application. The core logic is orchestrated by LangGraph, routing incoming requests to specialized LangChain agents.
*   **Data Tier:** MongoDB handles persistent profile storage, falling back to a local JSON structure if the network fails.

## 6. Key Modules
1.  **Onboarding Module:** Captures user context (major, goals, constraints) to inform all future AI decisions.
2.  **Agent Orchestrator:** A directed graph (LangGraph) that determines if a user request requires the *Planner*, *Study*, *Productivity*, or *Memory* agent.
3.  **Smart Timetable Module:** Accepts a list of tasks and available time, then uses AI to pack those tasks into an optimal schedule with mandatory breaks.
4.  **Deep Work Module:** A focused UI state designed to block distractions during scheduled work blocks.

## 7. Technologies Used
*   **Frontend:** React, Next.js 14, Tailwind CSS, Framer Motion
*   **Backend:** Python, FastAPI, Uvicorn
*   **AI/ML:** Google Gemini 2.5 Flash, LangChain, LangGraph
*   **Database:** MongoDB, Motor (AsyncIO)

## 8. Features
*   **Real-Time AI Streaming:** The user can see the AI's "thought process" and routing decisions live on the dashboard.
*   **Intelligent Scheduling:** Automatic generation of task timetables that respect total available time.
*   **Programmatic Fallbacks:** If the Gemini API key is missing or the external API is unreachable, the system automatically falls back to a robust, local Python scheduling algorithm.
*   **Responsive UI:** Glassmorphism design system that looks premium and functions seamlessly across devices.

## 9. Future Scope
*   **Calendar Integration:** Two-way sync with Google Calendar to automatically pull existing meetings.
*   **LMS Integration:** Direct fetching of assignments from Google Classroom or Canvas.
*   **Analytics Dashboard:** Long-term tracking of focus hours and goal completion rates.

## 10. Conclusion
LifeOS successfully demonstrates the application of modern LLMs and agentic workflows in the educational technology space. By reducing the friction of daily planning, it provides a practical, scalable solution to student burnout and time management challenges. The project meets all functional requirements and is highly resilient due to its robust fallback mechanisms.
