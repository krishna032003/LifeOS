from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import uuid
import os
import json
import threading
from typing import Optional, List
from datetime import datetime, timezone

# Setup Router
router = APIRouter(prefix="/api/materials", tags=["materials"])

# Local persistence for fast demo
_MATERIALS_DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "materials_db.json")
_db_lock = threading.Lock()

def load_materials() -> dict:
    try:
        if os.path.exists(_MATERIALS_DB_PATH):
            with open(_MATERIALS_DB_PATH, "r") as f:
                return json.load(f)
    except Exception:
        pass
    return {}

def save_materials(data: dict):
    try:
        with _db_lock:
            with open(_MATERIALS_DB_PATH, "w") as f:
                json.dump(data, f)
    except Exception as e:
        print(f"Failed to save materials DB: {e}")

class MaterialStore(dict):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.update(load_materials())

    def __setitem__(self, key, value):
        super().__setitem__(key, value)
        save_materials(dict(self))

    def __delitem__(self, key):
        super().__delitem__(key)
        save_materials(dict(self))

# Format: MATERIALS_DB[user_id] = [ { "id", "title", "content", "source", "courseId", "courseName", ... } ]
MATERIALS_DB = MaterialStore()


# ── Models ──

class MaterialInput(BaseModel):
    user_id: str
    title: str
    content: str
    subject: Optional[str] = None

class ClassroomImportInput(BaseModel):
    user_id: str
    materials: List[dict]  # Each: { title, type, alternateLink, driveFileId?, courseId, courseName, mimeType?, sourceType?, parentTitle? }

class MaterialUpdateInput(BaseModel):
    content: str

class QueryInput(BaseModel):
    user_id: str
    query: str
    material_id: Optional[str] = None
    material_ids: Optional[list] = None
    quick_action: Optional[str] = None  # "summarize", "exam_notes", "mcqs", "important_topics", "explain_simply", "revision_plan"

# ── Helpers ──

def chunk_text(text: str, title: str, chunk_size=1500, overlap=250):
    chunks = []
    start = 0
    text_len = len(text)
    chunk_idx = 1
    
    while start < text_len:
        end = min(start + chunk_size, text_len)
        if end < text_len:
            last_newline = text.rfind('\n', start, end)
            last_period = text.rfind('. ', start, end)
            if last_newline > start + chunk_size // 2:
                end = last_newline + 1
            elif last_period > start + chunk_size // 2:
                end = last_period + 2
                
        chunk_str = text[start:end].strip()
        if len(chunk_str) > 20:
            chunks.append({"text": chunk_str, "title": title, "idx": chunk_idx})
            chunk_idx += 1
            
        if end >= text_len:
            break
            
        next_start = end - overlap
        if next_start <= start:
            next_start = start + 100
        start = next_start
        
        if chunk_idx > 200:
            break
            
    return chunks


def score_chunk(chunk: str, query: str) -> float:
    query_terms = set(query.lower().split())
    chunk_terms = chunk.lower().split()
    score = 0.0
    for term in query_terms:
        if len(term) > 3:
            count = chunk_terms.count(term)
            if count > 0:
                score += (count / len(chunk_terms)) * 10
    return score

def clean_extracted_text(text: str) -> str:
    import re
    # Normalize whitespace
    text = re.sub(r'[ \t]+', ' ', text)
    # Remove excessive repetitive characters
    text = re.sub(r'([.=_~*-]){4,}', '', text)
    lines = text.split('\n')
    cleaned_lines = []
    for line in lines:
        line = line.strip()
        if not line:
            continue
        # Remove very short lines that are just numbers or single characters
        if len(line) < 3 and not re.match(r'^[A-Za-z0-9]+$', line):
            continue
        # If line has too many non-ascii/math characters, try to preserve alphanumeric
        alpha_num_count = sum(c.isalnum() for c in line)
        if alpha_num_count < len(line) * 0.3 and len(line) > 10:
            continue
        
        # Replace broken formula symbols
        line = line.replace('∑', 'Sum of ')
        line = line.replace('∏', 'Product of ')
        line = line.replace('∫', 'Integral of ')
        line = line.replace('√', 'Square root of ')
        
        cleaned_lines.append(line)
    return "\n".join(cleaned_lines)

