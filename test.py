import asyncio, os, traceback
from dotenv import load_dotenv

load_dotenv('backend/.env')
from backend.agents.graph import run_agent_workflow

async def main():
    try:
        await run_agent_workflow({'name': 'test'}, 'hello')
    except Exception as e:
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())
