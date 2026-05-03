import os
import time
import asyncio
from backend.models.state import AgentState
from pinecone import Pinecone, ServerlessSpec
from langchain_core.messages import SystemMessage
from google import genai

pc_key = os.getenv("PINECONE_API_KEY", "")
gemini_key = os.getenv("GEMINI_API_KEY", "")
index_name = "lifeos"

pc = None
index = None

# Create a genai client for embeddings dynamically
def get_genai_client():
    gemini_key = os.getenv("GEMINI_API_KEY", "")
    return genai.Client(api_key=gemini_key) if gemini_key else None

async def _embed(text: str) -> list:
    """Embed text using Gemini text-embedding-004 via the new google-genai SDK."""
    _client = get_genai_client()
    if not _client:
        raise RuntimeError("GEMINI_API_KEY not set")
    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(
        None,
        lambda: _client.models.embed_content(
            model="models/embedding-001",
            contents=text,
        )
    )
    return result.embeddings[0].values

try:
    if pc_key and pc_key != "your_pinecone_api_key_here":
        pc = Pinecone(api_key=pc_key)
        
        if index_name not in [idx.name for idx in pc.list_indexes()]:
            pc.create_index(
                name=index_name,
                dimension=768,
                metric="cosine",
                spec=ServerlessSpec(cloud="aws", region="us-east-1")
            )
        index = pc.Index(index_name)
except Exception as e:
    print(f"Pinecone init error: {e}")

async def memory_node(state: AgentState):
    """
    Retrieves contextual data from Pinecone for RAG.
    """
    user_id = state.get("user_id", "default_user")
    messages = state.get("messages", [])
    
    if not index or not messages:
        return {
            "pipeline_logs": [{"node": "Memory", "message": "Pinecone inactive or no query. Skipping memory retrieval."}],
            "active_node": "Memory"
        }
        
    last_user_msg = messages[-1].content
    
    try:
        query_embedding = await _embed(last_user_msg)
        
        results = index.query(
            namespace=user_id,
            vector=query_embedding,
            top_k=3,
            include_metadata=True
        )
        
        retrieved_texts = []
        for match in results.get("matches", []):
            if "text" in match.get("metadata", {}):
                retrieved_texts.append(match["metadata"]["text"])
                
        if retrieved_texts:
            context = "\n".join(retrieved_texts)
            memory_msg = SystemMessage(content=f"Memory Context from Past Conversations:\n{context}")
            return {
                "messages": [memory_msg],
                "pipeline_logs": [{"node": "Memory", "message": f"Successfully retrieved {len(retrieved_texts)} memories from Long-Term storage."}],
                "active_node": "Memory"
            }
        else:
            return {
                "pipeline_logs": [{"node": "Memory", "message": "No relevant historical context found for this query."}],
                "active_node": "Memory"
            }
            
    except Exception as e:
        print(f"Pinecone embedding/query error: {e}")
        return {
            "pipeline_logs": [{"node": "Memory", "message": "Memory skipped (vector retrieval unavailable)."}],
            "active_node": "Memory"
        }

async def save_memory(user_id: str, text: str, node_type: str = "reflection"):
    """
    Called by Reflection to persist long-term memories.
    """
    if not index:
        return
        
    try:
        vector = await _embed(text)
        record = {
            "id": f"{user_id}_{int(time.time()*1000)}",
            "values": vector,
            "metadata": {
                "user_id": user_id,
                "text": text,
                "node_type": node_type,
                "timestamp": time.time()
            }
        }
        index.upsert(vectors=[record], namespace=user_id)
    except Exception as e:
        print(f"Failed to upsert memory: {e}")
