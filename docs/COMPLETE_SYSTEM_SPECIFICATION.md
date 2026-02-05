# MWC Barcelona Outreach System - Complete Specification

## System Overview

An intelligent attendee outreach system for MWC Barcelona 2026 that scrapes, enriches, qualifies, and manages communications with prospects across multiple team members.

---

## Part 1: Data Flow Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           MWC SCRAPING                                   │
│  Regions: US, Canada, Israel, Europe                                    │
│  3 Buckets: Partners | Technical | Product/Innovation                   │
│  Raw Data: Full Name, Company Name, Title, UUID                         │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                    COMPANY ENRICHMENT PIPELINE                           │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │ Step 1: Check if company exists in database                      │    │
│  │         YES → Skip enrichment, use cached data                   │    │
│  │         NO  → Continue to Step 2                                 │    │
│  ├─────────────────────────────────────────────────────────────────┤    │
│  │ Step 2: Find company domain                                      │    │
│  │         Method: Web search / Clearbit / manual lookup            │    │
│  ├─────────────────────────────────────────────────────────────────┤    │
│  │ Step 3: Apollo API enrichment (using domain)                     │    │
│  │         → Description, LinkedIn, Website, HQ, Employee Count     │    │
│  ├─────────────────────────────────────────────────────────────────┤    │
│  │ Step 4: Store in companies table (cached for future)             │    │
│  └─────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                   PROSPECT ENRICHMENT PIPELINE                           │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │ Step 1: Find prospect LinkedIn profile                           │    │
│  │         Search: "{name} {company} LinkedIn"                      │    │
│  ├─────────────────────────────────────────────────────────────────┤    │
│  │ Step 2: Extract LinkedIn data                                    │    │
│  │         → Headline, About, Experience, Education, etc.           │    │
│  ├─────────────────────────────────────────────────────────────────┤    │
│  │ Step 3: Store in prospects table                                 │    │
│  └─────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                    QUALIFICATION ENGINE                                  │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │ Company Qualification Prompt (User-configurable)                 │    │
│  │ → Generates company_score + company_notes                        │    │
│  ├─────────────────────────────────────────────────────────────────┤    │
│  │ Prospect Qualification Prompt (User-configurable)                │    │
│  │ → Generates prospect_score + prospect_notes                      │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│  Prompts are editable like Claude Chat - change anytime                 │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                      REVIEW & APPROVE                                    │
│  Dashboard shows ranked prospects                                        │
│  User: Reviews → Approves → Adds context (optional)                     │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                    MESSAGE GENERATION                                    │
│  AI generates draft using all enriched data + user context              │
│  User: Reviews → Edits → Approves → SEND                                │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                   CONVERSATION MANAGEMENT                                │
│  Track: Sent, Replied, Scheduled, Follow-up needed                      │
│  Auto follow-ups based on rules                                          │
│  AI suggests replies when prospect responds                              │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Part 2: Scraping Configuration

### Geographic Filters

| Region | Countries | API Codes |
|--------|-----------|-----------|
| **North America** | United States | 932 |
| | Canada | 738 |
| **Middle East** | Israel | 811 |
| **Europe** | United Kingdom | 777 |
| | Germany | 757 |
| | France | 775 |
| | Spain | 768 |
| | Italy | 813 |
| | Netherlands | 837 |
| | Sweden | 770 |
| | Switzerland | 772 |
| | Belgium | 725 |
| | Austria | 719 |
| | Denmark | 752 |
| | Norway | 843 |
| | Finland | 756 |
| | Ireland | 810 |
| | Portugal | 762 |
| | Poland | 761 |

### Bucket 1: Partners

**Filter Type:** Company Main Activity

| Activity | API Code (TBD) |
|----------|----------------|
| System Integrators | TBD |
| Cloud Services | TBD |
| Software Development | TBD |
| Consultancy | TBD |

### Bucket 2: Technical Prospects

**Filter Type:** Area of Responsibility

| Area | API Code (TBD) |
|------|----------------|
| Technical Engineering | TBD |
| Research and Development | TBD |
| Software Development | TBD |
| Government | TBD |
| Data and Analytics | TBD |
| Enterprise IT | TBD |

### Bucket 3: Product / Innovation

