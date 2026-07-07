import asyncio
import httpx
import re
import urllib.parse

async def main():
    title_slug = "concatenate-non-zero-digits-and-multiply-by-sum-i"
    query = f"leetcode {title_slug} Python solution"
    encoded_query = urllib.parse.quote_plus(query)
    search_url = f"https://html.duckduckgo.com/html/?q={encoded_query}"
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    }
    
    async with httpx.AsyncClient(timeout=10, headers=headers) as client:
        resp = await client.get(search_url)
        print("Status:", resp.status_code)
        if resp.status_code == 200:
            html_text = resp.text
            print("Length of HTML:", len(html_text))
            raw_links = re.findall(r'href="([^"]+)"', html_text)
            print("Raw links count:", len(raw_links))
            links = []
            for link in raw_links:
                if 'uddg=' in link:
                    actual_url = urllib.parse.unquote(link.split('uddg=')[1].split('&')[0])
                    print("Found link:", actual_url)
                    links.append(actual_url)
            
            print("\nFiltered links:")
            for link in links:
                print("-", link)

if __name__ == "__main__":
    asyncio.run(main())
