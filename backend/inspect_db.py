import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def main():
    client = AsyncIOMotorClient('mongodb://localhost:27017')
    db = client.get_database("lifeos")
    doc = await db.users.find_one({"user_id": "Krishna Sahu"})
    print("Database Document for Krishna Sahu:")
    print(doc)

if __name__ == "__main__":
    asyncio.run(main())
