#!/usr/bin/env python3
"""
Hong Kong Property Listing Crawler
Crawls 28Hse.com (HK's largest property portal) and outputs to listings.json
"""

import json
import re
import hashlib
import time
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Optional

import httpx
from bs4 import BeautifulSoup


OUTPUT_FILE = Path(__file__).parent / "listings.json"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}

BASE_URL = "https://www.28hse.com/en"
PAGES_PER_SECTION = 3
LISTINGS_PER_PAGE = 15

DISTRICT_KEYWORDS = {
    "hong_kong_island": [
        "central", "mid-levels", "wan chai", "causeway bay", "north point",
        "quarry bay", "shau kei wan", "happy valley", "tai hang",
        "admiralty", "shek tong tsui", "sai ying pun", "kennedy town",
        "ap lei chau", "aberdeen", "stanley", "repulse bay", "pok fu lam",
        "deep water bay", "tai koo", "sai wan ho", "fortress hill", "braemar",
    ],
    "kowloon": [
        "tsim sha tsui", "jordan", "yau ma tei", "mongkok", "sham shui po",
        "kowloon city", "ho man tin", "to kwa wan", "hung hom", "kowloon bay",
        "ngau chi wan", "kwun tong", "lam tin", "yau tong", "kowloon tong",
        "lai chi kok", "cheung sha wan", "mei foo", "diamond hill", "lok fu",
        "san po kong", "wong tai sin", "kowloon station", "kensingtong", "tai kok tsui",
    ],
    "new_territories": [
        "shatin", "tai po", "fanling", "sheung shui", "tuen mun",
        "yuen long", "tin shui wai", "ma on shan", "tsuen wan",
        "kwai chung", "tsing yi", "tseung kwan o", "sai kung",
        "tai wai", "fo tan", "diamond hill", "clear water bay",
        "tung chung", "discovery bay", "yuen long", "siu leung",
    ],
    "outlying_islands": [
        "cheung chau", "lamma", "peng chau", "lantau", "mui wo",
        "sok kwu wan", "discovery bay", "tung chung",
    ]
}


def generate_id(url: str) -> str:
    return hashlib.md5(url.encode()).hexdigest()[:12]


def detect_district(text: str) -> Optional[str]:
    text_lower = text.lower()
    for district, keywords in DISTRICT_KEYWORDS.items():
        for keyword in keywords:
            if keyword in text_lower:
                return district
    return None


def parse_price(price_text: str) -> Optional[float]:
    if not price_text:
        return None
    m = re.search(r'([\d,.]+)\s*(m|million)', price_text, re.IGNORECASE)
    if m:
        return float(m.group(1).replace(",", "")) * 1000000
    m = re.search(r'\$\s*([\d,.]+)', price_text)
    if m:
        return float(m.group(1).replace(",", ""))
    return None


def parse_sqft(text: str) -> Optional[float]:
    if not text:
        return None
    m = re.search(r'([\d,]+)\s*ft', text, re.IGNORECASE)
    if m:
        return float(m.group(1).replace(",", ""))
    return None


def parse_price_per_sqft(text: str) -> Optional[float]:
    if not text:
        return None
    m = re.search(r'@\s*([\d,]+)', text)
    if m:
        return float(m.group(1).replace(",", ""))
    return None


def parse_bedrooms(text: str) -> Optional[int]:
    if not text:
        return None
    m = re.search(r'(\d+)\s*(?:bedroom|bed|br)', text, re.IGNORECASE)
    if m:
        return int(m.group(1))
    if "studio" in text.lower():
        return 0
    return None


