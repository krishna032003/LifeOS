import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
import urllib.parse
import uuid
from datetime import datetime, timezone
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

raw_uri = os.getenv("MONGO_URI", "mongodb://localhost:27017/lifeos")
if "@" in raw_uri and raw_uri.startswith("mongodb+srv://") and raw_uri.count("@") > 1:
    parts = raw_uri.split("@")
    if len(parts) >= 3:
        prefix_parts = parts[0].split(":")
        if len(prefix_parts) >= 3:
            password = prefix_parts[-1] + "@" + parts[1]
            escaped_password = urllib.parse.quote_plus(password)
            prefix_parts[-1] = escaped_password
            raw_uri = ":".join(prefix_parts) + "@" + "@".join(parts[2:])
            
MONGO_URI = raw_uri

async def seed_database():
    print(f"Connecting to MongoDB at {MONGO_URI}...")
    client = AsyncIOMotorClient(MONGO_URI)
    try:
        db = client.get_database()
    except Exception:
        db = client.get_database("lifeos")
    
    users_collection = db["users"]
    
    # We drop the collection to ensure idempotency when running the seed script multiple times
    await users_collection.drop()
    
    now = datetime.now(timezone.utc)
    user_id = str(uuid.uuid4())
    
    test_user = {
        "user_id": user_id,
        "name": "Krishna Sahu",
        "degree": "B.Tech CSE",
        "year": 3,
        "batch": "F4",
        "goals": [
            "Secure an Uber internship",
            "Solve 3 competitive programming questions in C++ daily"
        ],
        "constraints": [
            "Monday 09:00 AM - Operations Research (Prof. Amita Bhagat)"
        ],
        "created_at": now,
        "updated_at": now
    }
    
    result = await users_collection.insert_one(test_user)
    print(f"Successfully seeded database with user ID: {result.inserted_id}")
    
    # Verify insertion
    user = await users_collection.find_one({"name": "Krishna Sahu"})
    print("User document found in DB:")
    print(user)

if __name__ == "__main__":
    asyncio.run(seed_database())
