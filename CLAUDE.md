# CLAUDE.md - MWC Barcelona Attendee Scraper

## Project Purpose

Scrape MWC Barcelona 2026 attendees by bucket and country filters. Store in SQLite database.

---

## Quick Commands

```bash
# Install
pip install requests

# Test API connection
python run_scraper.py test --token "JWT_TOKEN"

# Scrape all buckets, all countries
python run_scraper.py scrape-all --token "JWT_TOKEN"

# Scrape one bucket
python run_scraper.py scrape --token "JWT_TOKEN" --bucket partners

# Scrape one country
python run_scraper.py scrape-all --token "JWT_TOKEN" --countries "UNITED STATES"

# View stats
python run_scraper.py stats

# Export to CSV
python run_scraper.py export --output attendees.csv

# Show new prospects (today)
python run_scraper.py new
```

---

## JWT Token

The user must provide a JWT token from their MWC Barcelona session.

**How to get it:**
1. Log into https://www.mwcbarcelona.com/mymwc/search
2. Open DevTools (F12) → Network tab
3. Apply any filter on the page
4. Click the `search` request → Headers
5. Copy the `Jemex-Authorization` value (starts with `eyJ...`)

**Token expires every ~4 hours.**

---

## Filter Buckets

### Partners
```bash
python run_scraper.py scrape --token "TOKEN" --bucket partners
```
Codes: `1244, 1272, 1273, 1246`
- Systems Integrator, Cloud Services, Software Development, Consultancy

### Technical
```bash
python run_scraper.py scrape --token "TOKEN" --bucket technical
```
Codes: `1221, 1228, 1230, 1237, 1240, 1308`
- Technical/Engineering, R&D, Software Dev, Government, Data Analytics, Enterprise IT

### Product/Innovation
```bash
python run_scraper.py scrape --token "TOKEN" --bucket product_innovation
```
Codes: `1222, 1225, 1226, 1236, 1237, 2625`
- Strategy, Product Management, Customer Service, Operations, Innovation

---

## Countries

### Available
| Country | Code |
|---------|------|
| United States | 932 |
| Canada | 738 |
| Israel | 811 |
| United Kingdom | 777 |
| Germany | 757 |
| France | 775 |
| Spain | 768 |
| Italy | 813 |
| Netherlands | 837 |
| Sweden | 770 |
| Switzerland | 772 |
| Belgium | 725 |
| Austria | 719 |
| Denmark | 752 |
| Norway | 843 |
| Finland | 756 |
| Ireland | 810 |
| Portugal | 762 |
| Poland | 761 |

### Country Groups
```bash
--countries north_america   # US, Canada
--countries israel          # Israel
--countries europe          # All European countries
--countries all             # All countries
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
  "filterExclusiveInterests": ["1244"],
  "filterEventRegister": ["28"],
  "filterCountries": ["932"]
}
```

### Response
```json
{
  "content": [...],
  "totalElements": 1542,
  "totalPages": 78,
  "size": 20,
  "number": 0
}
```

---

## Project Structure

```
SnirTest/
├── run_scraper.py           # Entry point
├── requirements.txt         # Dependencies (requests)
├── data/
│   └── mwc_attendees.db     # SQLite database
└── src/mwc_scraper/
    ├── config.py            # Filter codes & settings
    ├── database.py          # SQLite operations
    ├── api_client.py        # MWC API client
    ├── scraper.py           # Scraping logic
    └── cli.py               # CLI commands
```

---

## Database

### Location
```
data/mwc_attendees.db
```

### Prospects Table
| Field | Description |
|-------|-------------|
| uuid | Unique MWC ID |
| full_name | First + Last name |
| job_title | Position |
| company_name | Company |
| bucket | Filter bucket |
| country | Country |
| mwc_profile_url | Profile link |
| first_seen_at | When scraped |
| status | new, qualified, contacted, etc. |

### Companies Table
| Field | Description |
|-------|-------------|
| name | Company name |
| name_normalized | Lowercase, trimmed |
| domain | Company domain (for enrichment) |
| enriched_at | When enriched |

---

## Error Handling

| Error | Meaning | Solution |
|-------|---------|----------|
| 401 | Token expired | Get new JWT token |
| 403 | Not authenticated | Log into MWC first |
| Empty results | No matches | Check filter codes |
| Connection error | Network issue | Check internet |

---

## Usage Examples

### Scrape US Partners (first page only - for testing)
```bash
python run_scraper.py scrape --token "TOKEN" --bucket partners --countries "UNITED STATES" --max-pages 1
```

### Scrape All Israel Attendees
```bash
python run_scraper.py scrape-all --token "TOKEN" --countries israel
```

### Export Partners to CSV
```bash
python run_scraper.py export --bucket partners --output partners.csv
```

### Show Today's New Prospects
```bash
python run_scraper.py new
```

---

## Notes for Claude

1. **Never hardcode JWT tokens** - always require from user
2. **Rate limiting** - 1 second delay between API requests
3. **Deduplication** - by UUID, won't add duplicates
4. **Company caching** - creates company records for future enrichment
5. **Incremental scraping** - run daily to get only new attendees

---

## Future Projects (Separate)

See `docs/FUTURE_ROADMAP.md`:
- Company enrichment (Apollo API)
- LinkedIn enrichment
- AI qualification
- Messaging automation
- Web dashboard