**Filter Type:** Area of Responsibility

| Area | API Code (TBD) |
|------|----------------|
| Strategy | TBD |
| Product Management | TBD |
| Client/Customer Service | TBD |
| Operations | TBD |
| Government Regulatory | TBD |
| Innovation | TBD |

---

## Part 3: Database Schema

### Tables

```sql
-- Companies table (cached enrichment)
CREATE TABLE companies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    domain TEXT,
    description TEXT,
    linkedin_url TEXT,
    website TEXT,
    hq_location TEXT,
    employee_count INTEGER,
    employee_range TEXT,  -- e.g., "50-100", "1000-5000"
    industry TEXT,
    enriched_at DATETIME,
    enrichment_source TEXT,  -- 'apollo', 'manual', 'web_search'
    raw_apollo_data JSON,

    -- Qualification (user-defined scores)
    company_score INTEGER,
    company_notes TEXT,
    qualification_prompt_version TEXT,
    qualified_at DATETIME,

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(name)  -- Prevent duplicate enrichment
);

-- Prospects table (MWC attendees)
CREATE TABLE prospects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT UNIQUE NOT NULL,  -- MWC UUID
    mwc_profile_url TEXT,

    -- Basic data from MWC scraping
    full_name TEXT,
    job_title TEXT,
    company_name TEXT,
    event_badges TEXT,  -- JSON array
    bucket TEXT,  -- 'partners', 'technical', 'product_innovation'
    country TEXT,

    -- Link to company
    company_id INTEGER REFERENCES companies(id),

    -- LinkedIn enrichment
    linkedin_url TEXT,
    linkedin_headline TEXT,
    linkedin_about TEXT,
    linkedin_experience JSON,
    linkedin_enriched_at DATETIME,

    -- Qualification (user-defined scores)
    prospect_score INTEGER,
    prospect_notes TEXT,
    qualification_prompt_version TEXT,
    qualified_at DATETIME,

    -- Status
    status TEXT DEFAULT 'new',  -- new, qualified, approved, contacted, replied, scheduled, closed

    first_seen_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Messages table
CREATE TABLE messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    prospect_id INTEGER REFERENCES prospects(id),

    -- Message content
    message_type TEXT,  -- 'initial', 'follow_up', 'reply', 'meeting_request'
    draft_content TEXT,
    final_content TEXT,
    user_context TEXT,  -- Additional context user provided

    -- Status
    status TEXT DEFAULT 'draft',  -- draft, approved, sent, delivered, read

    -- Timestamps
    drafted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    approved_at DATETIME,
    sent_at DATETIME,
    approved_by INTEGER REFERENCES users(id),

    -- For follow-ups
    follow_up_of INTEGER REFERENCES messages(id),
    scheduled_send_at DATETIME,  -- For auto-send
    auto_send BOOLEAN DEFAULT FALSE
);

-- Conversations table (track MWC messaging threads)
CREATE TABLE conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    prospect_id INTEGER REFERENCES prospects(id),
    mwc_conversation_url TEXT,

    -- Status
    status TEXT DEFAULT 'active',  -- active, scheduled, completed, closed

    -- Meeting info
    meeting_scheduled BOOLEAN DEFAULT FALSE,
    meeting_datetime DATETIME,
    meeting_location TEXT,

    -- Timestamps
    last_message_at DATETIME,
    last_reply_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Replies table (track incoming messages)
CREATE TABLE replies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id INTEGER REFERENCES conversations(id),
    prospect_id INTEGER REFERENCES prospects(id),

    content TEXT,
    detected_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    -- AI analysis
    sentiment TEXT,  -- positive, neutral, negative
    intent TEXT,  -- interested, meeting_request, question, decline
    suggested_reply TEXT,

    -- Response
    responded BOOLEAN DEFAULT FALSE,
    response_message_id INTEGER REFERENCES messages(id)
);

-- Users table (multi-user support)
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    role TEXT DEFAULT 'user',  -- admin, user
    telegram_chat_id TEXT,  -- For notifications
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Qualification prompts table (user-editable)
CREATE TABLE qualification_prompts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT NOT NULL,  -- 'company', 'prospect'
    bucket TEXT,  -- 'partners', 'technical', 'product_innovation', or NULL for all
    prompt_text TEXT NOT NULL,
    version TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_by INTEGER REFERENCES users(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Message templates table (user-editable)
CREATE TABLE message_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT NOT NULL,  -- 'initial', 'follow_up', 'meeting_request', 'reminder'
    bucket TEXT,
    template_text TEXT NOT NULL,
    variables JSON,  -- List of variables used
    is_active BOOLEAN DEFAULT TRUE,
    created_by INTEGER REFERENCES users(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Follow-up rules table
CREATE TABLE follow_up_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    condition_type TEXT,  -- 'no_reply', 'time_based', 'status_change'
    condition_value JSON,  -- e.g., {"days": 3} or {"status": "interested"}
    action TEXT,  -- 'send_follow_up', 'notify_user', 'change_status'
    template_id INTEGER REFERENCES message_templates(id),
    auto_send BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_prospects_company ON prospects(company_name);
CREATE INDEX idx_prospects_status ON prospects(status);
CREATE INDEX idx_prospects_bucket ON prospects(bucket);
CREATE INDEX idx_messages_status ON messages(status);
CREATE INDEX idx_conversations_status ON conversations(status);
```

