from typing import TypedDict, Annotated, Sequence, List
import operator
from langchain_core.messages import BaseMessage

class AgentState(TypedDict):
    messages: Annotated[Sequence[BaseMessage], operator.add]
    pipeline_logs: Annotated[List[dict], operator.add]
    user_id: str
    user_profile: dict
    active_goals: list[str]
    command_type: str
    active_node: str
    intent_detected: str
    decision_reason: str
    focus_progress: float
    reflection_summary: str
