from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import logging
from dotenv import load_dotenv
import sys
import os
import asyncio
import platform
from datetime import datetime, timedelta, timezone

# Ensure the parent directory is in the Python path so "backend.agents" can be resolved
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Load environment variables from .env file explicitly
env_path = os.path.join(os.path.dirname(__file__), ".env")
load_dotenv(env_path, override=True)


app = FastAPI(title="LifeOS Agent Backend")

# Setup CORS for the Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],  # Next.js default port
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from backend.routers.timetable import router as timetable_router
from backend.routers.materials import router as materials_router
app.include_router(timetable_router)
app.include_router(materials_router)

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
        
    gemini_key = os.getenv("GEMINI_API_KEY", "")
    if gemini_key:
        print(f"GEMINI_API_KEY loaded: yes, length: {len(gemini_key)}, ends with: {gemini_key[-4:] if len(gemini_key) > 4 else '***'}")
    else:
        print("GEMINI_API_KEY loaded: no")

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

@app.get("/")
async def root():
    return {"project": "LifeOS Command Center", "status": "online", "message": "Welcome to LifeOS AI"}

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
            error_str = str(e)
            if "429" in error_str or "quota" in error_str.lower() or "exhausted" in error_str.lower():
                error_payload = {"error": "Gemini quota exceeded for current API key/project."}
            else:
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

@app.get("/api/classroom/{user_id}/materials")
async def get_classroom_materials(user_id: str):
    """Fetch all courses with courseWork + courseWorkMaterials, paginated, with topics and content extraction."""
    try:
        user = await db.users.find_one({"user_id": user_id})
    except Exception:
        user = MOCK_DB.get(user_id)

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    access_token = user.get("google_access_token")
    if not access_token:
        raise HTTPException(status_code=400, detail="Google access token not found. Please connect Google Classroom first.")

    headers = {"Authorization": f"Bearer {access_token}"}

    async def paginated_get(client, url, key, params=None):
        """Fetch all pages from a paginated Classroom API endpoint."""
        items = []
        next_token = None
        for _ in range(20):  # safety cap
            p = dict(params or {})
            p["pageSize"] = 100
            if next_token:
                p["pageToken"] = next_token
            res = await client.get(url, headers=headers, params=p)
            if res.status_code != 200:
                break
            data = res.json()
            items.extend(data.get(key, []))
            next_token = data.get("nextPageToken")
            if not next_token:
                break
        return items

    result_courses = []

    async with httpx.AsyncClient(timeout=30) as client:
        # Fetch ALL courses (paginated)
        courses = await paginated_get(client, "https://classroom.googleapis.com/v1/courses", "courses", {"courseStates": "ACTIVE"})

        async def fetch_course_data(course):
            cid = course["id"]
            cname = course.get("name", "Unknown")

            # Fetch topics for grouping
            topics_list = await paginated_get(client, f"https://classroom.googleapis.com/v1/courses/{cid}/topics", "topic")
            topic_map = {t["topicId"]: t.get("name", "Untitled Topic") for t in topics_list}

            materials_list = []

            # Fetch ALL courseWork (paginated)
            all_cw = await paginated_get(client, f"https://classroom.googleapis.com/v1/courses/{cid}/courseWork", "courseWork")
            for work in all_cw:
                topic_id = work.get("topicId", "")
                topic_name = topic_map.get(topic_id, "")
                for mat in work.get("materials", []):
                    entry = _build_material(mat, cid, cname, "coursework", work.get("title", ""), topic_name)
                    if entry:
                        materials_list.append(entry)

            # Fetch ALL courseWorkMaterials (paginated)
            all_cwm = await paginated_get(client, f"https://classroom.googleapis.com/v1/courses/{cid}/courseWorkMaterials", "courseWorkMaterial")
            for cwm in all_cwm:
                topic_id = cwm.get("topicId", "")
                topic_name = topic_map.get(topic_id, "")
                for mat in cwm.get("materials", []):
                    entry = _build_material(mat, cid, cname, "material", cwm.get("title", ""), topic_name)
                    if entry:
                        materials_list.append(entry)

            return {
                "courseId": cid,
                "courseName": cname,
                "section": course.get("section", ""),
                "topics": [{"id": t["topicId"], "name": t.get("name", "")} for t in topics_list],
                "materials": materials_list,
            }

        if courses:
            results = await asyncio.gather(*[fetch_course_data(c) for c in courses])
            result_courses = list(results)

    return {"success": True, "courses": result_courses}


