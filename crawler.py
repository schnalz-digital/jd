#!/usr/bin/env python3
"""
Hong Kong Property Listing Crawler
Crawls 28Hse.com, Squarefoot.com.hk and Property.hk and outputs to listings.json
"""

import json
import re
import hashlib
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Dict, Optional

import httpx
from bs4 import BeautifulSoup
from curl_cffi import requests as cffi


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
    m = re.search(r'([\d,]+)\s*億', price_text)
    if m:
        return float(m.group(1).replace(",", "")) * 100000000
    m = re.search(r'([\d,]+)\s*萬', price_text)
    if m:
        return float(m.group(1).replace(",", "")) * 10000
    m = re.search(r'([\d,.]+)\s*(w|wan)', price_text, re.IGNORECASE)
    if m:
        return float(m.group(1).replace(",", "")) * 10000
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
    m = re.search(r'@\s*\$?\s*([\d,]+)', text)
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

    DB_PAGES = [
        ("buy", "https://www.28hse.com/en/buy/a170/dg125/c4730"),
        ("rent", "https://www.28hse.com/en/rent/a170/dg125/c4730"),
    ]

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

                items = self._crawl_url(url, section)
                listings.extend(items)

        for section, url in self.DB_PAGES:
            print(f"  Crawling 28Hse {section} (Discovery Bay district)...")
            listings.extend(self._crawl_url(url, section))

        return listings

    def _crawl_url(self, url: str, section: str) -> List[Dict]:
        items = []
        soup = self.fetch(url)
        if not soup:
            return items
        self._parse_results_count(soup)
        cards = soup.select("div.property_item")
        if not cards:
            print(f"    No cards on {url}")
            return items
        for card in cards:
            listing = self._parse_card(card, section)
            if listing:
                items.append(listing)
        print(f"    {url}: {len(cards)} items")
        time.sleep(1.5)
        return items

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
            "date_crawled": datetime.now(timezone.utc).isoformat(),
            "date_posted": date_posted,
            "is_new": True,
            "price_changed": False,
            "previous_price": None,
        }