---

## Part 4: Enrichment Pipeline Details

### Step 1: Find Company Domain

Before calling Apollo, we need the company domain. Options:

| Method | Pros | Cons | Cost |
|--------|------|------|------|
| **Clearbit Name-to-Domain** | Accurate | Paid API | ~$0.05/lookup |
| **Google Search** | Free | Less reliable | Free |
| **Web Scraping** | Free | Slow, unreliable | Free |
| **Manual Fallback** | 100% accurate | Slow | Free |

**Recommended approach:**
1. Try automated domain lookup (Google search or Clearbit)
2. Flag companies where domain not found
3. Manual review queue for failed lookups

### Step 2: Apollo Enrichment

**API Key:** `mnTw-G71QkQ6cJrDuq_iGQ`

**Endpoint:** `https://api.apollo.io/v1/organizations/enrich`

**Request:**
```json
{
  "domain": "example.com"
}
```

**Data captured:**
- `description` → Company description
- `linkedin_url` → Company LinkedIn page
- `website_url` → Company website
- `hq_location` → Headquarters location
- `employee_count` → Number of employees

### Step 3: Prospect LinkedIn Enrichment

**Options:**

| Method | Pros | Cons |
|--------|------|------|
| **Google Search** | Free, simple | May find wrong person |
| **Apollo People Search** | Accurate | Uses credits |
| **LinkedIn Sales Navigator** | Best data | Expensive, manual |
| **Proxycurl** | Good API | Paid |

**Recommended:**
1. Search Google: `"{name}" "{company}" site:linkedin.com`
2. Extract LinkedIn URL from results
3. Optionally scrape public LinkedIn data

---

## Part 5: Qualification System

### Configurable Prompts

Users can create and edit prompts like in Claude Chat:

```
┌─────────────────────────────────────────────────────────────────┐
│ COMPANY QUALIFICATION PROMPT EDITOR                              │
├─────────────────────────────────────────────────────────────────┤
│ Bucket: [Partners ▼]                                             │
│                                                                  │
│ Prompt:                                                          │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Analyze this company for partnership potential:              │ │
│ │                                                              │ │
│ │ Company: {{company_name}}                                    │ │
│ │ Description: {{description}}                                 │ │
│ │ Industry: {{industry}}                                       │ │
│ │ Size: {{employee_count}} employees                          │ │
│ │ Location: {{hq_location}}                                    │ │
│ │                                                              │ │
│ │ Score 1-100 based on:                                        │ │
│ │ - Relevance to AI/ML solutions                              │ │
│ │ - System integration capabilities                            │ │
│ │ - Geographic fit                                             │ │
│ │ - Company size (prefer 50-500 employees)                    │ │
│ │                                                              │ │
│ │ Return JSON: {"score": X, "reasoning": "..."}               │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│ [Save] [Test with sample company]                                │
└─────────────────────────────────────────────────────────────────┘
```

### Prompt Variables Available

**For Company Prompts:**
- `{{company_name}}`
- `{{description}}`
- `{{industry}}`
- `{{employee_count}}`
- `{{hq_location}}`
- `{{website}}`
- `{{linkedin_url}}`

