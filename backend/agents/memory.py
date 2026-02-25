import os
import time
from backend.models.state import AgentState
from pinecone import Pinecone, ServerlessSpec
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain_core.messages import SystemMessage

pc_key = os.getenv("PINECONE_API_KEY", "")
index_name = "lifeos"

pc = None
index = None
embeddings = None

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
        embeddings = GoogleGenerativeAIEmbeddings(model="models/text-embedding-004")
except Exception as e:
    print(f"Pinecone init error: {e}")

async def memory_node(state: AgentState):
    """
    Retrieves contextual data from Pinecone for RAG.
    """
    user_id = state.get("user_id", "default_user")
    messages = state.get("messages", [])
    
    if not index or not embeddings or not messages:
        return {
            "pipeline_logs": [{"node": "Memory", "message": "Pinecone inactive or no query. Skipping memory retrieval."}],
            "active_node": "Memory"
        }
        
    last_user_msg = messages[-1].content
    
    try:
        query_embedding = await embeddings.aembed_query(last_user_msg)
        
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
        return {
            "pipeline_logs": [{"node": "Memory", "message": f"Retrieval failed via vector database: {str(e)}"}],
            "active_node": "Memory"
        }

async def save_memory(user_id: str, text: str, node_type: str = "reflection"):
    """
    Called by Reflection to persist long-term memories.
    """
    if not index or not embeddings:
        return
        
    try:
        vector = await embeddings.aembed_query(text)
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