class SquarefootCrawler:
    def __init__(self):
        self.session = cffi.Session(impersonate="chrome124", timeout=25)
        self.total_results = 0

    def close(self):
        self.session.close()

    def fetch(self, url: str) -> Optional[BeautifulSoup]:
        try:
            response = self.session.get(url)
            if response.status_code == 403:
                time.sleep(3)
                response = self.session.get(url)
            if response.status_code != 200:
                print(f"    HTTP {response.status_code}: {url}")
                return None
            return BeautifulSoup(response.text, "lxml")
        except Exception as e:
            print(f"    Error fetching {url}: {e}")
            return None

    def crawl(self) -> List[Dict]:
        listings = []
        for section in ["buy", "rent"]:
            print(f"  Crawling Squarefoot {section}...")
            for page in range(1, PAGES_PER_SECTION + 1):
                if page == 1:
                    url = f"https://www.squarefoot.com.hk/en/{section}"
                else:
                    url = f"https://www.squarefoot.com.hk/en/{section}/page-{page}"

                soup = self.fetch(url)
                if not soup:
                    continue

                m = re.search(r'([\d,]+)\s*results?', soup.get_text(" "))
                if m:
                    self.total_results = int(m.group(1).replace(",", ""))

                cards = soup.select("div.property_item")
                if not cards:
                    print(f"    No cards on {url}")
                    break

                for card in cards:
                    listing = self._parse_card(card, section)
                    if listing:
                        listings.append(listing)

                print(f"    page {page}: {len(cards)} items")
                time.sleep(1.2)

        return listings

    def _parse_card(self, card, section: str) -> Optional[Dict]:
        img = card.select_one("img[href*=property-]") or card.select_one("img.detail_page")
        if not img:
            return None
        href = img.get("href")
        if not href:
            return None
        full_url = href if href.startswith("http") else "https://www.squarefoot.com.hk" + href

        images = []
        src = img.get("src")
        if src and "loadingphoto" not in src:
            images.append(src)

        cat = card.select_one("div.header.cat")
        sub_district = None
        building_name = None
        unit_desc = None
        if cat:
            parts = [s.strip() for s in cat.stripped_strings
                     if s.strip() and s.strip() not in ("|", "/", " / ", "｜", "·", "-")]
            if parts:
                sub_district = parts[0]
                building_name = parts[1] if len(parts) > 1 else None
                unit_desc = " ".join(parts[2:]) if len(parts) > 2 else None

        meta = card.select_one("div.meta")
        meta_text = meta.get_text(" ", strip=True) if meta else None
        address = building_name or meta_text or sub_district or ""

        price_el = card.select_one("span.priceDesc")
        price = parse_price(price_el.get_text(" ", strip=True)) if price_el else None

        psf_el = card.select_one("span.unitPrice")
        price_per_sqft = parse_price_per_sqft(psf_el.get_text(" ", strip=True)) if psf_el else None

        sqft = None
        bedrooms = None
        area_header = None
        for h in card.select("div.header"):
            if "ft" in h.get_text(" ", strip=True):
                area_header = h
                break
        if area_header:
            area_text = area_header.get_text(" ", strip=True)
            sqft = parse_sqft(area_text)
            bed_icon = area_header.select_one("i.bed.icon")
            if bed_icon:
                nxt = bed_icon.next_sibling
                if nxt and nxt.strip():
                    digits = re.sub(r"\D", "", nxt.strip())
                    if digits:
                        bedrooms = int(digits)

        posted_el = card.select_one("div.meta.small span")
        date_posted = posted_el.get_text(strip=True) if posted_el else None

        property_type = "apartment"
        if unit_desc:
            low = unit_desc.lower()
            if "house" in low and "village" in low:
                property_type = "village_house"
            elif "village" in low:
                property_type = "village_house"
            elif "penthouse" in low:
                property_type = "penthouse"
            elif "studio" in low:
                property_type = "studio"
            elif "duplex" in low:
                property_type = "duplex"
            elif "house" in low:
                property_type = "house"

        district = detect_district(f"{sub_district or ''} {meta_text or ''} {building_name or ''}")

        description_el = card.select_one("div.description")
        description = description_el.get_text(" ", strip=True) if description_el else (title_guard(sub_district, building_name))

        return {
            "id": generate_id(full_url),
            "title": building_name or title_guard(sub_district, meta_text),
            "price": price,
            "currency": "HKD",
            "transaction_type": section,
            "district": district,
            "sub_district": sub_district,
            "address": address,
            "bedrooms": bedrooms,
            "sqft": sqft,
            "price_per_sqft": price_per_sqft,
            "property_type": property_type,
            "floor_level": None,
            "building_name": building_name,
            "source": "squarefoot",
            "source_url": full_url,
            "agent_company": None,
            "images": images,
            "description": description,
            "features": [unit_desc] if unit_desc else [],
            "date_crawled": datetime.now(timezone.utc).isoformat(),
            "date_posted": date_posted,
            "is_new": True,
            "price_changed": False,
            "previous_price": None,
        }


def title_guard(*parts: Optional[str]) -> str:
    return " ".join(p for p in parts if p) or "Property"


