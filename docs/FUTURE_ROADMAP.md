# Future Roadmap - MWC Barcelona Automation

This document outlines future projects beyond the core scraping functionality.

---

## Project Overview

```
PROJECT 1: Scraper ✅ (Current)
    ↓
PROJECT 2: Company Enrichment
    ↓
PROJECT 3: Prospect Enrichment
    ↓
PROJECT 4: Qualification Engine
    ↓
PROJECT 5: Messaging System
    ↓
PROJECT 6: Web Dashboard
```

---

## Project 2: Company Enrichment

### Purpose
Enrich company data using Apollo API to understand each prospect's company.

### Features
- Find company domain from company name
- Apollo API integration
- Cache enriched data (don't re-enrich same company)
- Store: description, LinkedIn, website, HQ, employee count

### API
```
Apollo API Key: mnTw-G71QkQ6cJrDuq_iGQ
Endpoint: https://api.apollo.io/v1/organizations/enrich
```

### Data Captured
| Field | Source |
|-------|--------|
| Domain | Web search / Clearbit |
| Description | Apollo |
| LinkedIn URL | Apollo |
| Website | Apollo |
| HQ Location | Apollo |
| Employee Count | Apollo |
| Industry | Apollo |

---

## Project 3: Prospect Enrichment

### Purpose
Enrich individual prospects with LinkedIn data.

### Features
- Find LinkedIn profile URL
- Extract: headline, about, experience
- Store enriched data

### Methods
1. Google search: `"{name}" "{company}" site:linkedin.com`
2. Apollo People API
3. Manual lookup for high-priority prospects

---

## Project 4: Qualification Engine

### Purpose
AI-powered scoring to rank prospects by relevance.

### Features
- Configurable prompts (like Claude Chat)
- Company qualification score
- Prospect qualification score
- Custom criteria per bucket

### Prompts (User-Editable)
```
Company Prompt:
"Score this company 1-100 for partnership potential:
- Company: {{company_name}}
- Description: {{description}}
- Size: {{employee_count}}
Return JSON: {score, reasoning}"

Prospect Prompt:
"Score this prospect 1-100:
- Name: {{full_name}}
- Title: {{job_title}}
- Company: {{company_name}}
Return JSON: {score, reasoning}"
```

---

## Project 5: Messaging System

### Purpose
Semi-automated outreach via MWC platform.

### Features
- AI-generated message drafts
- Human review before sending
- Chrome MCP integration for sending
- Response tracking
- Follow-up automation

### Workflow
```
1. Select prospects to message
2. Add context (optional)
3. AI generates draft
4. Human reviews/edits
5. Approve → Send via MWC
6. Track responses
7. AI suggests replies
```

### Technical
- Chrome DevTools MCP for browser control
- SendBird API for message detection
- Slack/Telegram for notifications

---

## Project 6: Web Dashboard

### Purpose
Central interface for managing everything.

### Features
- Prospect queue (sorted by score)
- Company/prospect details
- Message drafts & approval
- Conversation tracking
- Prompt editor
- Analytics

### Tech Stack
- Backend: FastAPI (Python)
- Frontend: React + Tailwind
- Database: SQLite → PostgreSQL
- Auth: Open link (no login for MVP)

### Views
1. **Prospects Queue** - Review and approve
2. **Messages** - Draft, edit, send
3. **Conversations** - Active threads
4. **Settings** - Prompts, filters
5. **Analytics** - Stats and metrics

---

## Implementation Timeline

| Project | Effort | Dependencies |
|---------|--------|--------------|
| 2. Company Enrichment | 1 week | Scraper complete |
| 3. Prospect Enrichment | 1 week | Company enrichment |
| 4. Qualification Engine | 1 week | Enrichment complete |
| 5. Messaging System | 2 weeks | Chrome MCP setup |
| 6. Web Dashboard | 2-3 weeks | All above |

---

## Cost Estimates

| Service | Usage | Monthly Cost |
|---------|-------|--------------|
| Apollo API | ~1000 companies | $50-100 |
| Claude API | Qualification + messages | $20-50 |
| Hosting (later) | VPS | $10-20 |

**Total: ~$80-170/month**

---

## Resources Needed

### APIs
- [x] Apollo API key (provided)
- [ ] Claude API key
- [ ] Slack webhook URL
- [ ] Telegram bot token

### Tools
- [ ] Chrome DevTools MCP
- [ ] Perplexity (optional research)

---

## Notes

- Each project builds on the previous
- Start simple, add complexity as needed
- Test thoroughly before moving to next phase
- Keep costs low by caching aggressively
