"""
WhatsApp Web browser automation engine using Playwright.
Handles persistent contexts, group scanning, message sending, and screenshot capturing.
"""
import os
import re
import asyncio
import sys

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

import logging
import subprocess
from datetime import datetime
from playwright.async_api import async_playwright

logger = logging.getLogger(__name__)

def ensure_playwright_installed():
    """Verify Playwright is installed and download Chromium browser if not present."""
    try:
        import playwright
        logger.info("Playwright library is installed.")
    except ImportError:
        logger.error("Playwright library is not installed! Running pip install...")
        subprocess.run(["pip", "install", "playwright"], capture_output=True)

    # Self-heal check for chromium executable
    try:
        # Check if we can run command line check
        res = subprocess.run(["python", "-m", "playwright", "install", "--help"], capture_output=True)
        if res.returncode == 0:
            logger.info("Self-healing: installing chromium browser...")
            subprocess.run(["python", "-m", "playwright", "install", "chromium"], capture_output=True)
            logger.info("Chromium installed successfully!")
    except Exception as e:
        logger.error(f"Failed to verify/install playwright browsers: {e}")

def get_session_dir() -> str:
    """Return the absolute path to the persistent session directory in the workspace."""
    # Place it inside the backend folder under playwright/.auth/session
    current_dir = os.path.dirname(os.path.abspath(__file__))
    session_dir = os.path.join(current_dir, "playwright", ".auth", "session")
    os.makedirs(session_dir, exist_ok=True)
    return session_dir

def get_screenshot_dir() -> str:
    """Return the absolute path to the screenshots directory in the workspace."""
    current_dir = os.path.dirname(os.path.abspath(__file__))
    screenshot_dir = os.path.join(current_dir, "playwright", "screenshots")
    os.makedirs(screenshot_dir, exist_ok=True)
    return screenshot_dir

async def _get_search_box(page):
    """Locate the search box using multiple robust locator strategies."""
    # Strategy 1: User-facing placeholder (preferred)
    try:
        locator = page.get_by_placeholder("Search or start new chat")
        await locator.wait_for(state="visible", timeout=3000)
        return locator
    except Exception:
        pass

    # Strategy 2: Role-based textbox
    try:
        locator = page.get_by_role("textbox", name="Search")
        await locator.wait_for(state="visible", timeout=3000)
        return locator
    except Exception:
        pass

    # Strategy 3: Specific data-tab / contenteditable (legacy)
    try:
        locator = page.locator('div[contenteditable="true"][data-tab="3"]')
        await locator.wait_for(state="visible", timeout=3000)
        return locator
    except Exception:
        pass

    # Strategy 4: Generic contenteditable in the side pane
    try:
        locator = page.locator('#side div[contenteditable="true"]')
        await locator.wait_for(state="visible", timeout=3000)
        return locator
    except Exception:
        pass

    # Fallback: General first contenteditable text box on the page
    locator = page.locator('div[contenteditable="true"]').first
    await locator.wait_for(state="visible", timeout=10000)
    return locator

async def _wait_for_chat_header(page, chat_name: str, timeout_ms: int = 15000):
    """Wait for the chat header to match the expected chat/group name using robust strategies."""
    strategies = [
        # Strategy 1: Any element with title attribute matching chat_name inside header
        lambda: page.locator(f'header [title="{chat_name}"]').wait_for(state="visible", timeout=3000),
        # Strategy 2: span with title matching chat_name inside header (legacy/standard)
        lambda: page.locator(f'header span[title="{chat_name}"]').wait_for(state="visible", timeout=3000),
        # Strategy 3: exact text match inside header
        lambda: page.locator('header').get_by_text(chat_name, exact=True).wait_for(state="visible", timeout=3000),
        # Strategy 4: text content match inside header (contains)
        lambda: page.locator('header').get_by_text(chat_name, exact=False).wait_for(state="visible", timeout=3000),
    ]
    
    start_time = asyncio.get_event_loop().time()
    last_err = None
    while (asyncio.get_event_loop().time() - start_time) * 1000 < timeout_ms:
        for strategy in strategies:
            try:
                await strategy()
                return  # Success!
            except Exception as e:
                last_err = e
        await asyncio.sleep(0.5)
    
    raise TimeoutError(f"Timed out waiting for chat header matching '{chat_name}'. Last error: {last_err}")