class PropertyHkCrawler:
    def __init__(self):
        self.session = cffi.Session(impersonate="chrome124", timeout=25)
        self.total_results = 0

    def close(self):
        self.session.close()

    def fetch(self, url: str) -> Optional[BeautifulSoup]:
        try:
            response = self.session.get(url)
            if response.status_code == 403 and "document.cookie" in response.text:
                m = re.search(r'document\.cookie = "([^"]+)"', response.text)
                if m:
                    cookie = m.group(1).split(";")[0]
                    name, value = cookie.split("=", 1)
                    response = self.session.get(url, cookies={name: value})
            if response.status_code != 200:
                print(f"    HTTP {response.status_code}: {url}")
                return None
            return BeautifulSoup(response.text, "lxml")
        except Exception as e:
            print(f"    Error fetching {url}: {e}")
            return None

    def crawl(self) -> List[Dict]:
        listings = []
        region_map = {"1": "hong_kong_island", "2": "kowloon", "3": "new_territories", "4": "new_territories"}
        for section in ["buy", "rent"]:
            print(f"  Crawling Property.hk {section}...")
            for path in [f"{section}/o2w1/", f"{section}/"]:
                soup = self.fetch(f"https://www.property.hk/{path}")
                if not soup:
                    continue
                n = 0
                for tr in soup.select("div#proplist tr"):
                    a = tr.select_one('a[href*="/asking_detail/"]')
                    if not a:
                        continue
                    listing = self._parse_row(tr, a, section, region_map)
                    if listing:
                        listings.append(listing)
                        n += 1
                print(f"    {path}: {n} items")
                time.sleep(1.2)
        return listings

    def _parse_row(self, tr, a, section: str, region_map) -> Optional[Dict]:
        href = a["href"]
        full_url = "https://www.property.hk" + href

        title_el = tr.select_one("span.bname")
        title = title_el.get_text(strip=True) if title_el else ""

        img = tr.select_one("img.media-object.image")
        images = [img["src"]] if img and img.get("src") else []

        district = None
        sub_district = None
        for a_el in tr.select("a"):
            h = a_el.get("href") or ""
            mm = re.search(r"/buy/a([1234])d\d+/", h) or re.search(r"/rent/a([1234])d\d+/", h)
            if mm:
                district = region_map.get(mm.group(1))
                sub_district = a_el.get_text(strip=True) or None
                break

        row_text = tr.get_text(" ", strip=True)
        floor_level = None
        if "高層" in row_text:
            floor_level = "high"
        elif "中層" in row_text:
            floor_level = "mid"
        elif "低層" in row_text:
            floor_level = "low"

        bedrooms = None
        bed_el = tr.select_one("div.icon-bedroom")
        if bed_el:
            try:
                bedrooms = int(re.sub(r"\D", "", bed_el.get_text(strip=True)) or 0)
            except ValueError:
                bedrooms = None

        bts = tr.select("td.breaktext")
        sqft = None
        if len(bts) >= 2:
            net = bts[1].get_text(" ", strip=True)
            gross = bts[0].get_text(" ", strip=True)
            sqft = parse_num(net) if parse_num(net) else parse_num(gross)

        price = None
        price_per_sqft = None
        if len(bts) >= 3:
            price_cell = bts[2]
            sale_el = price_cell.select_one("span.saleprice")
            rent_el = price_cell.select_one("span.rentprice")
            if sale_el is not None:
                price = parse_price(sale_el.get_text(" "))
            elif rent_el is not None:
                price = parse_price(rent_el.get_text(" ", strip=True))
            if price is None:
                if section == "rent":
                    rr = tr.select_one("div#proplist span.rentprice")
                    if rr:
                        price = parse_price(rr.get_text(" ", strip=True))
            price_per_sqft = parse_price_per_sqft(price_cell.get_text(" ", strip=True)) if price_cell else None

        agent = None
        info = tr.select_one('td[style*=max-width]')
        if info:
            for t in info.stripped_strings:
                s = t.strip()
                if 2 <= len(s) <= 40 and not s.startswith("更新日期") and "樓" not in s and "，" not in s[:3]:
                    agent = s
                    break

        date_posted = None
        dm = re.search(r"更新日期：([\d\-]+)", row_text)
        if dm:
            date_posted = dm.group(1)

        return {
            "id": generate_id(full_url),
            "title": title or sub_district or "Property",
            "price": price,
            "currency": "HKD",
            "transaction_type": section,
            "district": district,
            "sub_district": sub_district,
            "address": f"{title} {sub_district}".strip() if title and sub_district else (title or sub_district or ""),
            "bedrooms": bedrooms,
            "sqft": sqft,
            "price_per_sqft": price_per_sqft,
            "property_type": "apartment",
            "floor_level": floor_level,
            "building_name": title,
            "source": "propertyhk",
            "source_url": full_url,
            "agent_company": agent,
            "images": images,
            "description": f"{title} {sub_district}".strip() if title and sub_district else (title or ""),
            "features": [],
            "date_crawled": datetime.now(timezone.utc).isoformat(),
            "date_posted": date_posted,
            "is_new": True,
            "price_changed": False,
            "previous_price": None,
        }


