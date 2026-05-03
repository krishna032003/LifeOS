from backend.models.state import AgentState
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import SystemMessage, HumanMessage
import os

def get_llm():
    return ChatGoogleGenerativeAI(model="gemini-2.5-flash", api_key=os.getenv("GEMINI_API_KEY", "dummy"))

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
    
    # Rule-based check for simple conversational messages
    chat_greetings = ["hi", "hello", "hey", "how are you", "what's up", "thanks", "okay", "cool", "who are you", "what can you do", "who are you?", "what can you do?"]
    clean_msg = user_msg.lower().strip()
    if clean_msg in chat_greetings or clean_msg.strip(".,!?") in chat_greetings:
        log_entry = {
            "node": "Planner",
            "message": "Routed to Chat: Detected simple greeting/conversational intent."
        }
        return {
            "intent_detected": "chat",
            "decision_reason": "Simple conversational message.",
            "active_node": "Planner",
            "pipeline_logs": [log_entry]
        }
    
    system_prompt = f"""
    You are the Planner Agent for a student productivity system.
    The user is asking: {user_msg}
    
    Determine if this requires:
    1) 'chat' - greetings, identity questions, casual talk, small talk, general capability questions. Do NOT route vague social messages to memory.
    2) 'study' - study topics, notes, exam, learning, practice questions.
    3) 'productivity' - timetable, schedule, calendar, focus, deadlines, tasks.
    4) 'memory' - explicitly asks to remember/recall past conversation/context (e.g. "what did I say earlier", "remember my goal", "recall previous chat").
    
    Provide your decision and a brief 1-sentence reasoning in the following format:
    INTENT: <chat/study/productivity/memory>
    REASON: <why you chose this>
    """
    
    response = await get_llm().ainvoke([
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
            if parsed_intent in ["study", "productivity", "memory", "chat"]:
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
