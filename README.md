# MWC Barcelona Attendee Scraper

Scrape MWC Barcelona 2026 attendees by bucket and country filters.

---

## Quick Start

```bash
# 1. Install
pip install requests

# 2. Test connection (replace with your JWT token)
python run_scraper.py test --token "YOUR_JWT_TOKEN"

# 3. Scrape all buckets, all countries
python run_scraper.py scrape-all --token "YOUR_JWT_TOKEN"

# 4. View stats
python run_scraper.py stats
```

---

## Get Your JWT Token

1. Go to https://www.mwcbarcelona.com/mymwc/search (logged in)
2. Open DevTools (`F12`) → **Network** tab
3. Apply any filter on the page
4. Click the `search` request → **Headers** tab
5. Copy the `Jemex-Authorization` value (starts with `eyJ...`)

> Token expires every ~4 hours. Get a new one when you see 401 errors.

---

## Commands

| Command | Description | Example |
|---------|-------------|---------|
| `test` | Test API connection | `python run_scraper.py test --token "TOKEN"` |
| `scrape` | Scrape one bucket | `python run_scraper.py scrape --token "TOKEN" --bucket partners` |
| `scrape-all` | Scrape all buckets | `python run_scraper.py scrape-all --token "TOKEN"` |
| `scrape-country` | Scrape one country | `python run_scraper.py scrape-country --token "TOKEN" --country "ISRAEL"` |
| `stats` | Show database stats | `python run_scraper.py stats` |
| `list-filters` | List all filters | `python run_scraper.py list-filters` |
| `export` | Export to CSV | `python run_scraper.py export --output attendees.csv` |

---

## Buckets

### Partners
```bash
python run_scraper.py scrape --token "TOKEN" --bucket partners
```
Filters: Systems Integrator, Cloud Services, Software Development, Consultancy

### Technical
```bash
python run_scraper.py scrape --token "TOKEN" --bucket technical
```
Filters: Technical/Engineering, R&D, Software Dev, Government, Data Analytics, Enterprise IT

### Product / Innovation
```bash
python run_scraper.py scrape --token "TOKEN" --bucket product_innovation
```
Filters: Strategy, Product Management, Customer Service, Operations, Innovation

---

## Countries

```bash
# Single country
python run_scraper.py scrape-all --token "TOKEN" --countries "UNITED STATES"

# Multiple countries
python run_scraper.py scrape-all --token "TOKEN" --countries "UNITED STATES,ISRAEL,GERMANY"

# Regions
python run_scraper.py scrape-all --token "TOKEN" --countries north_america
python run_scraper.py scrape-all --token "TOKEN" --countries europe
python run_scraper.py scrape-all --token "TOKEN" --countries israel
```

### Supported Countries
| Region | Countries |
|--------|-----------|
| **North America** | United States, Canada |
| **Middle East** | Israel |
| **Europe** | UK, Germany, France, Spain, Italy, Netherlands, Sweden, Switzerland, Belgium, Austria, Denmark, Norway, Finland, Ireland, Portugal, Poland |

---

## Output

### Database
```
data/mwc_attendees.db
```

### Data Per Attendee
| Field | Description |
|-------|-------------|
| `uuid` | Unique MWC ID |
| `full_name` | First + Last name |
| `job_title` | Position |
| `company_name` | Company |
| `bucket` | Filter bucket |
| `country` | Country |
| `mwc_profile_url` | Profile link |
| `first_seen_at` | When scraped |

---

## Project Structure

```
SnirTest/
├── run_scraper.py           # Entry point
├── requirements.txt         # Dependencies
├── data/
│   └── mwc_attendees.db     # Database (created on first run)
└── src/mwc_scraper/
    ├── config.py            # Filter codes
    ├── database.py          # SQLite operations
    ├── api_client.py        # MWC API client
    ├── scraper.py           # Scraping logic
    └── cli.py               # CLI commands
```

---

## API Reference

### Endpoint
```
POST https://bonacms-api.firabarcelona.com/profile/v1/gsmawebteam/28/search
```

### Headers
```
Content-Type: application/json
Jemex-Authorization: {JWT_TOKEN}
```

### Request Body
```json
{
  "random": false,
  "keyword": "",
  "page": 0,
  "filterExclusiveInterests": ["1244", "1272"],
  "filterEventRegister": ["28"],
  "filterCountries": ["932"]
}
```

---

## Filter Codes

### Buckets (filterExclusiveInterests)

**Partners:**
| Filter | Code |
|--------|------|
| Systems Integrator | `1244` |
| Cloud Services | `1272` |
| Software Development | `1273` |
| Consultancy | `1246` |

**Technical:**
| Filter | Code |
|--------|------|
| Technical/Engineering | `1221` |
| R&D | `1228` |
| Software Development | `1230` |
| Government/Regulatory | `1237` |
| Data & Analytics | `1240` |
| Enterprise IT | `1308` |

**Product/Innovation:**
| Filter | Code |
|--------|------|
| Strategy | `1222` |
| Product Management | `1225` |
| Customer Service | `1226` |
| Operations | `1236` |
| Government/Regulatory | `1237` |
| Innovation | `2625` |

### Countries (filterCountries)
| Country | Code |
|---------|------|
| United States | `932` |
| Canada | `738` |
| Israel | `811` |
| United Kingdom | `777` |
| Germany | `757` |
| France | `775` |
| Spain | `768` |
| Italy | `813` |

---

## Troubleshooting

| Error | Solution |
|-------|----------|
| 401 Unauthorized | Token expired - get new one |
| 403 Forbidden | Not logged in |
| Empty results | Check filter codes |
| Connection error | Check internet |

---

## Future Projects

See `docs/FUTURE_ROADMAP.md` for Phase 2+:
- Company enrichment (Apollo API)
- LinkedIn enrichment
- AI qualification
- Messaging automation
- Web dashboard
