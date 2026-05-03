from langgraph.graph import StateGraph, END
from backend.models.state import AgentState
from backend.agents.planner import planner_node
from backend.agents.study import study_node
from backend.agents.productivity import productivity_node
from backend.agents.memory import memory_node
from backend.agents.reflection import reflection_node

def route_after_planner(state: AgentState):
    intent = state.get("intent_detected", "productivity")
    if intent in ["study", "productivity", "memory", "chat"]:
        return intent
    return "productivity"

# Build the graph
builder = StateGraph(AgentState)

# Add nodes
builder.add_node("planner", planner_node)
builder.add_node("study", study_node)
builder.add_node("productivity", productivity_node)
builder.add_node("memory", memory_node)
builder.add_node("reflection", reflection_node)

def route_initial(state: AgentState):
    if state.get("command_type") == "weekly_review":
        return "reflection"
    return "planner"

# Set conditional entry point
builder.set_conditional_entry_point(
    route_initial,
    {
        "reflection": "reflection",
        "planner": "planner"
    }
)

# Add conditional edges from planner
builder.add_conditional_edges(
    "planner",
    route_after_planner,
    {
        "study": "study",
        "productivity": "productivity",
        "memory": "memory",
        "chat": "reflection"
    }
)

# Add edges to reflection
builder.add_edge("study", "reflection")
builder.add_edge("productivity", "reflection")
builder.add_edge("memory", "reflection")

# Terminate
builder.add_edge("reflection", END)

# Compile
graph = builder.compile()
