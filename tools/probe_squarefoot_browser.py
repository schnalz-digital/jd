#!/usr/bin/env python3
"""Try Squarefoot.com.hk with real browsers from the runner (JS challenge)."""

import time

URL = "https://www.squarefoot.com.hk/en/buy"

print("== attempt: playwright chromium + stealth ==")
try:
    from playwright.sync_api import sync_playwright
    from playwright_stealth import Stealth

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            viewport={"width": 1366, "height": 900},
            locale="zh-HK",
        )
        page = ctx.new_page()
        Stealth().apply_stealth_sync(page)
        page.goto(URL, wait_until="domcontentloaded", timeout=45000)
        title = ""
        for _ in range(14):
            page.wait_for_timeout(2500)
            title = page.title()
            if "Just a moment" not in title:
                break
        cards = page.locator("div.property_item").count()
        print(f"pw  -> title='{title}' property_items={cards}")
        browser.close()
except Exception as e:
    print("pw  -> ERR", str(e)[:120])

print("== attempt: camoufox ==")
try:
    from camoufox.sync_api import Camoufox

    with Camoufox(headless=True, humanize=True) as browser:
        page = browser.new_page()
        page.goto(URL, wait_until="domcontentloaded", timeout=45000)
        title = ""
        for _ in range(14):
            page.wait_for_timeout(2500)
            title = page.title()
            if "Just a moment" not in title:
                break
        cards = page.locator("div.property_item").count()
        print(f"cf  -> title='{title}' property_items={cards}")
except Exception as e:
    print("cf  -> ERR", str(e)[:120])

print("DONE")