class Hse28Crawler:
    def __init__(self):
        self.client = httpx.Client(headers=HEADERS, follow_redirects=True, timeout=25)
        self.total_results = 0
        self.agent_cache = {}

    def close(self):
        self.client.close()

    def fetch(self, url: str) -> Optional[BeautifulSoup]:
        try:
            response = self.client.get(url)
            if response.status_code != 200:
                print(f"    HTTP {response.status_code}: {url}")
                return None
            return BeautifulSoup(response.text, "lxml")
        except Exception as e:
            print(f"    Error fetching {url}: {e}")
            return None

    def crawl(self) -> List[Dict]:
        listings = []
        sections = ["buy", "rent"]

        for section in sections:
            print(f"  Crawling {section}...")
            for page in range(1, PAGES_PER_SECTION + 1):
                if page == 1:
                    url = f"{BASE_URL}/{section}"
                else:
                    url = f"{BASE_URL}/{section}/page-{page}"

                soup = self.fetch(url)
                if not soup:
                    continue

                self._parse_results_count(soup)

                cards = soup.select("div.property_item")
                if not cards:
                    print(f"    No cards on {url}")
                    break

                for card in cards:
                    listing = self._parse_card(card, section)
                    if listing:
                        listings.append(listing)

                print(f"    page {page}: {len(cards)} items")
                time.sleep(1.5)

        return listings

    def _parse_results_count(self, soup):
        text = soup.get_text(" ", strip=True)
        m = re.search(r'([\d,]+)\s*results?', text)
        if m:
            self.total_results = int(m.group(1).replace(",", ""))

    def _parse_card(self, card, section: str) -> Optional[Dict]:
        link_el = card.select_one("a.detail_page[href*=property-]")
        if not link_el:
            return None

        full_url = link_el["href"]
        title = link_el.get_text(" ", strip=True)

        img_el = card.select_one("img")
        images = []
        if img_el:
            src = img_el.get("src")
            if src and "loadingphoto" not in src:
                images.append(src)

        content = card.select_one("div.content")

        district = None
        sub_district = None
        building_name = None
        floor_level = None

        district_el = content.select_one("div.district_area") if content else None
        if district_el:
            for a in district_el.select("a"):
                text = a.get_text(strip=True)
                if "primary-schoolnet" in a.get("href", ""):
                    continue
                if not sub_district:
                    sub_district = text
                elif not building_name:
                    building_name = text

            unit_desc = district_el.select_one("span.unit_desc")
            if unit_desc:
                floor_text = unit_desc.get_text(strip=True).lower()
                if "high floor" in floor_text or "high floor" in floor_text:
                    floor_level = "high"
                elif "mid floor" in floor_text:
                    floor_level = "mid"
                elif "low floor" in floor_text:
                    floor_level = "low"

            address_text = district_el.get_text(" ", strip=True)
            district = detect_district(district_el.get_text(" ", strip=True) + " " + title)

        price = None
        price_per_sqft = None
        sqft = None

        area_el = content.select_one("div.areaUnitPrice") if content else None
        if area_el:
            area_text = area_el.get_text(" ", strip=True)
            sqft = parse_sqft(area_text)
            price_per_sqft = parse_price_per_sqft(area_text)

        extra = content.select_one("div.extra") if content else None
        price_label = extra.select_one("div.ui.right.floated.red.large.label") if extra else None
        if price_label:
            price = parse_price(price_label.get_text(" ", strip=True))

        tags = []
        bedrooms = None
        property_type = "apartment"
        if extra:
            for tag in extra.select("div.tagLabels .ui.label"):
                tag_text = tag.get_text(" ", strip=True)
                tags.append(tag_text)
                b = parse_bedrooms(tag_text)
                if b is not None:
                    bedrooms = b
                lower = tag_text.lower()
                if "village house" in lower:
                    property_type = "village_house"
                elif "penthouse" in lower:
                    property_type = "penthouse"
                elif "studio" in lower:
                    property_type = "studio"
                elif "duplex" in lower:
                    property_type = "duplex"
                elif "house" in lower:
                    property_type = "house"

        agent_company = None
        company_el = content.select_one("div.companyName") if content else None
        if company_el:
            agent_company = company_el.get_text(" ", strip=True).replace("×", "")

        posted_text = " ".join(card.get_text(" ", strip=True))
        date_posted = None
        m = re.search(r'(\d+\s*(?:seconds?|minutes?|hours?|days?)\s*ago)', posted_text, re.IGNORECASE)
        if m:
            date_posted = m.group(1)

        return {
            "id": generate_id(full_url),
            "title": title,
            "price": price,
            "currency": "HKD",
            "transaction_type": section,
            "district": district,
            "sub_district": sub_district,
            "address": f"{building_name} {sub_district}" if building_name and sub_district else (building_name or sub_district or title),
            "bedrooms": bedrooms,
            "sqft": sqft,
            "price_per_sqft": price_per_sqft,
            "property_type": property_type,
            "floor_level": floor_level,
            "building_name": building_name,
            "source": "28hse",
            "source_url": full_url,
            "agent_company": agent_company,
            "images": images,
            "description": title,
            "features": tags,
            "date_crawled": datetime.now().isoformat(),
            "date_posted": date_posted,
            "is_new": True,
            "price_changed": False,
            "previous_price": None,
        }


def load_existing_listings() -> Dict[str, Dict]:
    if OUTPUT_FILE.exists():
        try:
            with open(OUTPUT_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                return {item["id"]: item for item in data.get("listings", [])}
        except (json.JSONDecodeError, KeyError):
            pass
    return {}


def save_listings(listings: List[Dict], stats: Dict):
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump({
            "last_crawl": datetime.now().isoformat(),
            "stats": stats,
            "listings": listings
        }, f, indent=2, ensure_ascii=False)


def merge_listings(existing: Dict[str, Dict], new_listings: List[Dict]) -> List[Dict]:
    for listing in new_listings:
        lid = listing["id"]
        if lid in existing:
            old = existing[lid]
            if old.get("price") and listing.get("price") and old["price"] != listing["price"]:
                listing["price_changed"] = True
                listing["previous_price"] = old["price"]
            listing["is_new"] = False
        existing[lid] = listing
    return list(existing.values())


def main():
    print("=" * 50)
    print("Hong Kong Property Crawler")
    print("=" * 50)
    print(f"Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print()

    existing = load_existing_listings()
    print(f"Existing listings: {len(existing)}")
    print()

    crawler = Hse28Crawler()
    try:
        listings = crawler.crawl()
    finally:
        crawler.close()

    print()
    print("Merging and deduplicating...")
    merged = merge_listings(existing, listings)

    stats = {
        "total": len(merged),
        "by_source": {"28hse": len(merged)},
        "by_district": {},
        "new_this_crawl": len(listings),
        "last_crawl": datetime.now().isoformat(),
    }

    for listing in merged:
        district = listing.get("district", "unknown")
        if district:
            stats["by_district"][district] = stats["by_district"].get(district, 0) + 1

    save_listings(merged, stats)

    print(f"Saved {len(merged)} listings to {OUTPUT_FILE.name}")
    print()
    print("=" * 50)
    print("Crawl Complete!")
    print("=" * 50)
    print(f"Total listings: {stats['total']}")
    print(f"New this crawl: {stats['new_this_crawl']}")
    print(f"By district: {stats['by_district']}")


if __name__ == "__main__":
    main()
