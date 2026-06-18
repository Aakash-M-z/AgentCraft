"""
Utility script to log into WhatsApp Web and scan the QR code.
Launches a headed Chromium browser using the persistent session context.
"""
import os
import sys
import asyncio
from playwright.async_api import async_playwright

# Ensure backend folder is in Python path so we can reuse directories
sys.path.append(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
from backend.whatsapp import get_session_dir, ensure_playwright_installed

async def main():
    print("🔍 Initializing session scanner...")
    ensure_playwright_installed()
    
    session_dir = get_session_dir()
    print(f"📁 Persistent session storage path: {session_dir}")
    
    async with async_playwright() as p:
        print("🚀 Launching headed Chromium browser context...")
        context = await p.chromium.launch_persistent_context(
            user_data_dir=session_dir,
            headless=False, # headed mode so user can scan QR
            viewport={"width": 1280, "height": 800},
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            bypass_csp=True,
            args=[
                "--disable-blink-features=AutomationControlled",
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-dev-shm-usage",
            ]
        )
        
        page = context.pages[0] if context.pages else await context.new_page()
        
        print("🌐 Navigating to https://web.whatsapp.com...")
        await page.goto("https://web.whatsapp.com")
        
        print("\n" + "="*60)
        print("👉 SCAN THE QR CODE SHOWN IN THE CHROMIUM BROWSER WINDOW.")
        print("👉 DO NOT CLOSE THE BROWSER UNTIL WHATSAPP WEB IS FULLY LOADED.")
        print("👉 ONCE LOGGED IN AND CHATS ARE VISIBLE, YOU CAN PRESS ENTER HERE TO CLOSE.")
        print("="*60 + "\n")
        
        # Wait for the user to press Enter in terminal to close
        # Using loop to keep page responsive
        while True:
            # We check if chat list has loaded automatically
            chat_list = await page.query_selector('[data-testid="chat-list"]')
            if chat_list:
                print("🎉 Detected successful login! WhatsApp Web chats are now visible.")
                break
            await asyncio.sleep(2)
            
        print("\n✅ Session successfully authenticated and saved!")
        input("Press [Enter] to close the headed browser...")
        await context.close()

if __name__ == "__main__":
    asyncio.run(main())