def _detect_content_type(mime: str, title: str) -> str:
    mime_l = mime.lower()
    title_l = title.lower()
    if "pdf" in mime_l or title_l.endswith(".pdf"):
        return "pdf"
    if "presentation" in mime_l or "pptx" in mime_l or title_l.endswith(".pptx") or title_l.endswith(".ppt"):
        return "ppt"
    if "document" in mime_l or "msword" in mime_l or title_l.endswith(".docx") or title_l.endswith(".doc"):
        return "doc"
    if "spreadsheet" in mime_l or title_l.endswith(".xlsx"):
        return "spreadsheet"
    if "text" in mime_l or title_l.endswith(".txt"):
        return "text"
    if "image" in mime_l:
        return "image"
    return "unknown"


def _build_material(mat: dict, course_id: str, course_name: str, source_type: str, parent_title: str, topic_name: str) -> dict | None:
    if "driveFile" in mat:
        df = mat["driveFile"].get("driveFile", {})
        mime = df.get("mimeType", "")
        title = df.get("title", "Untitled")
        return {
            "type": "drive",
            "title": title,
            "alternateLink": df.get("alternateLink", ""),
            "driveFileId": df.get("id", ""),
            "courseId": course_id,
            "courseName": course_name,
            "sourceType": source_type,
            "parentTitle": parent_title,
            "topicName": topic_name,
            "mimeType": mime,
            "content_type": _detect_content_type(mime, title),
        }
    elif "link" in mat:
        lnk = mat["link"]
        return {
            "type": "link",
            "title": lnk.get("title", lnk.get("url", "Untitled Link")),
            "alternateLink": lnk.get("url", ""),
            "courseId": course_id,
            "courseName": course_name,
            "sourceType": source_type,
            "parentTitle": parent_title,
            "topicName": topic_name,
            "content_type": "link",
        }
    elif "youtubeVideo" in mat:
        yt = mat["youtubeVideo"]
        return {
            "type": "youtube",
            "title": yt.get("title", "YouTube Video"),
            "alternateLink": yt.get("alternateLink", ""),
            "courseId": course_id,
            "courseName": course_name,
            "sourceType": source_type,
            "parentTitle": parent_title,
            "topicName": topic_name,
            "content_type": "youtube",
        }
    return None


@app.get("/api/debug/drive")
async def debug_drive_file(user_id: str, drive_file_id: str):
    if not user_id or not drive_file_id:
        return {"error": "Missing user_id or drive_file_id"}
    try:
        user = await db.users.find_one({"user_id": user_id})
    except Exception:
        user = MOCK_DB.get(user_id)
    if not user:
        return {"error": "User not found"}
    access_token = user.get("google_access_token")
    if not access_token:
        return {"error": "No access token found"}
    debug_data = {}
    async with httpx.AsyncClient() as client:
        t_res = await client.get(f"https://oauth2.googleapis.com/tokeninfo?access_token={access_token}")
        if t_res.status_code == 200:
            t_data = t_res.json()
            debug_data["token_scopes"] = t_data.get("scope", "")
            debug_data["has_drive_scope"] = "drive.readonly" in t_data.get("scope", "")
        else:
            debug_data["token_error"] = f"{t_res.status_code} {t_res.text}"
        headers = {"Authorization": f"Bearer {access_token}"}
        m_res = await client.get(
            f"https://www.googleapis.com/drive/v3/files/{drive_file_id}",
            headers=headers,
            params={
                "fields": "id,name,mimeType,owners(displayName,emailAddress),capabilities,copyRequiresWriterPermission,webViewLink,webContentLink,size",
                "supportsAllDrives": "true"
            }
        )
        debug_data["metadata_status"] = m_res.status_code
        if m_res.status_code == 200:
            debug_data["metadata"] = m_res.json()
        else:
            debug_data["metadata_error"] = m_res.text
    return debug_data

