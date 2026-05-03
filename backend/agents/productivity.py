from backend.models.state import AgentState
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import SystemMessage, HumanMessage
import os

def get_llm():
    return ChatGoogleGenerativeAI(model="gemini-2.5-flash", api_key=os.getenv("GEMINI_API_KEY", "dummy"))

async def productivity_node(state: AgentState):
    """
    Handles scheduling and detects conflicts with hard constraints.
    """
    profile = state.get("user_profile", {})
    constraints = profile.get("hard_constraints", [])
    messages = state.get("messages", [])
    
    user_msg = messages[-1].content if messages else "Check my schedule."
    
    system_prompt = f"""
    You are the Productivity Agent managing a student's schedule.
    The user's constraints are: {constraints}.
    The user is asking: {user_msg}.
    
    Determine if their request conflicts with any known constraints (e.g. Monday 09:00 AM classes).
    If a conflict is detected, explicitly state the conflict and suggest the nearest valid alternative slot.
    Respond concisely.
    """
    
    response = await get_llm().ainvoke([
        SystemMessage(content=system_prompt),
        HumanMessage(content="Analyze my schedule constraints.")
    ])
    updates = response.content.strip()
    
    conflict_detected = "conflict" in updates.lower()
    log_msg = "Conflict detected with constraints. Alternative suggested." if conflict_detected else "Schedule looks clear. No conflicts detected."
    
    log_entry = {
        "node": "Productivity",
        "message": f"Received {len(constraints)} constraint(s) from user profile. {log_msg}"
    }
    
    return {
        "messages": [SystemMessage(content=f"Calendar/Schedule Updates:\n{updates}")],
        "active_node": "Productivity",
        "pipeline_logs": [log_entry]
    }
