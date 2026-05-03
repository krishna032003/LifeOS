from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import logging
from dotenv import load_dotenv
import sys
import os
import asyncio
from datetime import datetime, timedelta, timezone

# Ensure the parent directory is in the Python path so "backend.agents" can be resolved
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Load environment variables from .env file
load_dotenv(override=True)


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
import threading
import asyncio
import uuid
from datetime import datetime, timezone
from backend.models.user import UserProfileSchema, OnboardResponse
from google.oauth2 import id_token
from google.auth.transport import requests as grequests

import urllib.parse
from urllib.parse import quote_plus
import httpx

# MongoDB Setup
uri = os.getenv("MONGO_URI", os.getenv("MONGODB_URL", "mongodb://localhost:27017/lifeos"))

from pymongo.server_api import ServerApi

# Create a new client and connect to the server
client = AsyncIOMotorClient(
    uri,
    serverSelectionTimeoutMS=2000,
    tlsAllowInvalidCertificates=True,
    server_api=ServerApi('1')
)
db = client.get_database("lifeos")

@app.on_event("startup")
async def startup_db_client():
    # Send a ping to confirm a successful connection
    try:
        await client.admin.command('ping')
        print("Pinged your deployment. You successfully connected to MongoDB!")
    except Exception as e:
        print(f"MongoDB connection error: {e}")

class GoogleAuthRequest(BaseModel):
    token: str
    access_token: str | None = None

class ClassroomTokenRequest(BaseModel):
    access_token: str

class FocusStartRequest(BaseModel):
    duration_minutes: int
    blocked_apps: list[str]
    user_id: str | None = None


class UserProfile(BaseModel):
    user_id: str
    name: str
    degree: str
    year: str
    batch: str
    active_goals: list[str]

# --- Persistent fallback DB (survives server restarts when MongoDB is down) ---
_MOCK_DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "mock_db.json")
_mock_db_lock = threading.Lock()

def _load_mock_db() -> dict:
    try:
        if os.path.exists(_MOCK_DB_PATH):
            with open(_MOCK_DB_PATH, "r") as f:
                return json.load(f)
    except Exception:
        pass
    return {}

def _save_mock_db(data: dict):
    try:
        with _mock_db_lock:
            with open(_MOCK_DB_PATH, "w") as f:
                json.dump(data, f, default=str)
    except Exception as e:
        print(f"Warning: Could not save mock_db.json: {e}")

class _PersistentDict(dict):
    """A dict that auto-saves to disk on every write."""
    def __setitem__(self, key, value):
        super().__setitem__(key, value)
        _save_mock_db(dict(self))
    def __delitem__(self, key):
        super().__delitem__(key)
        _save_mock_db(dict(self))

MOCK_DB = _PersistentDict(_load_mock_db())
print(f"[MockDB] Loaded {len(MOCK_DB)} entries from mock_db.json")

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")