async def run_in_proactor_thread(async_func, *args, **kwargs):
    """
    Run an async function in a separate thread with its own WindowsProactorEventLoop.
    Guarantees subprocess support on Windows, even if Uvicorn's main thread runs SelectorEventLoop.
    """
    if sys.platform != "win32":
        return await async_func(*args, **kwargs)

    import threading
    import asyncio
    
    loop = asyncio.get_running_loop()
    future = loop.create_future()

    def target():
        try:
            # Enforce WindowsProactorEventLoopPolicy in this child thread
            asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
            thread_loop = asyncio.new_event_loop()
            asyncio.set_event_loop(thread_loop)
            
            try:
                coro = async_func(*args, **kwargs)
                res = thread_loop.run_until_complete(coro)
                loop.call_soon_threadsafe(future.set_result, res)
            except Exception as e:
                loop.call_soon_threadsafe(future.set_exception, e)
            finally:
                thread_loop.close()
        except Exception as outer_e:
            loop.call_soon_threadsafe(future.set_exception, outer_e)

    thread = threading.Thread(target=target, daemon=True)
    thread.start()
    return await future

async def extract_group_messages(group_name: str, max_messages: int = 30, log_func=None) -> dict:
    """Wrapper that isolates group message extraction in a dedicated Proactor loop thread."""
    return await run_in_proactor_thread(_extract_group_messages_impl, group_name, max_messages, log_func)

