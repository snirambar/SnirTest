# Chrome DevTools MCP Server Integration

Analysis of how Chrome DevTools MCP can revolutionize the MWC Barcelona automation project.

---

## What is Chrome DevTools MCP?

Chrome DevTools MCP is an official **Model Context Protocol (MCP) server** from the Chrome DevTools team that allows AI coding assistants to control and inspect a live Chrome browser through natural language commands.

Think of MCP as **"USB-C for AI"** - a standardized protocol that lets AI models connect to external tools without custom integrations.

### Key Benefits

| Feature | Description |
|---------|-------------|
| **Native Chrome Control** | Direct access to Chrome DevTools Protocol (CDP) |
| **Reliable Automation** | Built on Puppeteer with automatic waiting semantics |
| **26 Professional Tools** | Input, navigation, debugging, network, performance, emulation |
| **Session Persistence** | Can connect to your existing authenticated browser session |
| **Real-time Inspection** | DOM, CSS, console, network requests all accessible |

---

## Complete Tool Reference (26 Tools)

### 1. Input Automation (7 tools)

| Tool | Description | MWC Use Case |
|------|-------------|--------------|
| `click` | Click on elements | Click "Send" button, "Create Meeting" |
| `drag` | Drag elements | Scroll attendee list |
| `fill` | Fill input fields | Type messages, form fields |
| `fill_form` | Fill entire forms | Meeting scheduling form |
| `handle_dialog` | Handle browser dialogs | Confirm dialogs |
| `hover` | Hover over elements | Reveal tooltips/menus |
| `upload_file` | Upload files | Profile attachments |

### 2. Navigation (7 tools)

| Tool | Description | MWC Use Case |
|------|-------------|--------------|
| `navigate_page` | Go to URL | Navigate to attendee profiles |
| `new_page` | Open new tab | Open multiple conversations |
| `list_pages` | List open tabs | Track open conversations |
| `select_page` | Switch tabs | Switch between attendees |
| `close_page` | Close tab | Clean up after messaging |
| `navigate_page_history` | Back/forward | Navigate conversation history |
| `wait_for` | Wait for condition | Wait for message to send |

### 3. Debugging (4 tools)

| Tool | Description | MWC Use Case |
|------|-------------|--------------|
| `evaluate_script` | Execute JavaScript | Extract attendee data, trigger actions |
| `list_console_messages` | Read console | Debug errors, monitor SendBird |
| `take_screenshot` | Capture screen | Document sent messages |
| `take_snapshot` | Full page snapshot | Archive attendee profiles |

### 4. Network (2 tools)

| Tool | Description | MWC Use Case |
|------|-------------|--------------|
| `list_network_requests` | Monitor HTTP traffic | Capture API responses |
| `get_network_request` | Request details | Extract JWT tokens, attendee data |

### 5. Performance (3 tools)

| Tool | Description | MWC Use Case |
|------|-------------|--------------|
| `performance_start_trace` | Begin profiling | Monitor page load |
| `performance_stop_trace` | End profiling | Analyze bottlenecks |
| `performance_analyze_insight` | Get insights | Optimize scraping |

### 6. Emulation (3 tools)

| Tool | Description | MWC Use Case |
|------|-------------|--------------|
| `emulate_cpu` | Throttle CPU | Test slow conditions |
| `emulate_network` | Throttle network | Test API timeouts |
| `resize_page` | Change viewport | Mobile view testing |

---

## Installation for Claude Code

```bash
# Add Chrome DevTools MCP server
claude mcp add chrome-devtools --scope user npx chrome-devtools-mcp@latest
```

### Configuration (settings.json)

```json
{
  "mcpServers": {
    "chrome-devtools": {
      "command": "npx",
      "args": ["-y", "chrome-devtools-mcp@latest", "--autoConnect"]
    }
  }
}
```

### Requirements

- Node.js v20.19+ (LTS)
- Chrome 144+ (for auto-connect feature)
- npm

---

## Why This Changes Everything for MWC Automation

### Before: Traditional Approaches

| Approach | Limitations |
|----------|-------------|
| **Direct API** | JWT expires every 4 hours, complex auth |
| **Playwright/Puppeteer** | Separate scripts, cookie management, no AI integration |
| **Browser Extensions** | Limited capabilities, no programmatic control |

### After: Chrome DevTools MCP

| Capability | Improvement |
|------------|-------------|
| **Session Persistence** | Connect to YOUR logged-in Chrome session |
| **No Token Management** | Use existing authentication |
| **Natural Language** | "Send a message to this attendee" |
| **Real-time Debugging** | Inspect network, console, DOM live |
| **Integrated Workflow** | AI handles everything in one flow |

---

## MWC Automation: How MCP Transforms Each Task

### 1. Attendee Scraping

**Old Way:**
```python
# Complex: Extract JWT, make API calls, handle pagination, manage tokens
jwt_token = extract_jwt_from_browser()  # Manual extraction
response = requests.post(api_url, headers={"Jemex-Authorization": jwt_token})
```

**New Way with MCP:**
```
Claude: "Navigate to the MWC attendee search page, filter by United States,
and extract all attendee data from the API responses"

MCP Tools Used:
- navigate_page → Go to search page
- fill → Apply country filter
- list_network_requests → Capture API responses with attendee data
- evaluate_script → Parse and extract data
```

**Benefits:**
- No JWT extraction needed (uses browser session)
- Automatic pagination handling
- Real-time data extraction from network requests

