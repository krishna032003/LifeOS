from backend.models.state import AgentState
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import SystemMessage, HumanMessage
import os

def get_llm():
    return ChatGoogleGenerativeAI(model="gemini-2.5-flash", api_key=os.getenv("GEMINI_API_KEY", "dummy"))

async def study_node(state: AgentState):
    """
    Generates study material, e.g., C++ competitive programming questions based on user goals.
    """
    goals = state.get("active_goals", [])
    
    system_prompt = f"""
    You are the Study Agent. The user's active goals are: {goals}.
    Based ONLY on their goals, generate a targeted study plan or 3 specific practice problems/topics that align perfectly with what they want to achieve.
    Keep the output concise, highly practical, and strictly relevant to their stated goals.
    """
    
    response = await get_llm().ainvoke([
        SystemMessage(content=system_prompt),
        HumanMessage(content="Generate the study material.")
    ])
    material = response.content.strip()
    
    log_entry = {
        "node": "Study",
        "message": f"Generated study material tailored to user goals: {goals}"
    }
    
    return {
        "messages": [SystemMessage(content=f"Study Material Generated:\n{material}")],
        "active_node": "Study",
        "pipeline_logs": [log_entry]
    }