async def _extract_group_messages_impl(group_name: str, max_messages: int = 30, log_func=None) -> dict:
    """
    Launch headless persistent browser context, navigate to WhatsApp Web,
    find the specified group, and extract recent message history.
    """
    ensure_playwright_installed()
    
    if log_func:
        log_func("🚀 Launching WhatsApp Web monitor...")
    else:
        logger.info("Launching WhatsApp Web monitor...")

    session_dir = get_session_dir()
    
    async with async_playwright() as p:
        if log_func:
            log_func("🔐 Restoring persistent session...")
        
        # Robust context launch with retries (e.g. if previous process locked the profile directory)
        context = None
        for attempt in range(1, 4):
            try:
                if log_func:
                    log_func(f"🔐 Launching Chromium persistent context (attempt {attempt}/3)...")
                context = await p.chromium.launch_persistent_context(
                    user_data_dir=session_dir,
                    headless=True,
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
                break
            except Exception as e:
                if log_func:
                    log_func(f"⚠️ Playwright context launch attempt {attempt} failed: {e}")
                if attempt == 3:
                    raise RuntimeError(
                        f"Failed to launch Playwright persistent context after 3 attempts. "
                        f"This usually means another instance of AgentCraft or Chromium is running and holding a lock "
                        f"on the session directory ({session_dir}). Please ensure no background python/chrome processes are running."
                    ) from e
                await asyncio.sleep(2)
        
        page = context.pages[0] if context.pages else await context.new_page()
        page.set_default_timeout(60000) # Give 60 seconds max timeout for cold boot
        
        if log_func:
            log_func("🌐 Navigating to WhatsApp Web (may take a moment to sync)...")
        
        try:
            await page.goto("https://web.whatsapp.com", wait_until="domcontentloaded")
        except Exception as e:
            if log_func:
                log_func(f"⚠️ Navigation warning: {e}. Waiting for page components...")
        
        if log_func:
            log_func("🔐 Verifying authentication status...")
            
        try:
            # Wait for either QR canvas (needs login) or chat list (already logged in)
            await page.wait_for_selector('canvas, [data-testid="chat-list"]', timeout=60000)
        except Exception:
            if log_func:
                log_func("❌ Timeout waiting for WhatsApp Web UI elements to load.")
            await context.close()
            raise RuntimeError("WhatsApp Web interface failed to load or timed out.")
            
        qr_canvas = await page.query_selector('canvas')
        if qr_canvas:
            if log_func:
                log_func("❌ WhatsApp session expired or not authenticated!")
                log_func("📸 Capturing QR code screenshot for alignment...")
            
            screenshot_dir = get_screenshot_dir()
            qr_path = os.path.join(screenshot_dir, "whatsapp_qr.png")
            await page.screenshot(path=qr_path)
            
            if log_func:
                log_func(f"📸 QR Code saved at: {qr_path}")
                log_func("💡 Please run the login script: 'python scripts/login_whatsapp.py' in a headed terminal.")
            
            await context.close()
            raise RuntimeError("WhatsApp authentication required. Please scan the QR code first.")
            
        if log_func:
            log_func("✅ Session verified successfully!")
            log_func(f"🔍 Searching for group: '{group_name}'...")
            
        try:
            # Type group name into search box
            search_box = await _get_search_box(page)
            await search_box.click()
            await search_box.fill(group_name)
            await page.keyboard.press("Enter")
            
            # Verify active chat title is our group name
            await _wait_for_chat_header(page, group_name, timeout_ms=15000)
        except Exception as e:
            if log_func:
                log_func(f"⚠️ Standard selector lookup timed out. Attempting alternative search flow...")
            try:
                # Clear and retry search
                search_box = await _get_search_box(page)
                await search_box.click()
                # Clear input
                await page.keyboard.down("Control")
                await page.keyboard.press("A")
                await page.keyboard.up("Control")
                await page.keyboard.press("Backspace")
                await search_box.fill(group_name)
                await asyncio.sleep(2)
                
                # Directly find span matching group name and click it
                chat_item = await page.wait_for_selector(f'span[title="{group_name}"]', timeout=10000)
                await chat_item.click()
                await _wait_for_chat_header(page, group_name, timeout_ms=10000)
            except Exception as e2:
                if log_func:
                    log_func(f"❌ Could not find or open group '{group_name}': {e2}")
                
                screenshot_dir = get_screenshot_dir()
                err_path = os.path.join(screenshot_dir, "search_failure.png")
                await page.screenshot(path=err_path)
                if log_func:
                    log_func(f"📸 Failure screenshot captured at: {err_path}")
                await context.close()
                raise RuntimeError(f"Could not open WhatsApp group '{group_name}'.")

        if log_func:
            log_func(f"📥 Chat '{group_name}' opened. Loading message list...")

        # Wait for messages to load
        try:
            await page.wait_for_selector('div.message-in, div.message-out', timeout=15000)
        except Exception:
            if log_func:
                log_func("⚠️ No messages found in the active chat pane.")
                
        # Find all message elements
        msg_elements = await page.query_selector_all('div.message-in, div.message-out')
        
        if log_func:
            log_func(f"📋 Loaded {len(msg_elements)} message bubbles. Extracting recent content...")
            
        extracted_messages = []
        target_elements = msg_elements[-max_messages:] if len(msg_elements) > max_messages else msg_elements
        
        for el in target_elements:
            text_el = await el.query_selector('.copyable-text')
            if text_el:
                pre_text = await text_el.get_attribute('data-pre-plain-text')
                text_content = await text_el.inner_text()
                
                if pre_text:
                    # data-pre-plain-text format e.g., "[09:02, 20/05/2026] Mentor Name: " or "[9:02 AM, 5/20/2026] Mentor: "
                    match = re.match(r'\[([\d:APM\s,a-z\/\\\-]+)\]\s*(.*?):\s*$', pre_text)
                    if match:
                        timestamp_raw, sender = match.groups()
                        
                        # Extract time like "09:02" or "9:02 AM"
                        time_match = re.search(r'(\d{1,2}:\d{2}(?:\s*[APap][Mm])?)', timestamp_raw)
                        time_str = time_match.group(1) if time_match else timestamp_raw
                        
                        extracted_messages.append({
                            "sender": sender.strip(),
                            "text": text_content.strip(),
                            "time": time_str.strip()
                        })
                    else:
                        extracted_messages.append({
                            "sender": "Group Member",
                            "text": text_content.strip(),
                            "time": ""
                        })
                else:
                    # Outgoing message or message bubble without metadata
                    cls = await el.get_attribute('class')
                    sender = "Me" if "message-out" in (cls or "") else "Group Member"
                    extracted_messages.append({
                        "sender": sender,
                        "text": text_content.strip(),
                        "time": ""
                    })

        # Capture proof screenshot
        screenshot_dir = get_screenshot_dir()
        screenshot_path = os.path.join(screenshot_dir, "group_messages.png")
        await page.screenshot(path=screenshot_path)
        
        if log_func:
            log_func(f"✅ Extracted {len(extracted_messages)} messages successfully.")
            log_func(f"📸 Captured proof screenshot at: {screenshot_path}")
            
        await context.close()
        
        return {
            "group": group_name,
            "messages": extracted_messages,
            "screenshot": screenshot_path
        }

async def send_whatsapp_message(contact_name: str, message: str, screenshot_path: str = None, log_func=None):
    """Wrapper that isolates sending messages in a dedicated Proactor loop thread."""
    return await run_in_proactor_thread(_send_whatsapp_message_impl, contact_name, message, screenshot_path, log_func)

async def _send_whatsapp_message_impl(contact_name: str, message: str, screenshot_path: str = None, log_func=None):
    """
    Launch headless persistent browser context, search for contact,
    type and send WhatsApp message, and optionally capture screenshot.
    """
    ensure_playwright_installed()
    
    if log_func:
        log_func(f"🚀 Launching WhatsApp to send message to '{contact_name}'...")
    else:
        logger.info(f"Launching WhatsApp to send message to '{contact_name}'...")
        
    session_dir = get_session_dir()
    
    async with async_playwright() as p:
        # Robust context launch with retries (e.g. if previous process locked the profile directory)
        context = None
        for attempt in range(1, 4):
            try:
                if log_func:
                    log_func(f"🔐 Launching Chromium persistent context (attempt {attempt}/3)...")
                context = await p.chromium.launch_persistent_context(
                    user_data_dir=session_dir,
                    headless=True,
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
                break
            except Exception as e:
                if log_func:
                    log_func(f"⚠️ Playwright context launch attempt {attempt} failed: {e}")
                if attempt == 3:
                    raise RuntimeError(
                        f"Failed to launch Playwright persistent context after 3 attempts. "
                        f"This usually means another instance of AgentCraft or Chromium is running and holding a lock "
                        f"on the session directory ({session_dir}). Please ensure no background python/chrome processes are running."
                    ) from e
                await asyncio.sleep(2)
        
        page = context.pages[0] if context.pages else await context.new_page()
        page.set_default_timeout(60000)
        
        await page.goto("https://web.whatsapp.com")
        
        # Verify authenticated
        await page.wait_for_selector('[data-testid="chat-list"]', timeout=60000)
        
        if log_func:
            log_func(f"🔍 Searching for contact/mentor: '{contact_name}'...")
            
        try:
            search_box = await _get_search_box(page)
            await search_box.click()
            await search_box.fill(contact_name)
            await page.keyboard.press("Enter")
            
            # Wait for chat header to confirm we've entered the chat
            await _wait_for_chat_header(page, contact_name, timeout_ms=15000)
        except Exception as e:
            if log_func:
                log_func("⚠️ Standard contact selector lookup timed out. Retrying search flow...")
            try:
                search_box = await _get_search_box(page)
                await search_box.click()
                await page.keyboard.down("Control")
                await page.keyboard.press("A")
                await page.keyboard.up("Control")
                await page.keyboard.press("Backspace")
                await search_box.fill(contact_name)
                await asyncio.sleep(2)
                
                chat_item = await page.wait_for_selector(f'span[title="{contact_name}"]', timeout=10000)
                await chat_item.click()
                await _wait_for_chat_header(page, contact_name, timeout_ms=10000)
            except Exception as e2:
                if log_func:
                    log_func(f"❌ Failed to load chat with contact '{contact_name}': {e2}")
                await context.close()
                raise RuntimeError(f"Could not open chat with contact '{contact_name}'.")

        if log_func:
            log_func(f"📨 Chat with '{contact_name}' loaded. Drafting message...")
            
        # Select input box
        input_box = await page.wait_for_selector('footer div[contenteditable="true"]')
        await input_box.click()
        await input_box.fill(message)
        
        await asyncio.sleep(1) # Safe delay
        
        if log_func:
            log_func("📨 Sending message...")
        await page.keyboard.press("Enter")
        
        # Wait for delivery checks (3 seconds is standard safety)
        await asyncio.sleep(3)
        
        if screenshot_path:
            os.makedirs(os.path.dirname(screenshot_path), exist_ok=True)
            await page.screenshot(path=screenshot_path)
            if log_func:
                log_func(f"📸 Captured proof of sent message at: {screenshot_path}")
                
        if log_func:
            log_func(f"✅ Message sent successfully to '{contact_name}'!")
            
        await context.close()