### 2. Sending Messages

**Old Way:**
```python
# Complex: Manage cookies, WebSocket, handle SendBird
async with playwright.chromium.launch() as browser:
    context = await browser.new_context()
    await context.add_cookies(exported_cookies)  # Cookie management
    # ... complex automation
```

**New Way with MCP:**
```
Claude: "Go to messaging with attendee UUID abc-123, type 'Hello, looking
forward to MWC!' and send it"

MCP Tools Used:
- navigate_page → Go to messaging URL
- wait_for → Wait for input to be ready
- fill → Type the message
- click → Click send button
- take_screenshot → Verify message sent
```

**Benefits:**
- Uses your existing logged-in session
- Natural language commands
- Automatic waiting for page loads
- Built-in verification via screenshots

### 3. Scheduling Meetings

**Old Way:**
```python
# Complex: Navigate modals, handle date pickers, fill forms
await page.click('text=Create Meeting')
await page.wait_for_selector('text=New Meeting Request')
await page.click('button:has-text("Select date")')
# ... complex date picker navigation
```

**New Way with MCP:**
```
Claude: "Schedule a meeting with attendee UUID xyz-789 for March 3rd,
10:00-10:30 AM, subject 'Quick intro', location 'Hall 2 Stand 123'"

MCP Tools Used:
- navigate_page → Go to messaging page
- click → Open meeting modal
- fill_form → Fill all meeting details at once
- click → Save meeting
- take_screenshot → Confirm meeting created
```

**Benefits:**
- `fill_form` handles entire form in one call
- AI understands context (dates, times, locations)
- Screenshot verification

### 4. Monitoring New Attendees

**Old Way:**
- Cron job running every X minutes
- Token refresh logic
- Database comparison

**New Way with MCP:**
```
Claude: "Check the MWC attendee page for US attendees, compare with our
database, and notify me of any new registrations"

MCP Tools Used:
- navigate_page → Go to filtered search
- list_network_requests → Capture API response
- evaluate_script → Compare with stored UUIDs
```

---

## Architecture: MCP-Powered MWC Automation

```
┌─────────────────────────────────────────────────────────────────┐
│                        Claude Code                               │
│  (Natural Language Interface)                                    │
├─────────────────────────────────────────────────────────────────┤
│                    Chrome DevTools MCP                           │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐            │
│  │  Input   │ │Navigation│ │ Debugging│ │ Network  │            │
│  │  Tools   │ │  Tools   │ │  Tools   │ │  Tools   │            │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘            │
├─────────────────────────────────────────────────────────────────┤
│                   Chrome Browser (Your Session)                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ MWC Barcelona Portal (Authenticated)                        ││
│  │  - Attendee Search                                          ││
│  │  - Messaging (SendBird)                                     ││
│  │  - Meeting Scheduling                                       ││
│  └─────────────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────────────┤
│                      Local Storage                               │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐                         │
│  │ SQLite   │ │  Logs    │ │Screenshots│                        │
│  │ Database │ │          │ │          │                         │
│  └──────────┘ └──────────┘ └──────────┘                         │
└─────────────────────────────────────────────────────────────────┘
```

---

## Auto-Connect Feature (Chrome 144+)

The killer feature for MWC automation:

1. **Enable Remote Debugging:**
   - Navigate to `chrome://inspect/#remote-debugging`
   - Enable remote debugging

2. **MCP Auto-Connects:**
   - When MCP server starts with `--autoConnect`
   - Chrome shows permission dialog
   - After approval, AI controls your authenticated session

3. **Security:**
   - Each connection requires explicit user approval
   - Uses your existing MWC session/cookies
   - No token extraction needed

---

## Comparison: Old vs New Approach

| Aspect | Playwright/API Approach | Chrome MCP Approach |
|--------|------------------------|---------------------|
| **Authentication** | Extract JWT, manage cookies | Uses existing session |
| **Token Expiry** | Handle 4-hour refresh | No token management |
| **Code Complexity** | 100+ lines Python | Natural language |
| **Debugging** | Print statements, logs | Real-time DevTools |
| **Verification** | Parse responses | Screenshots + DOM |
| **Maintenance** | Update selectors | AI adapts |
| **Learning Curve** | Playwright/Puppeteer APIs | Plain English |

---

## Limitations & Considerations

| Limitation | Mitigation |
|------------|------------|
| Requires Chrome 144+ | Update browser |
| User must approve connection | One-time approval per session |
| Browser must stay open | Use dedicated Chrome profile |
| Rate limiting still applies | Add delays between actions |
| Screenshots use storage | Clean up periodically |

---

## Next Steps

1. **Install Chrome DevTools MCP** in Claude Code
2. **Enable remote debugging** in Chrome 144+
3. **Test basic navigation** to MWC portal
4. **Implement attendee scraping** with network capture
5. **Build messaging workflow** with natural language
6. **Add meeting scheduling** with form filling

---

## Sources

- [Chrome DevTools MCP - Official Blog](https://developer.chrome.com/blog/chrome-devtools-mcp)
- [GitHub - ChromeDevTools/chrome-devtools-mcp](https://github.com/ChromeDevTools/chrome-devtools-mcp)
- [Chrome DevTools MCP Server Guide - DataCamp](https://www.datacamp.com/tutorial/chrome-devtools-mcp)
- [npm - chrome-devtools-mcp](https://www.npmjs.com/package/chrome-devtools-mcp)

---

*Last updated: 2026-02-05*
