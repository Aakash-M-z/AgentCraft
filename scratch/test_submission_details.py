import asyncio
import httpx
import os
from dotenv import load_dotenv

async def main():
    load_dotenv()
    csrf = os.getenv("LEETCODE_CSRF_TOKEN")
    session = os.getenv("LEETCODE_SESSION")
    
    submission_id = 2058885655
    
    query = """
    query submissionDetails($submissionId: Int!) {
      submissionDetails(submissionId: $submissionId) {
        statusDisplay
        compileError
        runtimeError
        lastTestcase
        code
      }
    }
    """
    
    headers = {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Referer": f"https://leetcode.com/submissions/detail/{submission_id}/",
        "Cookie": f"csrftoken={csrf}; LEETCODE_SESSION={session};",
        "x-csrftoken": csrf
    }
    
    payload = {
        "operationName": "submissionDetails",
        "variables": {"submissionId": submission_id},
        "query": query
    }
    
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post("https://leetcode.com/graphql", json=payload, headers=headers)
        print("Status:", resp.status_code)
        if resp.status_code == 200:
            data = resp.json()
            if "data" in data and "submissionDetails" in data["data"]:
                details = data["data"]["submissionDetails"]
                print("Status Display:", details.get("statusDisplay"))
                print("Compile Error:", details.get("compileError"))
                print("Runtime Error:", details.get("runtimeError"))
                print("Last Testcase:", details.get("lastTestcase"))
                print("\nSubmitted Code:")
                print(details.get("code"))
            else:
                print("No details found:", data)

if __name__ == "__main__":
    asyncio.run(main())
