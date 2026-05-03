import os
import json
import asyncio
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from langchain_core.messages import HumanMessage
from langchain_google_genai import ChatGoogleGenerativeAI

router = APIRouter()

class TaskItem(BaseModel):
    title: str
    durationMinutes: int
    deadline: Optional[str] = None
    priority: str

class TimetableRequest(BaseModel):
    user_id: str
    tasks: List[TaskItem]
    available_time_minutes: int

def generate_fallback_schedule(tasks: List[TaskItem], available_minutes: int):
    priority_map = {"High": 1, "Medium": 2, "Low": 3}
    sorted_tasks = sorted(tasks, key=lambda t: priority_map.get(t.priority, 4))
    
    schedule = []
    current_time_minutes = 9 * 60  # Start at 09:00 AM
    used_minutes = 0
    
    def format_time(total_mins):
        h = total_mins // 60
        m = total_mins % 60
        period = "AM" if h < 12 else "PM"
        h = h if h <= 12 else h - 12
        h = 12 if h == 0 else h
        return f"{h:02d}:{m:02d} {period}"

    for t in sorted_tasks:
        if used_minutes + t.durationMinutes > available_minutes:
            continue
            
        schedule.append({
            "time": format_time(current_time_minutes),
            "task": t.title,
            "duration": t.durationMinutes,
            "type": "work"
        })
        current_time_minutes += t.durationMinutes
        used_minutes += t.durationMinutes
        
        # Add short break
        if used_minutes + 5 <= available_minutes:
            schedule.append({
                "time": format_time(current_time_minutes),
                "task": "Short Break",
                "duration": 5,
                "type": "break"
            })
            current_time_minutes += 5
            used_minutes += 5
            
    return {
        "schedule": schedule,
        "message": "Generated using robust fallback planner (AI generation currently unavailable)."
    }

@router.post("/api/timetable/generate")
async def generate_timetable(req: TimetableRequest):
    from backend.main import db, MOCK_DB
    
    if not req.tasks:
        raise HTTPException(status_code=400, detail="No tasks provided.")
    
    # Fetch user data for context
    try:
        user_data = await db.users.find_one({"user_id": req.user_id}, {"_id": 0})
    except Exception:
        user_data = MOCK_DB.get(req.user_id)
        
    if not user_data:
        raise HTTPException(status_code=404, detail="User profile not found. Please complete onboarding.")
        
    goals = user_data.get("goals", [])
    constraints = user_data.get("hard_constraints", [])
    
    # Format tasks for the prompt
    tasks_text = "\n".join([f"- {t.title} ({t.durationMinutes} min) [Priority: {t.priority}] {('Deadline: '+t.deadline) if t.deadline else ''}" for t in req.tasks])
    
    prompt = f"""You are LifeOS, an elite academic scheduler.
Create a highly practical and realistic day plan for a student.

User Goals: {goals}
User Constraints: {constraints}
Total Available Time: {req.available_time_minutes} minutes

Tasks to Schedule:
{tasks_text}

Instructions:
1. Try to schedule the most important tasks first.
2. If total task time exceeds available time, leave lower priority tasks out or shorten them.
3. Include short 5-10 minute breaks between long tasks.
4. Output ONLY valid JSON in this exact format, with no markdown formatting or backticks:
{{
  "schedule": [
    {{"time": "09:00 AM", "task": "Task name", "duration": 45, "type": "work"}},
    {{"time": "09:45 AM", "task": "Short Break", "duration": 5, "type": "break"}}
  ],
  "message": "Brief encouraging message about the plan."
}}
"""
    
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key or api_key == "dummy":
        return generate_fallback_schedule(req.tasks, req.available_time_minutes)
        
    try:
        llm = ChatGoogleGenerativeAI(model="gemini-2.5-flash", api_key=api_key)
        response = await llm.ainvoke([HumanMessage(content=prompt)])
        content = response.content.replace("```json", "").replace("```", "").strip()
        
        try:
            schedule_data = json.loads(content)
            return schedule_data
        except json.JSONDecodeError:
            return generate_fallback_schedule(req.tasks, req.available_time_minutes)
            
    except Exception as e:
        print(f"Timetable generation error: {e}")
        return generate_fallback_schedule(req.tasks, req.available_time_minutes)