def parse_num(text: Optional[str]) -> Optional[float]:
    if not text or text.strip() in ("", "--", "-", "N/A"):
        return None
    m = re.search(r"[\d,]+", text)
    if m:
        return float(m.group(0).replace(",", ""))
    return None


class OkayCrawler:
    """OKAY.com Discovery Bay listings (server-rendered HTML, no bot protection)."""

    def __init__(self):
        self.session = cffi.Session(impersonate="chrome124", timeout=25)

    def close(self):
        self.session.close()

    def fetch(self, url: str) -> Optional[BeautifulSoup]:
        try:
            response = self.session.get(url)
            if response.status_code != 200:
                print(f"    HTTP {response.status_code}: {url}")
                return None
            return BeautifulSoup(response.text, "lxml")
        except Exception as e:
            print(f"    Error fetching {url}: {e}")
            return None

    def crawl(self) -> List[Dict]:
        listings = []
        for section in ["buy", "rent"]:
            print(f"  Crawling OKAY {section} (Discovery Bay)...")
            found_total = 0
            for page in range(1, 9):
                if page == 1:
                    url = f"https://www.okay.com/en/property-search/{section}/discovery-bay"
                else:
                    url = f"https://www.okay.com/en/property-search/{section}/discovery-bay/page-{page}"
                soup = self.fetch(url)
                if not soup:
                    continue
                cards = soup.select("a.c-result__building")
                if not cards:
                    print(f"    no cards on {url}")
                    break
                count = 0
                for a in cards:
                    listing = self._parse_card(a, section, url)
                    if listing:
                        listings.append(listing)
                        count += 1
                found_total += count
                print(f"    page {page}: {count} items")
                time.sleep(1.2)
                if len(cards) < 24:
                    break
            print(f"    OKAY {section} total: {found_total}")
        return listings

    def _parse_card(self, a, section: str, list_url: str) -> Optional[Dict]:
        href = a.get("href", "").strip()
        if not href:
            return None
        title = a.get_text(" ", strip=True).strip()
        if not title:
            return None

        info = a.find_parent(class_=re.compile(r"c-result__info"))
        if info is None:
            info = a.parent
        text = info.get_text(" ", strip=True)

        addresses = [el.get_text(" ", strip=True).strip() for el in info.select(".c-result__address")]
        street = addresses[0] if addresses else None

        price = None
        tokens = re.findall(r"HK\$([\d,.]+)([KM]?)", text)
        if section == "rent":
            for num, suffix in tokens:
                if suffix == "K":
                    price = float(num.replace(",", "")) * 1000
                    break
            if price is None:
                for num, suffix in tokens:
                    if not suffix and float(num.replace(",", "")) < 1000000:
                        price = float(num.replace(",", ""))
                        break
        else:
            for num, suffix in tokens:
                if suffix == "M":
                    price = float(num.replace(",", "")) * 1000000
                    break
            if price is None:
                for num, suffix in tokens:
                    if not suffix and float(num.replace(",", "")) > 1000000:
                        price = float(num.replace(",", ""))
                        break

        m = re.search(r"@\s*\$?\s*([\d,]+)\s*/\s*SF", text)
        price_per_sqft = parse_num(m.group(1)) if m else None

        ms = re.search(r"([\d,]+)\s*SF\s*\(\s*S\s*\)", text)
        sqft = parse_num(ms.group(1)) if ms else None
        if sqft is None:
            mg = re.search(r"([\d,]+)\s*SF\s*\(\s*G\s*\)", text)
            sqft = parse_num(mg.group(1)) if mg else None

        bedrooms = None
        bathrooms = None
        mb = re.search(r"(\d+)\s*BD\s*(\d+)\s*BA", text)
        if mb:
            bedrooms = int(mb.group(1))
            bathrooms = int(mb.group(2))

        date_posted = None
        md = re.search(r"Updated\s*:?\s*([\d.]+)", text)
        if md:
            try:
                date_posted = datetime.strptime(md.group(1), "%d.%m.%Y").strftime("%Y-%m-%d")
            except ValueError:
                date_posted = None

        district = detect_district(f"Discovery Bay {title} {street or ''}".lower())
        sub_district = "Discovery Bay"

        full_url = href if href.startswith("http") else "https://www.okay.com" + href
        return {
            "id": generate_id(full_url),
            "title": title,
            "price": price,
            "currency": "HKD",
            "transaction_type": section,
            "district": district or "new_territories",
            "sub_district": sub_district,
            "address": f"{street}, {sub_district}".strip(", ") if street else sub_district,
            "bedrooms": bedrooms,
            "sqft": sqft,
            "price_per_sqft": price_per_sqft,
            "property_type": "apartment",
            "floor_level": None,
            "building_name": title,
            "source": "okay",
            "source_url": full_url,
            "agent_company": None,
            "images": [],
            "description": f"{title} - {street}, {sub_district}" if street else title,
            "features": [],
            "date_crawled": datetime.now(timezone.utc).isoformat(),
            "date_posted": date_posted,
            "is_new": True,
            "price_changed": False,
            "previous_price": None,
        }


