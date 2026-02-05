# MWC Barcelona Attendee Scraper

An automated tool to monitor and track new attendee registrations for MWC Barcelona 2026.

## Overview

This project scrapes the MWC Barcelona attendee search page daily, detects new registrations from specified countries, and stores them in a local database. It uses the official MWC API to fetch attendee data with country filters.

## Features

- **Daily automated scraping** of MWC Barcelona attendees
- **Country-based filtering** (US, Israel, European countries, North America)
- **Duplicate detection** using attendee UUID
- **SQLite storage** for robust local data management
- **Optional Google Sheets sync** for visual access
- **Pagination support** to fetch all attendees (not just the default 20)

---

## Technical Specifications

### API Endpoint

```
POST https://bonacms-api.firabarcelona.com/profile/v1/gsmawebteam/28/search
```

### Required Headers

| Header | Value |
|--------|-------|
| `Content-Type` | `application/json` |
| `Jemex-Authorization` | `{JWT_TOKEN}` |

### Request Body Structure

```json
{
  "random": false,
  "keyword": "",
  "page": 0,
  "filterExclusiveInterests": [],
  "filterEventRegister": ["28"],
  "filterCountries": ["932"]
}
```

### API Response Structure

The API returns paginated results with:
- `content`: Array of attendee objects
- `totalElements`: Total number of matching attendees
- `totalPages`: Total pages available
- `size`: Results per page (20)
- `number`: Current page number (0-indexed)

---

## Data Fields Captured

| Field | Description | Source |
|-------|-------------|--------|
| `uuid` | Unique attendee identifier | Profile URL |
| `profile_link` | Full URL to attendee profile | Constructed from UUID |
| `image_url` | Profile photo URL (Uploadcare CDN) | `img.rounded-full` |
| `name` | Full name (First Last) | `p.text-lg.font-medium` |
| `job_title` | Position/role | `p.font-medium:not(.text-lg)` |
| `company` | Company name | Third `<p>` element |
| `event_badge` | Registered events | `p.font-bold` |
| `country` | Country (from filter) | Filter context |
| `first_seen` | Timestamp when first discovered | Auto-generated |

---

## Filter Configuration

### Target Countries

| Region | Country | API Code |
|--------|---------|----------|
| **North America** | United States | `932` |
| | Canada | `738` |
| **Middle East** | Israel | `811` |
| **Europe** | United Kingdom | `777` |
| | Germany | `757` |
| | France | `775` |
| | Spain | `768` |
| | Italy | `813` |
| | Netherlands | `837` |
| | Sweden | `770` |
| | Switzerland | `772` |
| | Belgium | `725` |
| | Austria | `719` |
| | Denmark | `752` |
| | Norway | `843` |
| | Finland | `756` |
| | Ireland | `810` |
| | Portugal | `762` |
| | Poland | `761` |

### Event Filter

| Event | API Code |
|-------|----------|
| MWC Barcelona 2026 | `28` |
| MWC Las Vegas 2025 | `25` |
| MWC Shanghai 2025 | `24` |
| MWC Kigali 2025 | `26` |
| MWC Doha 2025 | `27` |

### Interest Filters (Optional)

| Interest | API Code |
|----------|----------|
| Artificial Intelligence | `860` |
| 5G / 6G | `843` |
| IoT | `837` |
| Cybersecurity | `849` |
| Cloud Services / Datacenters | `840` |
| Fintech / Finance | `855` |
| Startup Innovation | `838` |
| VR / AR | `1300` |
| Blockchain / Decentralisation | `3332` |

---

## Authentication

### JWT Token

The API requires a JWT token in the `Jemex-Authorization` header.

**Token Details:**
- Algorithm: RS256
- Expiration: ~4 hours from issue
- Obtained from: Browser DevTools → Network tab → Request Headers

**How to extract your JWT token:**

