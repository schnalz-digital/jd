#!/usr/bin/env python3
"""
Probe Spacious.hk from the current network using camoufox (hardened Firefox).
Spacious.hk sits behind aggressive Cloudflare (challenge-platform) that blocks
plain clients and vanilla headless browsers; camoufox is a fingerprint-hardened
browser that sometimes clears such challenges.

Exits 0 with PASS json stdout when a real listing page is reached, else FAIL.
Results are also written to probe-result.json for CI artifacts.
"""

import json
import sys
import time


def main() -> None:
    url = "https://www.spacious.hk/en/buy"
    result = {"url": url, "ok": False, "title": None, "listing_links": 0, "seconds": 0.0}

    from camoufox.sync_api import Camoufox

    start = time.time()
    with Camoufox(headless=True, humanize=True) as browser:
        page = browser.new_page()
        page.goto(url, wait_until="domcontentloaded", timeout=45000)
        for _ in range(14):
            page.wait_for_timeout(2500)
            title = page.title()
            if "Just a moment" not in title:
                break
        result["seconds"] = round(time.time() - start, 1)
        result["title"] = page.title()

        if "Just a moment" not in result["title"]:
            links = page.locator('a[href*="/en/buy/"]').count()
            hint = page.locator("text=/apartment|property|listing/i").count()
            result["ok"] = links > 5 or hint > 5
            result["listing_links"] = links
        else:
            result["ok"] = False

    summary = json.dumps(result)
    if result["ok"]:
        print("PASS " + summary)
    else:
        print("FAIL " + summary)
    with open("probe-result.json", "w", encoding="utf-8") as f:
        json.dump(result, f)
    with open("probe-result.txt", "w", encoding="utf-8") as f:
        f.write(summary + "\n")
    sys.exit(0 if result["ok"] else 1)


if __name__ == "__main__":
    main()