**For Prospect Prompts:**
- `{{full_name}}`
- `{{job_title}}`
- `{{company_name}}`
- `{{linkedin_headline}}`
- `{{linkedin_about}}`
- `{{bucket}}`
- All company variables (via company relation)

---

## Part 6: User Interface

### Web Dashboard Features

#### 1. Prospects Queue
```
┌─────────────────────────────────────────────────────────────────────────┐
│ PROSPECTS QUEUE                                    [Filter ▼] [Export]  │
├─────────────────────────────────────────────────────────────────────────┤
│ Bucket: [All ▼]  Status: [New ▼]  Score: [70+ ▼]  Country: [All ▼]     │
├─────────────────────────────────────────────────────────────────────────┤
│ ☑ │ Score │ Name           │ Title        │ Company      │ Bucket      │
│───┼───────┼────────────────┼──────────────┼──────────────┼─────────────│
│ ☐ │  92   │ John Smith     │ CTO          │ Acme Cloud   │ Partners    │
│ ☐ │  87   │ Jane Doe       │ VP Product   │ TechCorp     │ Product     │
│ ☐ │  84   │ Bob Johnson    │ Dir. of Eng  │ DataSystems  │ Technical   │
│ ☐ │  81   │ Alice Brown    │ CEO          │ CloudStart   │ Partners    │
├─────────────────────────────────────────────────────────────────────────┤
│ Selected: 0  │  [Approve Selected]  [Reject Selected]  [Add Context]   │
└─────────────────────────────────────────────────────────────────────────┘
```

#### 2. Message Drafts
```
┌─────────────────────────────────────────────────────────────────────────┐
│ MESSAGE DRAFT                                                           │
├─────────────────────────────────────────────────────────────────────────┤
│ To: John Smith (CTO @ Acme Cloud)                                       │
│                                                                          │
│ Additional Context (optional):                                           │
│ ┌─────────────────────────────────────────────────────────────────────┐ │
│ │ Met them at AWS re:Invent last year. Interested in our API product │ │
│ └─────────────────────────────────────────────────────────────────────┘ │
│                                                       [Generate Draft]  │
│                                                                          │
│ Generated Message:                                                       │
│ ┌─────────────────────────────────────────────────────────────────────┐ │
│ │ Hi John,                                                            │ │
│ │                                                                     │ │
│ │ Great to see you're heading to MWC Barcelona! I remember our       │ │
│ │ conversation at re:Invent about API integration challenges.        │ │
│ │                                                                     │ │
│ │ At Avon AI, we've been working on something I think would be       │ │
│ │ relevant for Acme Cloud's system integration work...              │ │
│ │                                                                     │ │
│ │ Would love to grab 15 minutes at the event. Let me know!          │ │
│ │                                                                     │ │
│ │ Best,                                                               │ │
│ │ [Your name]                                                         │ │
│ └─────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│ [Edit] [Regenerate] [Approve & Send]                                    │
└─────────────────────────────────────────────────────────────────────────┘
```

#### 3. Conversations (Replies Dashboard)
```
┌─────────────────────────────────────────────────────────────────────────┐
│ ACTIVE CONVERSATIONS                              [Needs Reply: 5 🔴]   │
├─────────────────────────────────────────────────────────────────────────┤
│ │ Name          │ Last Message              │ Status    │ Action       │
│ ├───────────────┼───────────────────────────┼───────────┼──────────────│
│ │ John Smith    │ "Yes, let's meet..."      │ Replied   │ [Reply]      │
│ │ Jane Doe      │ "Tell me more about..."   │ Replied   │ [Reply]      │
│ │ Bob Johnson   │ Sent 2 days ago           │ Pending   │ [Follow-up]  │
│ │ Alice Brown   │ Meeting scheduled Mar 4   │ Scheduled │ [View]       │
└─────────────────────────────────────────────────────────────────────────┘
```