@app.post("/auth/google")
async def google_login(data: GoogleAuthRequest):
    # 1. Verify the Google ID token — this must always succeed
    try:
        idinfo = id_token.verify_oauth2_token(
            data.token,
            grequests.Request(),
            GOOGLE_CLIENT_ID
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid Google token: {e}")

    email = idinfo["email"]
    name = idinfo.get("name", "")
    picture = idinfo.get("picture", "")

    # 2. Try MongoDB; fall back to MOCK_DB if it's not reachable
    try:
        user = await db.users.find_one({"email": email})

        if not user:
            user_id = str(uuid.uuid4())
            new_user = {
                "user_id": user_id,
                "email": email,
                "name": name,
                "picture": picture,
                "goals": [],
                "created_at": datetime.now(timezone.utc),
                "google_access_token": data.access_token
            }
            await db.users.insert_one(new_user)
        else:
            user_id = user["user_id"]
            if data.access_token:
                await db.users.update_one({"user_id": user_id}, {"$set": {"google_access_token": data.access_token}})

    except Exception as db_err:
        print(f"Warning: MongoDB unavailable ({db_err}), using MOCK_DB.")
        # Look up by email in MOCK_DB
        existing = next((u for u in MOCK_DB.values() if isinstance(u, dict) and u.get("email") == email), None)
        if existing:
            user_id = existing["user_id"]
            if data.access_token:
                MOCK_DB[user_id]["google_access_token"] = data.access_token
        else:
            user_id = str(uuid.uuid4())
            MOCK_DB[user_id] = {
                "user_id": user_id,
                "email": email,
                "name": name,
                "picture": picture,
                "goals": [],
                "google_access_token": data.access_token
            }

    return {
        "success": True,
        "user_id": user_id,
        "email": email,
        "name": name
    }

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

@app.post("/api/classroom/{user_id}/token")
async def save_classroom_token(user_id: str, data: ClassroomTokenRequest):
    try:
        user = await db.users.find_one({"user_id": user_id})
        if user:
            await db.users.update_one({"user_id": user_id}, {"$set": {"google_access_token": data.access_token}})
        elif user_id in MOCK_DB:
            MOCK_DB[user_id]["google_access_token"] = data.access_token
        else:
            raise HTTPException(status_code=404, detail="User not found")
        return {"success": True}
    except Exception as e:
        if user_id in MOCK_DB:
            MOCK_DB[user_id]["google_access_token"] = data.access_token
            return {"success": True}
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/classroom/{user_id}")
async def get_classroom_courses(user_id: str):
    try:
        user = await db.users.find_one({"user_id": user_id})
    except Exception:
        user = MOCK_DB.get(user_id)
        
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    access_token = user.get("google_access_token")
    if not access_token:
        raise HTTPException(status_code=400, detail="Google access token not found for user. Please log in with Google again to grant Classroom permissions.")
        
    async with httpx.AsyncClient() as client:
        res = await client.get(
            "https://classroom.googleapis.com/v1/courses",
            headers={"Authorization": f"Bearer {access_token}"},
            params={"courseStates": ["ACTIVE"]}
        )
        if res.status_code != 200:
            raise HTTPException(status_code=res.status_code, detail=f"Failed to fetch courses: {res.text}")
            
        data = res.json()
        courses = data.get("courses", [])
        
        assignments = []
        async def fetch_coursework(course):
            course_id = course["id"]
            cw_res = await client.get(
                f"https://classroom.googleapis.com/v1/courses/{course_id}/courseWork",
                headers={"Authorization": f"Bearer {access_token}"}
            )
            if cw_res.status_code == 200:
                cw_data = cw_res.json()
                for work in cw_data.get("courseWork", []):
                    if "dueDate" in work:
                        work["courseName"] = course["name"]
                        assignments.append(work)
                        
        if courses:
            await asyncio.gather(*[fetch_coursework(c) for c in courses])
        
        def get_due_date(w):
            d = w.get("dueDate", {})
            t = w.get("dueTime", {})
            try:
                return datetime(
                    d.get("year", 2099), d.get("month", 1), d.get("day", 1),
                    t.get("hours", 23), t.get("minutes", 59), tzinfo=timezone.utc
                )
            except:
                return datetime(2099, 1, 1, tzinfo=timezone.utc)
                
        assignments.sort(key=get_due_date)
        now = datetime.now(timezone.utc)
        upcoming_assignments = [a for a in assignments if get_due_date(a) > now]

        return {"success": True, "courses": courses, "assignments": upcoming_assignments}

# --- Focus Mode App Blocker ---
active_focus_task: asyncio.Task = None
focus_end_time: datetime = None
focus_start_time: datetime = None
active_focus_user: str = None

async def focus_blocker_loop(end_time: datetime, blocked_apps: list[str]):
    try:
        while datetime.now(timezone.utc) < end_time:
            try:
                script = 'tell application "System Events" to get name of every application process whose background only is false'
                proc = await asyncio.create_subprocess_exec(
                    "osascript", "-e", script,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE
                )
                stdout, _ = await proc.communicate()
                if proc.returncode == 0:
                    running_apps = stdout.decode().strip().split(", ")
                    for app in blocked_apps:
                        if app in running_apps:
                            print(f"[Focus] Quitting blocked app: {app}")
                            quit_proc = await asyncio.create_subprocess_exec(
                                "osascript", "-e", f'tell application "{app}" to quit'
                            )
                            await quit_proc.communicate()
            except Exception as e:
                print(f"[Focus] Blocker loop error: {e}")
            
            await asyncio.sleep(3)
    except asyncio.CancelledError:
        print("[Focus] Session cancelled early.")
    finally:
        global active_focus_task, focus_end_time, focus_start_time, active_focus_user
        if focus_start_time and active_focus_user:
            elapsed_seconds = (datetime.now(timezone.utc) - focus_start_time).total_seconds()
            elapsed_minutes = max(0, int(elapsed_seconds / 60))
            if elapsed_minutes > 0:
                user_id = active_focus_user
                try:
                    user = await db.users.find_one({"user_id": user_id})
                    if user:
                        await db.users.update_one(
                            {"user_id": user_id},
                            {"$inc": {"total_focus_minutes": elapsed_minutes}}
                        )
                    elif user_id in MOCK_DB:
                        current = MOCK_DB[user_id].get("total_focus_minutes", 0)
                        MOCK_DB[user_id]["total_focus_minutes"] = current + elapsed_minutes
                except Exception as e:
                    if user_id in MOCK_DB:
                        current = MOCK_DB[user_id].get("total_focus_minutes", 0)
                        MOCK_DB[user_id]["total_focus_minutes"] = current + elapsed_minutes
                        
        active_focus_task = None
        focus_end_time = None
        focus_start_time = None
        active_focus_user = None
        print("[Focus] Session ended.")

@app.post("/api/focus/start")
async def start_focus(req: FocusStartRequest):
    global active_focus_task, focus_end_time, focus_start_time, active_focus_user
    if active_focus_task:
        active_focus_task.cancel()
    
    now = datetime.now(timezone.utc)
    focus_start_time = now
    focus_end_time = now + timedelta(minutes=req.duration_minutes)
    active_focus_user = req.user_id
    
    active_focus_task = asyncio.create_task(focus_blocker_loop(focus_end_time, req.blocked_apps))
    return {"success": True, "end_time": focus_end_time.isoformat()}

@app.post("/api/focus/stop")
async def stop_focus():
    global active_focus_task
    if active_focus_task:
        active_focus_task.cancel()
    return {"success": True}

@app.get("/api/focus/status")
async def get_focus_status():
    if active_focus_task and focus_end_time:
        remaining = int((focus_end_time - datetime.now(timezone.utc)).total_seconds())
        if remaining > 0:
            return {"active": True, "remaining_seconds": remaining, "end_time": focus_end_time.isoformat()}
    return {"active": False}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