class CentalineCrawler:
    """Centaline (hk.centanet.com) Discovery Bay listings. No bot protection; SSR Nuxt page."""

    def __init__(self):
        self.session = cffi.Session(impersonate="chrome124", timeout=25)
        self.total_results = 0

    def close(self):
        self.session.close()

    def fetch(self, url: str) -> Optional[BeautifulSoup]:
        try:
            response = self.session.get(url)
            if response.status_code == 403:
                time.sleep(3)
                response = self.session.get(url)
            if response.status_code != 200:
                print(f"    HTTP {response.status_code}: {url}")
                return None
            return BeautifulSoup(response.text, "lxml")
        except Exception as e:
            print(f"    Error fetching {url}: {e}")
            return None

    def crawl(self) -> List[Dict]:
        listings = []
        areas = [
            ("buy", "https://hk.centanet.com/findproperty/en/list/buy/Discovery-Bay_3-LIDHTHXXHT"),
            ("rent", "https://hk.centanet.com/findproperty/en/list/rent/Discovery-Bay_3-LIDHTHXXHT"),
        ]
        for section, url in areas:
            print(f"  Crawling Centaline {section} (Discovery Bay)...")
            soup = self.fetch(url)
            if not soup:
                continue
            cards = soup.select("div.list")
            n = 0
            for card in cards:
                a = card.select_one('a[href*="/findproperty/en/detail/"]')
                if not a:
                    continue
                listing = self._parse_card(card, a, section)
                if listing:
                    listings.append(listing)
                    n += 1
            print(f"    {url}: {n} items")
            time.sleep(1.2)
        return listings

    def _parse_card(self, card, a, section: str) -> Optional[Dict]:
        href = a.get("href", "").strip()
        text = re.sub(r"\s+", " ", card.get_text(" "))

        title_lg = card.select_one(".title-lg")
        title_sm = card.select_one(".title-sm")
        title = title_lg.get_text(" ", strip=True) if title_lg else "Discovery Bay"
        sub = title_sm.get_text(" ", strip=True) if title_sm else ""

        bedrooms = None
        mr = re.search(r"(\d+)\s*Rooms?", sub or "")
        if mr:
            bedrooms = int(mr.group(1))

        floor_level = None
        low = (sub or "").lower()
        if "high floor" in low:
            floor_level = "high"
        elif "mid floor" in low:
            floor_level = "mid"
        elif "low floor" in low:
            floor_level = "low"

        price = None
        if section == "rent":
            mp = re.search(r"Rent \$ ([\d,.]+)", text)
            if mp:
                price = float(mp.group(1).replace(",", ""))
        else:
            mp = re.search(r"Sell \$ ([\d,.]+)(?: (M|K))?", text, re.IGNORECASE)
            if mp:
                num = float(mp.group(1).replace(",", ""))
                if mp.group(2) is not None:
                    mult = {"M": 1000000, "K": 1000}.get(mp.group(2).upper(), 1)
                    price = num * mult
                else:
                    price = num

        ms = re.search(r"S\.A\. ([\d,]+) ft", text)
        sqft = parse_num(ms.group(1)) if ms else None

        mpf = re.search(r"S\.A\. [\d,]+ ft[^@]*@ \$?([\d,.]+) /ft", text)
        price_per_sqft = parse_num(mpf.group(1)) if mpf else None

        district = detect_district(f"Discovery Bay {title} {sub}".lower()) or "new_territories"
        full_url = f"https://hk.centanet.com{href}" if href.startswith("/") else href
        display_title = title if title != "Discovery Bay" else f"Discovery Bay - {section}"

        return {
            "id": generate_id(full_url),
            "title": display_title,
            "price": price,
            "currency": "HKD",
            "transaction_type": section,
            "district": district,
            "sub_district": "Discovery Bay",
            "address": f"{title}, Discovery Bay",
            "bedrooms": bedrooms,
            "sqft": sqft,
            "price_per_sqft": price_per_sqft,
            "property_type": "apartment",
            "floor_level": floor_level,
            "building_name": title if title != "Discovery Bay" else None,
            "source": "centaline",
            "source_url": full_url,
            "agent_company": None,
            "images": [],
            "description": title,
            "features": [],
            "date_crawled": datetime.now(timezone.utc).isoformat(),
            "date_posted": None,
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
            "last_crawl": datetime.now(timezone.utc).isoformat(),
            "stats": stats,
            "listings": listings
        }, f, indent=2, ensure_ascii=False)