#### 4. Prompt Editor
```
┌─────────────────────────────────────────────────────────────────────────┐
│ QUALIFICATION PROMPTS                                                    │
├─────────────────────────────────────────────────────────────────────────┤
│ Type: [Company ▼]  Bucket: [Partners ▼]                                 │
│                                                                          │
│ Active Prompt:                                                           │
│ ┌─────────────────────────────────────────────────────────────────────┐ │
│ │ [Editable prompt text here - like Claude Chat]                      │ │
│ │                                                                     │ │
│ │ You can change this anytime and it will apply to new prospects.   │ │
│ └─────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│ [Save] [Test] [View History]                                            │
└─────────────────────────────────────────────────────────────────────────┘
```

### Mobile Features

- Responsive web design (works on phone browser)
- Telegram bot for notifications:
  - "New reply from John Smith: 'Yes, let's meet...'"
  - Quick reply buttons
  - Approve/reject from Telegram

### Multi-User Support

- User accounts with email login
- Role-based access (admin, user)
- Activity logging
- Assigned prospects (optional)

---

## Part 7: Technology Stack

### Backend
- **Language:** Python 3.11+
- **Framework:** FastAPI (async, fast, modern)
- **Database:** SQLite (start), PostgreSQL (scale)
- **Task Queue:** Celery + Redis (for scheduled jobs)
- **Browser Automation:** Chrome DevTools MCP

### Frontend
- **Framework:** React or Vue.js (SPA)
- **UI Library:** Tailwind CSS + shadcn/ui
- **Mobile:** Responsive design + PWA

### Integrations
- Apollo API (company enrichment)
- Chrome DevTools MCP (browser automation)
- Telegram Bot API (notifications)
- OpenAI/Claude API (message generation, qualification)

### Hosting (Later)
- **Simple:** Railway, Render, or Fly.io (~$10-20/month)
- **Advanced:** DigitalOcean VPS ($5-10/month)

---

## Part 8: Implementation Phases

### Phase 1: Core Scraping (Week 1)
- [ ] Set up project structure
- [ ] Create SQLite database with schema
- [ ] Implement MWC scraping for all 3 buckets
- [ ] Store raw prospect data
- [ ] Duplicate detection (UUID-based)

### Phase 2: Company Enrichment (Week 2)
- [ ] Domain finder (Google search method)
- [ ] Apollo API integration
- [ ] Company caching logic
- [ ] Basic CLI to run enrichment

### Phase 3: Prospect Enrichment (Week 3)
- [ ] LinkedIn URL finder
- [ ] LinkedIn data extraction
- [ ] Store enriched prospect data

### Phase 4: Qualification Engine (Week 4)
- [ ] Prompt storage and editing
- [ ] Claude API integration for scoring
- [ ] Batch qualification runner

### Phase 5: Web Dashboard (Week 5-6)
- [ ] User authentication
- [ ] Prospects queue view
- [ ] Company/Prospect detail views
- [ ] Prompt editor

### Phase 6: Messaging System (Week 7)
- [ ] Message generation
- [ ] Chrome MCP integration
- [ ] Send message flow
- [ ] Message logging

### Phase 7: Conversation Management (Week 8)
- [ ] Reply detection
- [ ] Conversation tracking
- [ ] AI reply suggestions
- [ ] Follow-up automation

### Phase 8: Mobile & Notifications (Week 9)
- [ ] Mobile-responsive design
- [ ] Telegram bot
- [ ] Push notifications

---

## Part 9: Cost Estimates

### API Costs (Monthly)

| Service | Usage | Cost |
|---------|-------|------|
| Apollo | ~1000 companies/month | ~$50-100 |
| Claude API | Qualification + messages | ~$20-50 |
| Domain lookup | ~1000 lookups | Free (Google) or ~$50 (Clearbit) |
| Hosting | VPS or Railway | ~$10-20 |

**Estimated total:** $80-220/month

### Cost Optimization
- Company caching saves 70-80% of Apollo calls
- Batch qualification (not per-prospect)
- Only generate messages for approved prospects

---

## Part 10: Open Items / Needs Clarification

1. **Company Main Activity API codes** - Need to capture from MWC filter dropdowns
2. **Area of Responsibility API codes** - Need to capture from MWC filter dropdowns
3. **LinkedIn enrichment method** - Confirm approach (free vs paid)
4. **Hosting preference** - Start local or deploy immediately?
5. **Team size** - How many Avon users will access the system?

---

*Last updated: 2026-02-05*