@app.post("/api/materials/extract-content")
async def extract_drive_content(user_id: str = "", drive_file_id: str = "", mime_type: str = "", material_id: str = ""):
    """Try to extract text from a Google Drive file using the user's access token."""
    if not user_id or not drive_file_id:
        raise HTTPException(status_code=400, detail="user_id and drive_file_id required")

    try:
        user = await db.users.find_one({"user_id": user_id})
    except Exception:
        user = MOCK_DB.get(user_id)

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    access_token = user.get("google_access_token")
    if not access_token:
        raise HTTPException(status_code=400, detail="No access token")

    headers = {"Authorization": f"Bearer {access_token}"}
    extracted = ""
    status = "extract_failed"
    error_msg = ""

    async with httpx.AsyncClient(timeout=60) as client:
        try:
            m_res = await client.get(
                f"https://www.googleapis.com/drive/v3/files/{drive_file_id}",
                headers=headers,
                params={"fields": "mimeType,capabilities,webContentLink", "supportsAllDrives": "true"}
            )
            can_download = True
            web_content_link = None
            if m_res.status_code == 403 and "disabled" in m_res.text:
                return {"success": False, "content": "", "content_status": "extract_failed", "extracted_length": 0, "error": "Google Drive API is disabled in your Google Cloud Console. Please enable it."}

            if m_res.status_code == 200:
                m_data = m_res.json()
                can_download = m_data.get("capabilities", {}).get("canDownload", True)
                web_content_link = m_data.get("webContentLink")
                if not mime_type or mime_type == "none":
                    mime_type = m_data.get("mimeType", "")
            
            if not can_download:
                error_msg = "File owner or Workspace policy blocks API download."
                status = "extract_failed"
                return {"success": False, "content": "", "content_status": status, "extracted_length": 0, "error": error_msg}

            mime_l = mime_type.lower()
            res = None
            # Google Docs → export as plain text
            if "document" in mime_l and "google" in mime_l:
                res = await client.get(
                    f"https://www.googleapis.com/drive/v3/files/{drive_file_id}/export",
                    headers=headers,
                    params={"mimeType": "text/plain", "supportsAllDrives": "true"}
                )
                if res.status_code == 200:
                    extracted = res.text.strip()
                    status = "ready" if extracted else "extract_failed"
                else:
                    error_msg = f"Export failed: {res.status_code}"

            # Google Slides → export as plain text
            elif "presentation" in mime_l and "google" in mime_l:
                res = await client.get(
                    f"https://www.googleapis.com/drive/v3/files/{drive_file_id}/export",
                    headers=headers,
                    params={"mimeType": "text/plain", "supportsAllDrives": "true"}
                )
                if res.status_code == 200:
                    extracted = res.text.strip()
                    status = "ready" if extracted else "extract_failed"
                else:
                    error_msg = f"Export failed: {res.status_code}"

            # PDF → download and extract with pypdf
            elif "pdf" in mime_l:
                res = await client.get(
                    f"https://www.googleapis.com/drive/v3/files/{drive_file_id}",
                    headers=headers,
                    params={"alt": "media", "supportsAllDrives": "true"}
                )
                if res.status_code == 403 and web_content_link:
                    res = await client.get(web_content_link, headers=headers)
                
                if res.status_code == 200:
                    try:
                        import io
                        try:
                            from pypdf import PdfReader
                        except ImportError:
                            error_msg = "pypdf not installed. Run pip install -r backend/requirements.txt."
                            status = "extract_failed"
                            return {"success": False, "content": "", "content_status": status, "extracted_length": 0, "error": error_msg}
                        
                        reader = PdfReader(io.BytesIO(res.content))
                        pages_text = []
                        for page in reader.pages:
                            t = page.extract_text()
                            if t:
                                pages_text.append(t.strip())
                        extracted = "\n\n".join(pages_text)
                        status = "ready" if extracted else "metadata_only"
                        if not extracted:
                            error_msg = "This PDF may be scanned/image-only. Paste text manually."
                    except Exception as ex:
                        error_msg = f"PDF parse error: {ex}"
                else:
                    error_msg = f"Download failed: {res.status_code}"

            # Plain text file
            elif "text/plain" in mime_l:
                res = await client.get(
                    f"https://www.googleapis.com/drive/v3/files/{drive_file_id}",
                    headers=headers,
                    params={"alt": "media", "supportsAllDrives": "true"}
                )
                if res.status_code == 200:
                    extracted = res.text.strip()
                    status = "ready" if extracted else "extract_failed"
                else:
                    error_msg = f"Download failed: {res.status_code}"

            else:
                error_msg = f"Unsupported file type: {mime_type}. Paste content manually."
                status = "metadata_only"
                
            if res and res.status_code == 403:
                error_msg = "Browser download works, but Google blocks API download for this file. Upload manually."
                status = "extract_failed"

        except Exception as ex:
            error_msg = str(ex)

    updated = False
    if status == "ready" and material_id:
        from backend.routers.materials import MATERIALS_DB
        user_mats = list(MATERIALS_DB.get(user_id, []))
        for m in user_mats:
            if m["id"] == material_id:
                m["content"] = extracted[:50000]
                m["content_status"] = "ready"
                m["content_available"] = True
                m["extracted_text_length"] = len(extracted)
                updated = True
                break
        MATERIALS_DB[user_id] = user_mats

    return {
        "success": status == "ready",
        "content": extracted[:50000] if extracted else "",  # Cap at 50k chars
        "content_status": status,
        "extracted_length": len(extracted),
        "material_id": material_id,
        "updated": updated,
        "error": error_msg,
    }

