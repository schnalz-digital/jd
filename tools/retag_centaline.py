#!/usr/bin/env python3
"""One-off: re-tag Centaline rows whose detail-page breadcrumb proves they
are NOT in Discovery Bay (the list feed is contaminated with nearby NT
developments). Fixes the live data now; the crawler does this going forward.
"""

import json
import re
import subprocess
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

CRUMB_RE = re.compile(r'path:"([^"]+)"')
OUTPUT = "listings.json"
UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
      "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36")


def crumb_label(crumb: str) -> str:
    slug = crumb.split("_", 1)[0]
    return re.sub(r"-+", " ", slug).strip()


def fetch(url: str) -> str:
    for _ in range(2):
        try:
            p = subprocess.run(
                ["curl", "-s", "-A", UA, "-L", "--max-time", "30", url],
                capture_output=True, text=True, timeout=40,
            )
            text = p.stdout or ""
            if text and "paths:[" not in text:
                time.sleep(1.5)
                continue
            return text
        except Exception:
            time.sleep(1.5)
    return ""


def classify(url: str):
    text = fetch(url)
    if not text or "paths:[" not in text:
        return "unknown", None
    crumbs = CRUMB_RE.findall(text)
    if not crumbs:
        return "unknown", None
    if any("discovery" in c.lower() for c in crumbs):
        return "db", None
    if len(crumbs) >= 3:
        return "other", crumb_label(crumbs[-3])
    return "unknown", None


def main() -> None:
    data = json.load(open(OUTPUT, encoding="utf-8"))
    targets = [
        l for l in data["listings"]
        if l.get("source") == "centaline" and (l.get("sub_district") or "").lower() == "discovery bay"
    ]
    print(f"checking {len(targets)} centaline rows tagged 'Discovery Bay'")

    results = {}  # id -> (kind, real_sub)
    with ThreadPoolExecutor(max_workers=8) as ex:
        futs = {ex.submit(classify, l["source_url"]): l["id"] for l in targets}
        done = 0
        for fut in as_completed(futs):
            results[futs[fut]] = fut.result()
            done += 1
            if done % 50 == 0:
                print(f"  {done}/{len(targets)}", file=sys.stderr)

    from collections import Counter
    kinds = Counter(k for k, _ in results.values())
    print("kinds:", dict(kinds))

    changed = 0
    for l in data["listings"]:
        if l.get("source") != "centaline":
            continue
        rid = l["id"]
        if rid not in results:
            continue
        kind, real = results[rid]
        if kind != "other":
            continue
        real = real or None
        if l.get("sub_district") != real:
            l["sub_district"] = real
            if real:
                l["address"] = f"{l.get('building_name') or l.get('title')}, {real}"
            changed += 1

    print(f"re-tagged {changed} listings")
    json.dump(data, open(OUTPUT, "w", encoding="utf-8"), indent=2, ensure_ascii=False)
    print("saved", OUTPUT)


if __name__ == "__main__":
    main()