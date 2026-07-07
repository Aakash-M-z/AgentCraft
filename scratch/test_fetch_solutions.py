import asyncio
import httpx
import re
import html as html_lib

async def main():
    urls = [
        "https://leetcode.ca/2026-01-02-3754-Concatenate-Non-Zero-Digits-and-Multiply-by-Sum-I/",
        "https://leetcode.doocs.org/en/lc/3754/",
        "https://neelmishra.github.io/blog/dsa/leetcode-contests/weekly/477/q1-concatenate-non-zero-digits-and-multiply-by-sum-i.html"
    ]
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    }
    
    async with httpx.AsyncClient(timeout=15, headers=headers) as client:
        for url in urls:
            print(f"\n================ Fetching {url} ================")
            try:
                resp = await client.get(url)
                print("Status:", resp.status_code)
                if resp.status_code == 200:
                    content = resp.text
                    # Find all code blocks inside <pre> or <code> tags
                    code_blocks = re.findall(r'<pre(?:[^>]*?)>([\s\S]*?)</pre>', content)
                    print(f"Found {len(code_blocks)} code blocks in <pre>.")
                    
                    found_py_code = []
                    for idx, block in enumerate(code_blocks):
                        clean = re.sub(r'<[^>]*?>', '', block)
                        clean = html_lib.unescape(clean).strip()
                        if "class Solution" in clean or "def " in clean:
                            found_py_code.append(clean)
                            print(f"\n[Code Block {idx+1}]:")
                            print(clean[:600])
                    
                    if not found_py_code:
                        # Try to search inside <code> tags
                        code_tags = re.findall(r'<code(?:[^>]*?)>([\s\S]*?)</code>', content)
                        print(f"Found {len(code_tags)} code blocks in <code>.")
                        for idx, block in enumerate(code_tags):
                            clean = re.sub(r'<[^>]*?>', '', block)
                            clean = html_lib.unescape(clean).strip()
                            if ("class Solution" in clean or "def " in clean) and len(clean) > 80:
                                print(f"\n[Code Tag {idx+1}]:")
                                print(clean[:600])
                                found_py_code.append(clean)
            except Exception as e:
                print("Error:", e)

if __name__ == "__main__":
    asyncio.run(main())
