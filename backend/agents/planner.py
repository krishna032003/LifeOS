from backend.models.state import AgentState
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import SystemMessage, HumanMessage
import os

llm = ChatGoogleGenerativeAI(model="gemini-2.5-flash", api_key=os.getenv("GEMINI_API_KEY", "dummy"))

async def planner_node(state: AgentState):
    """
    Analyzes user request and explicitly routes to ONE node.
    """
    command_type = state.get("command_type", "").strip()
    
    # Bypass LLM intent detection if this is an explicit Command Center button click
    if command_type:
        intent_map = {
            "study_today": ("study", "Command Center: Generate study topics for today."),
            "study_plan": ("study", "Command Center: Generate a comprehensive study plan."),
            "auto_schedule": ("productivity", "Command Center: Auto-schedule my day."),
            "deep_work": ("productivity", "Command Center: Initiate deep work focus block."),
            "weekly_review": ("memory", "Command Center: Run Weekly AI Review.")
        }
        
        if command_type in intent_map:
            intent, reason = intent_map[command_type]
            log_entry = {
                "node": "Planner",
                "message": f"Command executed: {intent.capitalize()}"
            }
            return {
                "intent_detected": intent,
                "decision_reason": reason,
                "active_node": "Planner",
                "pipeline_logs": [log_entry]
            }

    messages = state.get("messages", [])
    if not messages:
        return state
        
    user_msg = messages[-1].content
    
    system_prompt = f"""
    You are the Planner Agent for a student productivity system.
    The user is asking: {user_msg}
    
    Determine if this requires:
    1) 'study' - Generating or reviewing study material.
    2) 'productivity' - Updating calendar/schedule or checking time.
    3) 'memory' - Recalling past information, context, or previous chats.
    
    Provide your decision and a brief 1-sentence reasoning in the following format:
    INTENT: <study/productivity/memory>
    REASON: <why you chose this>
    """
    
    response = await llm.ainvoke([
        SystemMessage(content=system_prompt), 
        HumanMessage(content="Process my request.")
    ])
    content = response.content.strip()
    
    intent = "productivity"
    reason = "Fallback default due to parsing failure."
    
    for line in content.split("\n"):
        line = line.strip()
        if line.startswith("INTENT:"):
            parsed_intent = line.replace("INTENT:", "").strip().lower()
            if parsed_intent in ["study", "productivity", "memory"]:
                intent = parsed_intent
        elif line.startswith("REASON:"):
            reason = line.replace("REASON:", "").strip()
            
    log_entry = {
        "node": "Planner",
        "message": f"Routed to {intent.capitalize()}: {reason}"
    }
            
    return {
        "intent_detected": intent,
        "decision_reason": reason,
        "active_node": "Planner",
        "pipeline_logs": [log_entry]
    }
