import asyncio
import urllib.parse
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

load_dotenv()

async def test_db():
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
                
    client = AsyncIOMotorClient(raw_uri)
    db = client.get_database("lifeos")
    user = await db.users.find_one({"name": "Krishna Sahu"})
    print("Found user:", user)

if __name__ == "__main__":
    asyncio.run(test_db())
