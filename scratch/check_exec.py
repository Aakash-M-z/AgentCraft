import os
import sys
sys.path.append(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))

import asyncio
from backend.database import init_db, AsyncSessionLocal
from backend.repository import ExecutionRepository

async def main():
    await init_db()
    async with AsyncSessionLocal() as db:
        exec_val = await ExecutionRepository.get_by_id(db, 94)
        print("--- Node Results ---")
        import json
        print(json.dumps(exec_val.node_results, indent=2))

if __name__ == "__main__":
    asyncio.run(main())