def strip_region_from_title(title: str, sub_district: Optional[str]) -> str:
    """Remove the region/sub-district name from a title when it appears as a
    standalone token (never inside a CJK compound word, e.g. the Chinese
    property names where the area is part of the name)."""
    if not title or not sub_district:
        return title
    region = sub_district.strip()
    if not region:
        return title
    pattern = re.compile(
        r'(?<![\u4e00-\u9fffA-Za-z])'          # not preceded by a CJK/letter character
        + re.escape(region)
        + r'(?![\u4e00-\u9fffA-Za-z])',        # not followed by a CJK/letter character
        re.IGNORECASE,
    )
    stripped = pattern.sub('', title, count=1)
    if stripped == title:
        return title
    stripped = re.sub(r'\s+', ' ', stripped)
    stripped = re.sub(r'^[\s\u3000・•|\-,–—，,:，]+', '', stripped)
    stripped = re.sub(r'[\s\u3000・•|\-,–—，,:，]+$', '', stripped)
    return stripped or title


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

    all_listings = []
    for crawler in (Hse28Crawler(), SquarefootCrawler(), PropertyHkCrawler(), OkayCrawler(), CentalineCrawler()):
        try:
            all_listings.extend(crawler.crawl())
        finally:
            crawler.close()

    print()
    print("Merging and deduplicating...")
    merged = merge_listings(existing, all_listings)

    for listing in merged:
        listing["title"] = strip_region_from_title(listing["title"], listing.get("sub_district"))
        if listing.get("building_name"):
            listing["building_name"] = strip_region_from_title(listing["building_name"], listing.get("sub_district"))

    by_source = {}
    by_district = {}
    for listing in merged:
        by_source[listing.get("source", "unknown")] = by_source.get(listing.get("source", "unknown"), 0) + 1
        district = listing.get("district", "unknown")
        if district:
            by_district[district] = by_district.get(district, 0) + 1

    stats = {
        "total": len(merged),
        "by_source": by_source,
        "by_district": by_district,
        "new_this_crawl": len(all_listings),
        "last_crawl": datetime.now(timezone.utc).isoformat(),
    }

    save_listings(merged, stats)

    print(f"Saved {len(merged)} listings to {OUTPUT_FILE.name}")
    print()
    print("=" * 50)
    print("Crawl Complete!")
    print("=" * 50)
    print(f"Total listings: {stats['total']}")
    print(f"New this crawl: {stats['new_this_crawl']}")
    print(f"By source: {stats['by_source']}")
    print(f"By district: {stats['by_district']}")


if __name__ == "__main__":
    main()