@app.get("/api/classroom/{user_id}/materials/debug")
async def debug_classroom_materials(user_id: str):
    """Debug endpoint to count fetched materials by course."""
    try:
        user = await db.users.find_one({"user_id": user_id})
    except Exception:
        user = MOCK_DB.get(user_id)
        
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    access_token = user.get("google_access_token")
    if not access_token:
        raise HTTPException(status_code=400, detail="Google access token not found.")

    headers = {"Authorization": f"Bearer {access_token}"}
    
    async def paginated_get(client, url, key, params=None):
        items = []
        next_token = None
        error_msg = None
        for _ in range(20):
            p = dict(params or {})
            p["pageSize"] = 100
            if next_token:
                p["pageToken"] = next_token
            res = await client.get(url, headers=headers, params=p)
            if res.status_code != 200:
                error_msg = f"{res.status_code}: {res.text}"
                break
            data = res.json()
            items.extend(data.get(key, []))
            next_token = data.get("nextPageToken")
            if not next_token:
                break
        return items, error_msg

    result_counts = []
    
    async with httpx.AsyncClient(timeout=60) as client:
        courses, c_err = await paginated_get(client, "https://classroom.googleapis.com/v1/courses", "courses", {"courseStates": "ACTIVE"})
        
        async def fetch_counts(course):
            cid = course["id"]
            cname = course.get("name", "Unknown")
            api_errors = []
            
            topics, t_err = await paginated_get(client, f"https://classroom.googleapis.com/v1/courses/{cid}/topics", "topic")
            if t_err: api_errors.append(f"topics: {t_err}")
            
            courseWork, cw_err = await paginated_get(client, f"https://classroom.googleapis.com/v1/courses/{cid}/courseWork", "courseWork")
            if cw_err: api_errors.append(f"courseWork: {cw_err}")
            
            courseWorkMaterials, cwm_err = await paginated_get(client, f"https://classroom.googleapis.com/v1/courses/{cid}/courseWorkMaterials", "courseWorkMaterial")
            if cwm_err: api_errors.append(f"courseWorkMaterials: {cwm_err}")
            
            attachments = 0
            drive_files = 0
            pdfs = 0
            sample_pdfs = []
            
            for work in courseWork:
                for mat in work.get("materials", []):
                    attachments += 1
                    if "driveFile" in mat:
                        drive_files += 1
                        df = mat["driveFile"].get("driveFile", {})
                        if "pdf" in df.get("mimeType", "").lower() or df.get("title", "").lower().endswith(".pdf"):
                            pdfs += 1
                            if len(sample_pdfs) < 5:
                                sample_pdfs.append(df.get("title", "Unknown PDF"))
                            
            for cwm in courseWorkMaterials:
                for mat in cwm.get("materials", []):
                    attachments += 1
                    if "driveFile" in mat:
                        drive_files += 1
                        df = mat["driveFile"].get("driveFile", {})
                        if "pdf" in df.get("mimeType", "").lower() or df.get("title", "").lower().endswith(".pdf"):
                            pdfs += 1
                            if len(sample_pdfs) < 5:
                                sample_pdfs.append(df.get("title", "Unknown PDF"))
                            
            return {
                "courseId": cid,
                "courseName": cname,
                "topics": len(topics),
                "courseWork": len(courseWork),
                "courseWorkMaterials": len(courseWorkMaterials),
                "attachments": attachments,
                "drive_files": drive_files,
                "pdfs": pdfs,
                "sample_pdfs": sample_pdfs,
                "api_errors": api_errors
            }
            
        if courses:
            results = await asyncio.gather(*[fetch_counts(c) for c in courses])
            result_counts = list(results)
            
    return {"success": True, "counts": result_counts}



# --- Focus Mode App Blocker ---
active_focus_task: asyncio.Task = None
focus_end_time: datetime = None
focus_start_time: datetime = None
active_focus_user: str = None

async def focus_blocker_loop(end_time: datetime, blocked_apps: list[str]):
    is_windows = platform.system() == "Windows"
    try:
        while datetime.now(timezone.utc) < end_time:
            try:
                if is_windows:
                    proc = await asyncio.create_subprocess_exec(
                        "powershell", "-Command", "Get-Process | Where-Object MainWindowTitle | Select-Object -ExpandProperty Name",
                        stdout=asyncio.subprocess.PIPE,
                        stderr=asyncio.subprocess.PIPE
                    )
                    stdout, _ = await proc.communicate()
                    if proc.returncode == 0:
                        running_apps = [name.strip() for name in stdout.decode().split('\n') if name.strip()]
                        for app in blocked_apps:
                            for r_app in running_apps:
                                if app.lower() in r_app.lower():
                                    print(f"[Focus] Quitting blocked app: {r_app}")
                                    quit_proc = await asyncio.create_subprocess_exec(
                                        "taskkill", "/IM", f"{r_app}.exe", "/F",
                                        stdout=asyncio.subprocess.PIPE,
                                        stderr=asyncio.subprocess.PIPE
                                    )
                                    await quit_proc.communicate()
                else:
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
                                    "osascript", "-e", f'tell application "{app}" to quit',
                                    stdout=asyncio.subprocess.PIPE,
                                    stderr=asyncio.subprocess.PIPE
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
