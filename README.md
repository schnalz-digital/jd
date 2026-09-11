# HK Property Listings

Automated Hong Kong property crawler deployed as a **static site** on GitHub Pages.
Crawls **28Hse.com, Squarefoot.com.hk, Property.hk, OKAY.com and Centaline** automatically every **2 hours**
via GitHub Actions cron, commits fresh data, and the frontend displays it.

## Live Site

Once deployed, your site is at:
`https://<your-username>.github.io/<repo-name>/`

## How it works

```
GitHub Actions (cron, every 2h)
        │  python crawler.py → listings.json
        ▼
   commit + push listings.json
        │
        ▼
GitHub Pages → serves static index.html + listings.json
        │
        ▼
   Browser loads listings, filters, export
```

- Crawler runs on GitHub's servers (not your machine) every 2 hours
- The **Refresh** button reloads the latest committed `listings.json`
- You can also trigger a crawl manually from the **Actions** tab → "Crawl and Deploy" → "Run workflow"

## Setup (deploy to GitHub)

1. Create a GitHub repository and push this folder to it:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/<your-username>/<repo-name>.git
   git branch -M main
   git push -u origin main
   ```

2. Enable GitHub Pages:
   - Repo → **Settings** → **Pages**
   - Build and deployment → **Source**: "GitHub Actions"
   - (The included workflow deploys automatically)

3. Done. The `Crawl and Deploy` workflow runs:
   - Every 2 hours (cron `0 */2 * * *`)
   - On every push to `main`
   - Manually via Actions → "Run workflow"

## Running locally (testing)

```bash
./crawl.sh        # runs the crawler once, writes listings.json
```

To preview the site locally, from this folder:
```bash
python3 -m http.server 8000
# open http://localhost:8000
```

## Schedule / cron

The refresh interval is defined in `.github/workflows/crawl.yml`:
```yaml
on:
  schedule:
    - cron: '0 */2 * * *'   # every 2 hours
```
Change `*/2` to adjust (e.g. `*/1` for hourly).

## Features

- **Auto-refresh every 2h** via GitHub Actions cron + manual Refresh button
- **Filters**: district, price range, bedrooms, property type, source
- **Sort**: newest, price, size, price/sqft
- **CSV export** of filtered results
- **Deduplication** and **price-change tracking** across runs
- Fully static — no server to run

## Files

- `.github/workflows/crawl.yml` — GitHub Actions (cron + deploy)
- `crawler.py` — crawler (28Hse, Squarefoot, Property.hk, OKAY.com Discovery Bay, Centaline Discovery Bay; outputs listings.json)
- `tools/probe_spacious.py` — Cloudflare-challenge probe for Spacious.hk (camoufox)
- `index.html` / `css/styles.css` / `js/app.js` — frontend
- `listings.json` — generated data (committed by workflow)
- `crawl.sh` — local crawl helper
- `.nojekyll` — required for GitHub Pages

## Adding more sources

To add another source, add a parser class in `crawler.py` returning dicts matching the
same schema (`source` field set to a unique name — must match a value in the frontend's
source filter checkboxes and `SOURCE_LABELS` in `js/app.js`). Merge it into `main()`
similarly to the existing crawlers. Spacious.hk and other Cloudflare-challenged sites
are probed via `tools/probe_spacious.py`.