def extract_candidate_topics(text: str) -> list:
    import re
    lines = text.split('\n')
    topics = []
    keywords = ["Mean", "Median", "Mode", "Geometric", "Harmonic", "Standard Deviation", "Variance", "Probability", "Theorem", "Properties", "Examples", "Algorithm", "Definition", "Architecture", "Model", "Framework"]
    
    for line in lines:
        line = line.strip()
        if not line: continue
        # Detect headings: Short lines ending with colon, or all caps, or Title Case without ending punctuation
        if 5 < len(line) < 60:
            if line.isupper() or line.istitle() or line.endswith(':'):
                clean_topic = line.strip('.:- ')
                if clean_topic and clean_topic not in topics:
                    topics.append(clean_topic)
                    continue
        
        # Look for keywords
        for kw in keywords:
            if kw.lower() in line.lower() and len(line) < 80:
                if line not in topics:
                    topics.append(line)

    return list(dict.fromkeys(topics))[:10]

def answer_custom_question(query: str, top_chunks: list) -> str:
    import re
    if not top_chunks:
        return "I cannot answer this because no content is available to analyze."
    
    query_lower = query.lower()
    full_text = " \n".join([clean_extracted_text(c["text"]) for c in top_chunks])
    sentences = [s.strip() for s in re.split(r'(?<=[.!?]) +|\n+', full_text) if len(s.strip()) > 20]
    
    if "time" in query_lower and ("how much" in query_lower or "how long" in query_lower or "required" in query_lower):
        total_words = sum(len(s.split()) for s in sentences)
        reading_speed = 200
        reading_time = max(1, total_words // reading_speed)
        revision_time = max(1, reading_time // 2)
        practice_time = max(1, reading_time)
        total_time = reading_time + revision_time + practice_time
        
        out = f"### Estimated Study Time\n\n"
        out += f"Based on the length of the selected materials (~{total_words} words), here is an estimate:\n\n"
        out += f"- **Reading Time:** ~{reading_time} minutes\n"
        out += f"- **Revision Time:** ~{revision_time} minutes\n"
        out += f"- **Practice/Examples:** ~{practice_time} minutes\n"
        out += f"**Total Estimated Time:** ~{total_time} minutes\n"
        return out
        
    query_terms = [t for t in query_lower.split() if len(t) > 3]
    if not query_terms:
        query_terms = query_lower.split()
        
    scored_sentences = []
    for s in sentences:
        score = sum(1 for t in query_terms if t in s.lower())
        if score > 0:
            scored_sentences.append((score, s))
            
    scored_sentences.sort(key=lambda x: x[0], reverse=True)
    
    out = f"### Answer (Local Analysis)\n\n"
    if not scored_sentences:
        out += "I couldn't find a direct answer to your question in the extracted material.\n\n"
        out += "**However, here is what the material mostly covers:**\n"
        topics = extract_candidate_topics(full_text)
        if topics:
            out += "- " + "\n- ".join(topics[:4]) + "\n"
        return out
        
    out += f"Based on the extracted material, here is the most relevant information regarding **\"{query}\"**:\n\n"
    seen = set()
    count = 0
    for _, s in scored_sentences:
        if s not in seen:
            seen.add(s)
            out += f"- {s}\n"
            count += 1
            if count >= 5: break
            
    return out

def generate_local_fallback(action: str, top_chunks: list, query: str = None) -> str:
    import random
    import re
    if not top_chunks:
        return "No content available to analyze."
    
    # Combine and clean text
    full_text = " \n".join([clean_extracted_text(c["text"]) for c in top_chunks])
    
    # Split into readable sentences
    sentences = [s.strip() for s in re.split(r'(?<=[.!?]) +|\n+', full_text) if len(s.strip()) > 20]
    if not sentences:
        sentences = [full_text[:200]]

    def get_sentences(min_len=20, max_len=150, n=5):
        valid = [s for s in sentences if min_len <= len(s) <= max_len]
        if not valid:
            valid = sentences
        return valid[:min(n, len(valid))]

    topics = extract_candidate_topics(full_text)

    if action == "summarize":
        out = "### Document Summary (Local Analysis)\n\n"
        out += "**Overview**\n"
        out += "This material covers key educational concepts including " + (", ".join(topics[:3]) if topics else "various topics") + ".\n\n"
        
        out += "**Key Concepts**\n"
        for t in topics[:4]:
            rel = [s for s in sentences if t.lower() in s.lower()]
            desc = rel[0] if rel else "Fundamental concept discussed in the text."
            out += f"- **{t}**: {desc}\n"
            
        out += "\n**Important Definitions/Formulas**\n"
        for s in get_sentences(40, 120, 3):
            out += f"- {s}\n"
            
        out += "\n**Exam Focus Points**\n"
        out += "- Review the definitions and properties of the key concepts.\n"
        out += "- Practice the examples provided in the source material.\n"
        return out

    if action == "important_topics":
        out = "### Key Topics Ranked (Local Analysis)\n\n"
        if not topics:
            out += "Could not automatically extract distinct topics. Here are key phrases:\n"
            for i, s in enumerate(get_sentences(20, 60, 5)):
                out += f"{i+1}. **{s.title()}**\n"
            return out
            
        for i, t in enumerate(topics[:6]):
            out += f"**{i+1}. {t}**\n"
            out += f"- *Why it's important*: Core concept required for understanding the overall subject.\n"
            rel = [s for s in sentences if t.lower() in s.lower() and len(s)>30]
            what = rel[0] if rel else "Review the formulas and examples related to this topic."
            out += f"- *What to revise*: {what}\n\n"
        return out

    if action == "explain_simply":
        out = "### Simple Explanation (Local Analysis)\n\n"
        out += "Imagine you are learning this for the first time. Here is the core idea:\n\n"
        
        core_sentences = get_sentences(40, 150, 4)
        for i, s in enumerate(core_sentences):
            if i == 0:
                out += f"**The Basics:** {s}\n\n"
            elif i == 1:
                out += f"**In simpler terms:** When we talk about {topics[0] if topics else 'this topic'}, we mean that {s.lower()}\n\n"
            elif i == 2:
                out += f"**For example:** Think about how {s.lower()}\n\n"
            else:
                out += f"**Why it matters:** {s}\n\n"
        return out

    if action == "revision_plan":
        out = "### Revision Plan (Local Analysis)\n\n"
        out += "Here is a structured 3-session study plan based on the extracted content:\n\n"
        
        out += "#### Session 1: Fundamentals (45 mins)\n"
        out += f"- **Goal**: Understand the basics of {topics[0] if topics else 'the primary topic'}.\n"
        out += f"- **Tasks**:\n"
        for s in get_sentences(30, 80, 2):
            out += f"  - Read and review: {s}\n"
            
        out += "\n#### Session 2: Deep Dive & Formulas (60 mins)\n"
        out += f"- **Goal**: Apply properties and understand relationships.\n"
        out += f"- **Tasks**:\n"
        out += f"- Review the properties of {', '.join(topics[1:3]) if len(topics)>2 else 'key concepts'}.\n"
        out += f"- Practice translating definitions into working knowledge.\n"
        
        out += "\n#### Session 3: Practice & Review (45 mins)\n"
        out += f"- **Goal**: Self-testing.\n"
        out += f"- **Tasks**:\n"
        out += f"- Solve problems without looking at the notes.\n"
        out += f"- Re-read: {sentences[0] if sentences else 'The introduction'}.\n"
        
        return out

    if action == "mcqs":
        out = "### Practice MCQs (Local Analysis)\n\n"
        used_s = get_sentences(40, 120, 8)
        options_pool = ["Increases proportionately", "Remains constant", "Depends on the variance", "Is mathematically undefined", "Equals zero", "Cannot be determined", "Is perfectly symmetrical", "Follows a normal distribution"]
        
        for i, s in enumerate(used_s):
            words = s.split()
            if len(words) < 6: continue
            
            sorted_words = sorted(words, key=len, reverse=True)
            target_word = sorted_words[0].strip(".,?!;:-()")
            
            question = s.replace(target_word, "______", 1)
            
            opts = [target_word] + random.sample(options_pool, 3)
            random.shuffle(opts)
            correct_letter = chr(65 + opts.index(target_word))
            
            out += f"**Q{i+1}. {question}**\n"
            for j, opt in enumerate(opts):
                out += f"- {chr(65+j)}) {opt}\n"
            out += f"**Answer:** {correct_letter}) {target_word}\n"
            out += f"*Explanation:* Based on the text: '{s}'.\n\n"
        return out

    if action == "exam_notes":
        out = "### Exam Notes (Local Analysis)\n\n"
        if topics:
            out += "**Major Topics Covered:**\n"
            for t in topics:
                out += f"- {t}\n"
            out += "\n"
            
        out += "**Key Highlights & Definitions:**\n"
        for i, chunk in enumerate(top_chunks[:5]):
            c_text = clean_extracted_text(chunk["text"])
            c_sents = [s.strip() for s in re.split(r'(?<=[.!?]) +|\n+', c_text) if 30 < len(s.strip()) < 150]
            if c_sents:
                out += f"#### Important Notes (Part {i+1})\n"
                for s in c_sents[:4]:
                    out += f"- {s}\n"
                out += "\n"
        return out

    # Default/Summarize/Custom Query
    if not action or action not in ["summarize", "important_topics", "explain_simply", "revision_plan", "mcqs", "exam_notes"]:
        if query:
            return answer_custom_question(query, top_chunks)
        else:
            return "### Local Summary\n\n" + "\n\n".join(get_sentences(50, 200, 5))

    summary = "### Local Summary\n\n"
    summary += "\n#### Exam Focus Points\n"
    for s in get_sentences(30, 150, 2):
        summary += f"- {s}\n"
    return summary

QUICK_ACTION_PROMPTS = {
    "summarize": "Summarize the provided study material in detail. Provide an Overview, Key concepts, Important formulas/definitions, Examples covered, and Exam focus points.",
    "exam_notes": "Generate highly detailed exam-ready notes from this material. Include all key definitions, formulas, important theorems, and points likely to be asked in exams. Structure carefully with headings.",
    "mcqs": "Generate 8-10 multiple-choice questions with 4 options each from this material. Mark the correct answer clearly. Add a brief explanation for each answer.",
    "important_topics": "List the most important topics and concepts from this material. Rank them strictly by importance and exam relevance. Give detailed summaries for each.",
    "explain_simply": "Explain the key concepts from this material in simple, easy-to-understand language. Use analogies and examples. Avoid jargon where possible.",
    "revision_plan": "Create a structured revision plan based on this material. Break it into study sessions, suggest time allocation, and prioritize topics by difficulty and importance.",
}


# ── Endpoints ──

@router.post("")
async def add_material(data: MaterialInput):
    user_id = data.user_id
    if user_id not in MATERIALS_DB:
        MATERIALS_DB[user_id] = []

    mat_id = str(uuid.uuid4())
    new_mat = {
        "id": mat_id,
        "title": data.title,
        "content": data.content,
        "subject": data.subject or "",
        "source": "manual",
        "created_at": datetime.now(timezone.utc).isoformat()
    }

    current_materials = list(MATERIALS_DB[user_id])
    current_materials.append(new_mat)
    MATERIALS_DB[user_id] = current_materials

    return {"success": True, "material_id": mat_id, "message": "Material saved successfully."}


@router.post("/import-classroom")
async def import_classroom_materials(data: ClassroomImportInput):
    """Import selected Classroom material metadata into the RAG storage."""
    user_id = data.user_id
    if user_id not in MATERIALS_DB:
        MATERIALS_DB[user_id] = []

    imported = []
    current_materials = list(MATERIALS_DB[user_id])

    for mat in data.materials:
        alt_link = mat.get("alternateLink", "")
        drive_id = mat.get("driveFileId", "")
        already_exists = any(
            (existing.get("alternateLink") == alt_link and alt_link)
            or (existing.get("driveFileId") == drive_id and drive_id)
            for existing in current_materials
        )
        if already_exists:
            continue

        mat_id = str(uuid.uuid4())
        new_mat = {
            "id": mat_id,
            "title": mat.get("title", "Untitled"),
            "content": "",
            "source": "classroom",
            "type": mat.get("type", "unknown"),
            "content_type": mat.get("content_type", "unknown"),
            "content_status": "metadata_only",
            "alternateLink": alt_link,
            "driveFileId": drive_id,
            "courseId": mat.get("courseId", ""),
            "courseName": mat.get("courseName", ""),
            "mimeType": mat.get("mimeType", ""),
            "sourceType": mat.get("sourceType", ""),
            "parentTitle": mat.get("parentTitle", ""),
            "topicName": mat.get("topicName", ""),
            "content_available": False,
            "error_message": "",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        current_materials.append(new_mat)
        imported.append({"id": mat_id, "title": new_mat["title"]})

    MATERIALS_DB[user_id] = current_materials
    return {
        "success": True,
        "imported_count": len(imported),
        "imported": imported,
        "message": f"Imported {len(imported)} material(s)."
    }


@router.get("/{user_id}")
async def get_materials(user_id: str):
    user_materials = MATERIALS_DB.get(user_id, [])
    return {
        "success": True,
        "materials": [
            {
                "id": m["id"],
                "title": m["title"],
                "subject": m.get("subject", ""),
                "source": m.get("source", "manual"),
                "type": m.get("type", "notes"),
                "content_type": m.get("content_type", "unknown"),
                "content_status": m.get("content_status", "ready" if m.get("content", "").strip() else "metadata_only"),
                "courseId": m.get("courseId", ""),
                "courseName": m.get("courseName", ""),
                "topicName": m.get("topicName", ""),
                "parentTitle": m.get("parentTitle", ""),
                "alternateLink": m.get("alternateLink", ""),
                "driveFileId": m.get("driveFileId", ""),
                "mimeType": m.get("mimeType", ""),
                "content_available": bool(m.get("content", "").strip()),
                "created_at": m.get("created_at", ""),
            }
            for m in user_materials
        ]
    }


@router.patch("/{user_id}/{material_id}")
async def update_material_content(user_id: str, material_id: str, data: MaterialUpdateInput):
    """Add/update content for a material (e.g. paste text for a Classroom import)."""
    if user_id not in MATERIALS_DB:
        raise HTTPException(status_code=404, detail="User not found")

    current_materials = list(MATERIALS_DB[user_id])
    found = False
    for mat in current_materials:
        if mat["id"] == material_id:
            mat["content"] = data.content
            mat["content_available"] = bool(data.content.strip())
            mat["content_status"] = "ready" if data.content.strip() else "metadata_only"
            found = True
            break

    if not found:
        raise HTTPException(status_code=404, detail="Material not found")

    MATERIALS_DB[user_id] = current_materials
    return {"success": True, "message": "Content updated."}


@router.delete("/{user_id}/{material_id}")
async def delete_material(user_id: str, material_id: str):
    if user_id in MATERIALS_DB:
        current_materials = list(MATERIALS_DB[user_id])
        MATERIALS_DB[user_id] = [m for m in current_materials if m["id"] != material_id]
    return {"success": True}


@router.post("/query")
async def query_materials(data: QueryInput):
    try:
        user_id = data.user_id
        user_materials = MATERIALS_DB.get(user_id, [])
        if not user_materials:
            raise HTTPException(status_code=404, detail="No study materials found. Please add some first.")

        # Filter by selected material IDs
        if data.material_ids and len(data.material_ids) > 0:
            id_set = set(data.material_ids)
            user_materials = [m for m in user_materials if m["id"] in id_set]
            if not user_materials:
                raise HTTPException(status_code=404, detail="Selected materials not found.")
        elif data.material_id:
            user_materials = [m for m in user_materials if m["id"] == data.material_id]
            if not user_materials:
                raise HTTPException(status_code=404, detail="Specific material not found.")

        # Identify materials with and without content
        with_content = [m for m in user_materials if m.get("content", "").strip()]
        without_content = [m for m in user_materials if not m.get("content", "").strip()]
        missing_content_materials = [{"id": m["id"], "title": m["title"]} for m in without_content]

        if not with_content:
            return {
                "answer": "**No analyzable content found.**\n\nThe selected materials are metadata-only (imported from Classroom) and could not be automatically extracted (e.g. image-only PDF, or unsupported formats like PPTX). Please go to Saved Materials and paste the text content manually.",
                "sources": [],
                "selected_materials": [m["title"] for m in user_materials],
                "suggested_followups": [],
                "confidence": 0,
                "fallback_used": True,
                "missing_content_materials": missing_content_materials,
                "selected_material_debug": [
                    {
                        "id": m["id"],
                        "title": m["title"],
                        "content_status": m.get("content_status"),
                        "content_length": len(m.get("content", "")),
                        "content_available": m.get("content_available")
                    } for m in user_materials
                ]
            }

        # Chunk all materials with content
        all_chunks = []
        for mat in with_content:
            content = mat["content"].replace("\u0000", " ")
            mat_chunks = chunk_text(content, mat["title"], chunk_size=1500, overlap=250)
            all_chunks.extend(mat_chunks)


        # Determine the actual query
        query_text = data.query
        quick_action = data.quick_action

        if quick_action in ["summarize", "exam_notes", "mcqs", "important_topics", "revision_plan"]:
            # Broad document coverage: take limited chunks distributed from start, middle, end
            limit = 6
            if quick_action == "exam_notes": limit = 8
            elif quick_action == "mcqs": limit = 6
            elif quick_action == "revision_plan": limit = 5
            elif quick_action == "summarize": limit = 6
            elif quick_action == "important_topics": limit = 6
            
            top_chunks = []
            for mat in with_content:
                mat_chunks = [c for c in all_chunks if c["title"] == mat["title"]]
                if len(mat_chunks) <= limit:
                    top_chunks.extend(mat_chunks)
                else:
                    top_chunks.extend(mat_chunks[:limit//2])  # First half
                    top_chunks.extend(mat_chunks[-(limit - limit//2):]) # Last half
            
            top_chunks = top_chunks[:limit]
            confidence = 0.95
        else:
            # Score chunks by keyword match
            limit = 5
            scored = [(score_chunk(c["text"], query_text), c) for c in all_chunks]
            scored.sort(key=lambda x: x[0], reverse=True)
            top_scores = [s for s in scored if s[0] > 0][:limit]
            top_chunks = [c for _, c in top_scores] if top_scores else all_chunks[:limit]
            max_score = top_scores[0][0] if top_scores else 0
            confidence = min(1.0, max_score / 5.0) if max_score > 0 else 0.2

        context_str = "\n\n".join([f"Source: {c['title']} (Part {c['idx']})\n{c['text']}" for c in top_chunks])
        sources = list(set([c["title"] for c in top_chunks]))
        selected_material_titles = [m["title"] for m in user_materials]

        # Build the prompt
        if quick_action and quick_action in QUICK_ACTION_PROMPTS:
            system_task = QUICK_ACTION_PROMPTS[quick_action]
        else:
            system_task = "Answer the user's query based ONLY on the provided Context. If the answer is not fully in the context, say what you found and note the gap. Use clean markdown formatting."

        gemini_key = os.getenv("GEMINI_API_KEY")
        if not gemini_key or gemini_key == "dummy":
            print(f"[RAG] Using fast local fallback (quick_action={quick_action}, key='missing')")
            return {
                "answer": generate_local_fallback(quick_action, top_chunks, query=query_text),
                "sources": sources,
                "selected_materials": selected_material_titles,
                "suggested_followups": ["Summarize this", "Generate MCQs", "Important topics"],
                "confidence": round(confidence, 2),
                "fallback_used": True,
                "fallback_reason": "local_analysis",
                "action_type": quick_action or "query",
                "missing_content_materials": missing_content_materials,
                "chunks_used": len(top_chunks),
                "selected_material_debug": [
                    {
                        "id": m["id"],
                        "title": m["title"],
                        "content_status": m.get("content_status"),
                        "content_length": len(m.get("content", "")),
                        "content_available": m.get("content_available")
                    } for m in user_materials
                ]
            }

        try:
            from langchain_google_genai import ChatGoogleGenerativeAI
            from langchain_core.messages import SystemMessage, HumanMessage
            import asyncio
            
            llm = ChatGoogleGenerativeAI(model="gemini-2.5-flash", api_key=gemini_key)

            system_prompt = f"""You are a Study Coach AI for LifeOS. {system_task}

    Keep your answer focused, exam-ready, and highly detailed. Do not cut off the response abruptly.
    If the extracted text contains raw or broken math formulas, translate them into readable plain English.
    Use markdown formatting: headings, bullet points, bold key terms.

    CONTEXT from {len(top_chunks)} chunks across {len(with_content)} material(s):
    {context_str}
    """

            print(f"[RAG] Query Start: {quick_action or 'normal'} | Selected {len(with_content)} materials, {len(top_chunks)} chunks.")
            
            try:
                def sync_invoke():
                    return llm.invoke([
                        SystemMessage(content=system_prompt),
                        HumanMessage(content=query_text)
                    ])
                    
                task = asyncio.create_task(asyncio.to_thread(sync_invoke))
                done, pending = await asyncio.wait([task], timeout=8.0)
                
                if task in done:
                    response = task.result()
                    print("[RAG] Gemini success.")
                    answer = response.content.strip()
                    fallback_used = False
                    fallback_reason = None
                else:
                    raise asyncio.TimeoutError()
                    
            except asyncio.TimeoutError:
                print("[RAG] Gemini Timeout (8s)! Using local fallback.")
                answer = generate_local_fallback(quick_action, top_chunks, query=query_text)
                fallback_used = True
                fallback_reason = "local_analysis"

            return {
                "answer": answer,
                "sources": sources,
                "selected_materials": selected_material_titles,
                "suggested_followups": ["Explain this simpler", "Give me an example", "Test my knowledge"],
                "confidence": round(min(1.0, confidence + 0.3), 2),
                "fallback_used": fallback_used,
                "fallback_reason": fallback_reason,
                "action_type": quick_action or "query",
                "missing_content_materials": missing_content_materials,
                "chunks_used": len(top_chunks),
                "selected_material_debug": [
                    {
                        "id": m["id"],
                        "title": m["title"],
                        "content_status": m.get("content_status"),
                        "content_length": len(m.get("content", "")),
                        "content_available": m.get("content_available")
                    } for m in user_materials
                ]
            }
        except Exception as e:
            print(f"[RAG] Gemini Exception! {e}")
            return {
                "answer": generate_local_fallback(quick_action, top_chunks, query=query_text),
                "sources": sources,
                "selected_materials": selected_material_titles,
                "suggested_followups": [],
                "confidence": 0,
                "fallback_used": True,
                "fallback_reason": "local_analysis",
                "action_type": quick_action or "query",
                "missing_content_materials": missing_content_materials,
                "chunks_used": len(top_chunks),
                "selected_material_debug": [
                    {
                        "id": m["id"],
                        "title": m["title"],
                        "content_status": m.get("content_status"),
                        "content_length": len(m.get("content", "")),
                        "content_available": m.get("content_available")
                    } for m in user_materials
                ]
            }
    except Exception as e:
        import traceback
        print(f"[RAG] Fatal Error in query_materials: {e}")
        traceback.print_exc()
        return {
            "answer": f"**System Error:** {str(e)}\n\nFallback local analysis could not process the query.",
            "sources": [],
            "selected_materials": [],
            "suggested_followups": [],
            "confidence": 0,
            "fallback_used": True,
            "fallback_reason": "fatal_error",
            "action_type": "error",
            "missing_content_materials": [],
            "chunks_used": 0,
            "selected_material_debug": []
        }
