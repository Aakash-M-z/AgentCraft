import asyncio
import httpx
import json

async def main():
    title_slug = "concatenate-non-zero-digits-and-multiply-by-sum-i"
    
    query = """
    query questionSolutions($questionSlug: String!, $skip: Int, $first: Int) {
      questionSolutions(
        questionSlug: $questionSlug
        skip: $skip
        first: $first
      ) {
        solutions {
          id
          title
          post {
            id
            content
          }
        }
      }
    }
    """
    
    variables = {
      "questionSlug": title_slug,
      "skip": 0,
      "first": 5
    }
    
    headers = {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    }
    
    payload = {
        "operationName": "questionSolutions",
        "variables": variables,
        "query": query
    }
    
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post("https://leetcode.com/graphql", json=payload, headers=headers)
        print("Status Code:", resp.status_code)
        if resp.status_code == 200:
            data = resp.json()
            if "data" in data and data["data"] and "questionSolutions" in data["data"] and data["data"]["questionSolutions"]:
                solutions = data["data"]["questionSolutions"]["solutions"]
                print(f"Found {len(solutions)} solutions.")
                for idx, sol in enumerate(solutions):
                    print(f"\nSolution {idx+1}: {sol['title']}")
                    content = sol["post"]["content"]
                    print("Content preview:")
                    print(content[:600])
            else:
                print("Response data empty or error:", data)
        else:
            print("Error details:", resp.text)

if __name__ == "__main__":
    asyncio.run(main())