1. Log into [MWC Barcelona](https://www.mwcbarcelona.com/mymwc/search)
2. Open DevTools (F12) → Network tab
3. Filter by "search" to find the API request
4. Copy the `Jemex-Authorization` header value

---

## Storage

### SQLite Database Schema

```sql
CREATE TABLE attendees (
    uuid TEXT PRIMARY KEY,
    profile_link TEXT,
    image_url TEXT,
    name TEXT,
    job_title TEXT,
    company TEXT,
    event_badge TEXT,
    country TEXT,
    first_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_seen DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_country ON attendees(country);
CREATE INDEX idx_first_seen ON attendees(first_seen);
CREATE INDEX idx_company ON attendees(company);
```

### Google Sheets Integration (Optional)

If enabled, new attendees are synced to a Google Sheet with columns:
- Profile Link | Image | Name | Job Title | Company | Event | Country | First Seen

---

## Project Structure

```
MWC-Attendee-Scraper/
├── README.md                 # This file
├── CLAUDE.md                 # AI assistant guidelines
├── config/
│   └── config.yaml           # Configuration (countries, filters, tokens)
├── src/
│   ├── scraper.py            # Main scraping logic
│   ├── api_client.py         # MWC API client
│   ├── database.py           # SQLite operations
│   ├── google_sheets.py      # Google Sheets sync (optional)
│   └── utils.py              # Helper functions
├── data/
│   └── attendees.db          # SQLite database
├── logs/
│   └── scraper.log           # Execution logs
├── requirements.txt          # Python dependencies
└── run_scraper.py            # Entry point
```

---

## Configuration

### config.yaml

```yaml
# MWC API Configuration
api:
  base_url: "https://bonacms-api.firabarcelona.com"
  endpoint: "/profile/v1/gsmawebteam/28/search"
  event_id: "28"  # MWC Barcelona 2026

# Authentication
auth:
  jwt_token: "YOUR_JWT_TOKEN_HERE"
  # Token expires every ~4 hours

# Countries to monitor
countries:
  - id: "932"
    name: "United States"
  - id: "738"
    name: "Canada"
  - id: "811"
    name: "Israel"
  - id: "777"
    name: "United Kingdom"
  - id: "757"
    name: "Germany"
  - id: "775"
    name: "France"
  - id: "768"
    name: "Spain"
  - id: "813"
    name: "Italy"
  - id: "837"
    name: "Netherlands"
  - id: "770"
    name: "Sweden"
  - id: "772"
    name: "Switzerland"
  - id: "725"
    name: "Belgium"
  - id: "719"
    name: "Austria"
  - id: "752"
    name: "Denmark"
  - id: "843"
    name: "Norway"
  - id: "756"
    name: "Finland"
  - id: "810"
    name: "Ireland"
  - id: "762"
    name: "Portugal"
  - id: "761"
    name: "Poland"

# Scraping settings
scraping:
  page_size: 20
  delay_between_requests: 1  # seconds
  max_retries: 3

# Storage
storage:
  database_path: "data/attendees.db"

# Google Sheets (optional)
google_sheets:
  enabled: false
  spreadsheet_id: "YOUR_SPREADSHEET_ID"
  credentials_path: "config/google_credentials.json"

# Logging
logging:
  level: "INFO"
  file: "logs/scraper.log"
```

---

## Usage

### Installation

```bash
# Clone the repository
git clone https://github.com/snirambar/SnirTest.git
cd SnirTest

# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### Running the Scraper

```bash
# Run once
python run_scraper.py

# Run with fresh JWT token
python run_scraper.py --token "YOUR_NEW_JWT_TOKEN"

# Run for specific countries only
python run_scraper.py --countries US,IL,DE

# Export to CSV
python run_scraper.py --export csv
```

### Scheduled Execution (Daily)

**macOS (launchd):**
```bash
# Create a launch agent for daily execution
# See docs/scheduling.md for details
```

**Linux (cron):**
```bash
# Run daily at 8 AM
0 8 * * * cd /path/to/MWC-Attendee-Scraper && ./venv/bin/python run_scraper.py
```

---

## API Reference

### Search Attendees

```python
import requests

def search_attendees(jwt_token, country_id, page=0):
    url = "https://bonacms-api.firabarcelona.com/profile/v1/gsmawebteam/28/search"

    headers = {
        "Content-Type": "application/json",
        "Jemex-Authorization": jwt_token
    }

    payload = {
        "random": False,
        "keyword": "",
        "page": page,
        "filterExclusiveInterests": [],
        "filterEventRegister": ["28"],
        "filterCountries": [country_id]
    }

    response = requests.post(url, json=payload, headers=headers)
    return response.json()
```

### Response Example

```json
{
  "content": [
    {
      "uuid": "a0f16eea-3880-4e94-a816-f8990ac785e0",
      "firstName": "John",
      "lastName": "Doe",
      "company": "Acme Corp",
      "jobTitle": "CTO",
      "profilePicture": "https://ucarecdn.com/...",
      "eventBadges": ["MWC26 Barcelona"]
    }
  ],
  "totalElements": 1542,
  "totalPages": 78,
  "size": 20,
  "number": 0
}
```

---

## DOM Selectors (Browser Scraping Fallback)

If API access fails, use these selectors for browser-based scraping:

| Data Field | CSS Selector |
|------------|--------------|
| Card container | `li a[href*="/mymwc/details/"]` |
| Profile UUID | Extract from `href`: `/mymwc/details/{uuid}` |
| Image | `img.rounded-full` |
| Name | `p.text-lg.font-medium` |
| Job Title | `p.font-medium:not(.text-lg)` |
| Company | Third `<p>` element in card |
| Event Badge | `p.font-bold` |

---

## Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| 401 Unauthorized | JWT token expired - get a new one from browser |
| 403 Forbidden | Not logged in or session expired |
| Empty results | Check country code is valid |
| Rate limited | Increase delay between requests |

### Token Refresh

The JWT token expires every ~4 hours. To refresh:

1. Open browser, navigate to MWC search page
2. Open DevTools → Network tab
3. Perform a search
4. Copy new `Jemex-Authorization` header
5. Update `config.yaml` or pass via `--token` flag

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## License

This project is for personal use only. MWC Barcelona data is subject to their terms of service.

---

## Disclaimer

This tool is intended for legitimate networking purposes at MWC Barcelona. Please:
- Respect attendee privacy
- Do not use data for spam or unsolicited contact
- Comply with GDPR and data protection regulations
- Follow MWC Barcelona's terms of service

---

*Last updated: 2026-02-05*
