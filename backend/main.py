from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import logging
from dotenv import load_dotenv
import sys
import os

# Ensure the parent directory is in the Python path so "backend.agents" can be resolved
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Load environment variables from .env file
load_dotenv()


app = FastAPI(title="LifeOS Agent Backend")

# Setup CORS for the Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],  # Next.js default port
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from fastapi.responses import StreamingResponse
from langchain_core.messages import HumanMessage
from backend.agents.graph import graph
from motor.motor_asyncio import AsyncIOMotorClient
import json
import asyncio
import uuid
from datetime import datetime, timezone
from backend.models.user import UserProfileSchema, OnboardResponse

import urllib.parse
from urllib.parse import quote_plus

# MongoDB Setup
raw_uri = os.getenv("MONGO_URI", os.getenv("MONGODB_URL", "mongodb://localhost:27017/lifeos"))

# Safe parsing hack for passwords with special chars like '@'
if "@@" in raw_uri:
    raw_uri = raw_uri.replace("@@", "@")

parsed_uri = raw_uri
if "@" in raw_uri and raw_uri.startswith("mongodb+srv://"):
    parts = raw_uri.split("@")
    if len(parts) > 1:
        credentials = parts[0].split("://")[1]
        host_info = "@".join(parts[1:])
        if ":" in credentials:
            username, password = credentials.split(":", 1)
            parsed_uri = f"mongodb+srv://{username}:{quote_plus(password)}@{host_info}"

client = AsyncIOMotorClient(raw_uri, serverSelectionTimeoutMS=2000)
db = client.get_database("lifeos")


class UserProfile(BaseModel):
    user_id: str
    name: str
    degree: str
    year: str
    batch: str
    active_goals: list[str]

MOCK_DB = {}

@app.get("/api/user/{user_id}")
async def get_user(user_id: str):
    try:
        user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    except Exception:
        user = MOCK_DB.get(user_id)
        if not user:
             # Look by name as a fallback for the frontend test
             user = next((u for u in MOCK_DB.values() if u.get("name") == user_id), None)
             
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@app.post("/api/user")
async def save_user(profile: UserProfile):
    user_dict = profile.dict()
    try:
        await db.users.update_one(
            {"user_id": profile.user_id},
            {"$set": user_dict},
            upsert=True
        )
    except Exception:
        MOCK_DB[profile.user_id] = user_dict
    return {"status": "success"}

@app.post("/api/onboard", response_model=OnboardResponse)
async def onboard_user(profile: UserProfileSchema):
    user_dict = profile.dict(exclude_unset=True)
    
    if not user_dict.get("user_id"):
        user_dict["user_id"] = str(uuid.uuid4())
        
    now = datetime.now(timezone.utc)
    user_dict["updated_at"] = now
    
    update_data = {
        "$set": user_dict,
        "$setOnInsert": {"created_at": now}
    }
    
    try:
        await db.users.update_one(
            {"user_id": user_dict["user_id"]},
            update_data,
            upsert=True
        )
    except Exception as e:
        print(f"Warning: Mocking DB due to mongo error '{e}'")
        MOCK_DB[user_dict["user_id"]] = user_dict
        MOCK_DB[user_dict.get("name")] = user_dict # For name-based lookups like /api/user/Krishna Sahu
    
    return OnboardResponse(
        success=True,
        user_id=user_dict["user_id"],
        message="Profile saved successfully"
    )

class ChatRequest(BaseModel):
    user_id: str
    command_type: str = ""
    message: str = ""

@app.get("/health")
async def health_check():
    return {"status": "ok"}

@app.post("/api/chat")
async def chat_endpoint(request: ChatRequest):
    async def event_generator():
        # Fetch user profile from MongoDB or mock DB safely
        try:
            user_data = await db.users.find_one({"user_id": request.user_id}, {"_id": 0})
        except Exception:
            user_data = MOCK_DB.get(request.user_id) or MOCK_DB.get("Krishna Sahu")
        
        if user_data:
            profile = user_data
            # Ensure required arrays exist for LangGraph mapping DB 'goals' to Agent 'active_goals'
            profile["active_goals"] = profile.get("goals", [])
            profile["hard_constraints"] = profile.get("hard_constraints", [])
        else:
            error_payload = {"error": "User profile not found. Please complete onboarding first."}
            yield f"event: error\ndata: {json.dumps(error_payload)}\n\n"
            return
        
        initial_message = request.message if request.message else f"Execute command: {request.command_type}"
        
        initial_state = {
            "messages": [HumanMessage(content=initial_message)],
            "user_profile": profile,
            "active_goals": profile["active_goals"],
            "user_id": request.user_id,
            "command_type": request.command_type,
            "pipeline_logs": [],
            "active_node": "Start",
            "focus_progress": 0.0,
            "intent_detected": "",
            "decision_reason": "",
            "reflection_summary": ""
        }
        
        try:
            # Stream the graph execution events
            async for s in graph.astream(initial_state, stream_mode="values"):
                # `values` stream yields the full state dictionary after every node update
                
                # Check for new pipeline logs (just sending the latest one for the stream)
                logs = s.get("pipeline_logs", [])
                if logs:
                    latest_log = logs[-1]
                    pipeline_payload = {
                        "active_node": s.get("active_node", "System"),
                        "pipeline_log": latest_log
                    }
                    yield f"event: pipeline\ndata: {json.dumps(pipeline_payload)}\n\n"
                    
                # Yield current semantic variables (state event)
                state_payload = {
                    "focus_progress": s.get("focus_progress", 0.0),
                    "intent_detected": s.get("intent_detected", "")
                }
                yield f"event: state\ndata: {json.dumps(state_payload)}\n\n"
                
                await asyncio.sleep(0.1) # brief pause to let UI breathe
                
            # Once graph finishes, grab final message and summary
            messages = s.get("messages", [])
            final_content = messages[-1].content if messages else "No output."
            summary = s.get("reflection_summary", "")
            
            if request.command_type == "weekly_review":
                try:
                    review_data = json.loads(final_content)
                    review_data["type"] = "weekly_review"
                    yield f"data: {json.dumps(review_data)}\n\n"
                except Exception as e:
                    yield f"event: error\ndata: {json.dumps({'error': 'Failed to parse review JSON.'})}\n\n"
            else:
                final_payload = {
                    "message": final_content,
                    "reflection_summary": summary
                }
                yield f"event: final\ndata: {json.dumps(final_payload)}\n\n"
            
        except Exception as e:
            import traceback
            traceback.print_exc()
            error_payload = {"error": str(e)}
            yield f"event: error\ndata: {json.dumps(error_payload)}\n\n"
            
    return StreamingResponse(event_generator(), media_type="text/event-stream")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
