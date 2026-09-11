#!/usr/bin/env python3
"""Probe Squarefoot.com.hk from the runner with several impersonation profiles."""

import time

from curl_cffi import requests as cr

URLS = ["https://www.squarefoot.com.hk/en/buy", "https://www.squarefoot.com.hk/en/rent"]
PROFILES = ["chrome", "chrome99", "chrome110", "chrome116", "chrome120", "chrome124",
            "chrome131", "chrome136", "safari17_ios", "edge101", "firefox"]

for url in URLS[:1]:
    for prof in PROFILES:
        try:
            r = cr.get(url, impersonate=prof, timeout=20)
            hdr = ";".join(f"{k}={v}" for k, v in r.headers.items()
                           if k.lower() in ("cf-mitigated", "server", "cf-ray", "cf-cache-status"))
            print(f"{prof:14} -> {r.status_code} | len {len(r.text)} | {hdr[:130]}")
        except Exception as e:
            print(f"{prof:14} -> ERR {str(e)[:80]}")
        time.sleep(0.8)

# extra header combos using best-guess profile
for label, extra in [("ua-chrome-desktop", {"user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"}),
                     ("ua-chrome-arm", {"user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"}),
                     ("accept-ch-full", {"user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
                                         "sec-ch-ua": '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
                                         "sec-ch-ua-mobile": "?0", "sec-ch-ua-platform": '"Windows"',
                                         "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                                         "Accept-Language": "zh-HK,zh;q=0.9,en;q=0.8"})]:
    try:
        r = cr.get(url, impersonate="chrome124", headers=extra, timeout=20)
        hdr = ";".join(f"{k}={v}" for k, v in r.headers.items() if k.lower() in ("cf-mitigated", "server", "cf-ray"))
        print(f"{label:14} -> {r.status_code} | len {len(r.text)} | {hdr[:130]}")
    except Exception as e:
        print(f"{label:14} -> ERR {str(e)[:80]}")