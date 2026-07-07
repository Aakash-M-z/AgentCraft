import asyncio
import httpx

async def main():
    method_name = "concatenateAndMultiply"
    
    # We query GitHub code search via public API
    url = f"https://api.github.com/search/code?q={method_name}+in:file+language:python"
    headers = {
        "Accept": "application/vnd.github+json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    }
    
    # Check if there is a GITHUB_TOKEN in the environment
    import os
    from dotenv import load_dotenv
    load_dotenv()
    token = os.getenv("GITHUB_TOKEN")
    if token:
        headers["Authorization"] = f"token {token}"
        
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(url, headers=headers)
        print("Status Code:", resp.status_code)
        if resp.status_code == 200:
            data = resp.json()
            items = data.get("items", [])
            print(f"Found {len(items)} files on GitHub.")
            for idx, item in enumerate(items[:3]):
                print(f"\nFile {idx+1}: {item['name']} in {item['repository']['full_name']}")
                raw_url = item["html_url"].replace("github.com", "raw.githubusercontent.com").replace("/blob/", "/")
                print("Raw URL:", raw_url)
                # Fetch raw content
                file_resp = await client.get(raw_url)
                if file_resp.status_code == 200:
                    print("Content:")
                    print(file_resp.text[:500])

if __name__ == "__main__":
    asyncio.run(main())
