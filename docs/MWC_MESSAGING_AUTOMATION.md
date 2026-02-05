# MWC Barcelona Messaging & Meeting Automation

Technical specifications for automating messaging and meeting scheduling on the MWC Barcelona platform.

---

## Executive Summary

This document provides comprehensive technical specifications for automating messaging and meeting scheduling on the MWC Barcelona platform. Three implementation approaches are covered:

1. **Browser Automation via Claude's Agentic Browser** (Recommended)
2. **Headless Browser Automation** (Puppeteer/Playwright)
3. **Direct API Integration** (Advanced)

---

## Part 1: Platform Architecture

### Backend Services

| Service | Domain | Purpose |
|---------|--------|---------|
| BonaCMS API | `bonacms-api.firabarcelona.com` | User profiles, attendee data, meetings |
| SendBird | `api-5e56c77a-c064-4676-876f-4af2e0f578c6.sendbird.com` | Real-time messaging (WebSocket) |
| Twilio SDK | `sdk.twilio.com` | Video/voice calling support |
| Uploadcare | `uploadcare.mwcglobalprofile.com` | Profile image storage |
| Sentry | `o4505635802972160.ingest.us.sentry.io` | Error tracking |

### User Identification

Users are identified by UUID format: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`

**Test Users (Avon AI Company):**

| User | UUID | Role |
|------|------|------|
| Snir Ambar | `a0d0c3a9-5bc2-4d6d-a0b0-59deb471bd6e` | Head of Sales (Sender) |
| Ethan Gargano | `a0f3810e-2caf-4c19-b601-9414a407732c` | Sales (Recipient) |

---

## Part 2: URL Structure

### Profile URLs

```
https://www.mwcbarcelona.com/mymwc/details/{user-uuid}
```

### Messaging URLs

```
https://www.mwcbarcelona.com/mymwc/messaging?conversation={user-uuid}
```

### Key Navigation URLs

| Page | URL |
|------|-----|
| MyMWC Home | `/mymwc/home` |
| Profile | `/mymwc/profile` |
| My Agenda | `/mymwc/agenda` |
| Favourites | `/mymwc/favourites` |
| Attendees | `/mymwc/contacts` |
| Messages | `/mymwc/messaging` |
| Meetings | `/mymwc/meetings` |

---

## Part 3: Messaging System

### Key Finding: Message Input Behavior

> **IMPORTANT**: The message input is a single-line text input where:
> - **Enter key = Send message** (NOT newline)
> - Multi-line messages are sent as **separate messages per line**
> - No native support for multi-line content in a single message

### HTML Element Selectors

```javascript
// Message Input
const messageInput = document.querySelector('input[placeholder="Type a message..."]');
// CSS: input.focus\\:outline-hidden.bg-cream\\!.w-full

// Send Button (arrow icon)
const sendButton = document.querySelector('form.NewMessage button[type="submit"]');

// Form Container
const form = document.querySelector('form.NewMessage');
```

### SendBird Integration Details

**Application ID**: `5e56c77a-c064-4676-876f-4af2e0f578c6`

**Channel Format**:
```
sendbird_group_channel_{channel_id}_{hash}
```

Example: `sendbird_group_channel_778413603_993a9bebe72883dfaad5001003b35a721bc17c56`

**API Endpoints**:
```
Base URL: https://api-5e56c77a-c064-4676-876f-4af2e0f578c6.sendbird.com/v3/

# List user's group channels
GET /users/{user_uuid}/my_group_channels?token=&limit=100&order=latest_last_message...

# Create/get group channel
POST /group_channels

# Get messages in a channel
GET /group_channels/{channel_url}/messages?is_sdk=true&prev_limit=100...
```

---

## Part 4: Implementation Approaches

### Approach A: Claude Agentic Browser (Recommended)

**Pros:**
- Handles authentication automatically (uses existing session)
- Visual feedback for debugging
- Can handle dynamic content and JavaScript
- Works with current MWC Barcelona session

**Implementation for Claude Code:**

```python
"""
MWC Barcelona Messaging Automation - Claude Agentic Browser Approach
For use with Claude Code or Claude Desktop with browser extension
"""

def send_mwc_message_browser(profile_url: str, message: str) -> dict:
    """
    Send a message via browser automation.

    Args:
        profile_url: Full URL to profile (/mymwc/details/{uuid}) or
                     messaging (/mymwc/messaging?conversation={uuid})
        message: Message text to send (newlines will send as separate messages)

    Returns:
        dict with status and details
    """
    import re

    # Step 1: Extract UUID
    uuid_pattern = r'([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})'
    match = re.search(uuid_pattern, profile_url)
    if not match:
        return {"success": False, "error": "Could not extract UUID from URL"}

    user_uuid = match.group(1)

    # Step 2: Construct messaging URL
    messaging_url = f"https://www.mwcbarcelona.com/mymwc/messaging?conversation={user_uuid}"

    # Step 3: Navigation instructions for Claude Browser
    instructions = f"""
    BROWSER AUTOMATION STEPS:

    1. Navigate to: {messaging_url}

    2. Wait for page load (look for "Type a message..." placeholder)

    3. Find message input:
       - Selector: input[placeholder="Type a message..."]
       - Or use find tool: "Type a message input field"

    4. Enter message text:
       - Use form_input or type action
       - NOTE: If message contains newlines, each line will be sent separately

    5. Send message:
       - Click the blue arrow button (submit button in form.NewMessage)
       - Or press Enter key

    6. Verify: Message appears as blue bubble on right side of conversation
    """

    return {
        "success": True,
        "messaging_url": messaging_url,
        "user_uuid": user_uuid,
        "instructions": instructions,
        "message": message,
        "note": "Newlines in message will result in separate messages being sent"
    }


def create_mwc_meeting_browser(profile_url: str, meeting_details: dict) -> dict:
    """
    Schedule a meeting via browser automation.

    Args:
        profile_url: Profile URL of the invitee
        meeting_details: dict with keys:
            - date: "YYYY-MM-DD" format
            - start_time: "HH:MM" format (24hr)
            - end_time: "HH:MM" format (24hr)
            - subject: Meeting subject text
            - location: Meeting location text
            - description: Optional meeting description

    Returns:
        dict with status and instructions
    """
    import re

    uuid_pattern = r'([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})'
    match = re.search(uuid_pattern, profile_url)
    if not match:
        return {"success": False, "error": "Could not extract UUID from URL"}

    user_uuid = match.group(1)
    messaging_url = f"https://www.mwcbarcelona.com/mymwc/messaging?conversation={user_uuid}"

    instructions = f"""
    MEETING SCHEDULING STEPS:

    1. Navigate to: {messaging_url}

    2. Click "Create Meeting" button (calendar+ icon in top-right area)
       - Selector: find "Create Meeting" button/icon

    3. Wait for "New Meeting Request" modal to appear

    4. Fill form fields:
       a. Date: Click "Select date" dropdown, choose {meeting_details.get('date', 'required')}
       b. Start Time: Set to {meeting_details.get('start_time', '12:00')}
          - Selector: input[type="time"] for Start Time
       c. End Time: Set to {meeting_details.get('end_time', '13:00')}
          - Selector: input[type="time"] for End Time
       d. Meeting Subject:
          - Selector: input[placeholder="Enter your meeting subject"]
          - Value: {meeting_details.get('subject', '')}
       e. Meeting Location:
          - Selector: input[placeholder="Enter your meeting location"]
          - Value: {meeting_details.get('location', '')}
       f. Meeting Description (optional):
          - Selector: textbox[placeholder="Enter your meeting description"]
          - Value: {meeting_details.get('description', '')}

    5. Click "Save" button to create meeting

    6. Verify: Meeting confirmation or calendar update

    NOTE: Times are in conference timezone (Barcelona/CET)
    """

    return {
        "success": True,
        "user_uuid": user_uuid,
        "messaging_url": messaging_url,
        "instructions": instructions,
        "meeting_details": meeting_details
    }
```

---

### Approach B: Headless Browser (Puppeteer/Playwright)

**Pros:**
- Can run in background/server
- Scriptable and schedulable
- Good for batch operations

**Cons:**
- Requires authentication handling (cookies/session)
- More complex setup

**Implementation (Playwright/Python):**

```python
"""
MWC Barcelona Messaging - Headless Browser Approach
Requires: pip install playwright
"""

from playwright.async_api import async_playwright
import asyncio
import re

class MWCBarcelonaAutomation:
    def __init__(self, session_cookies: list):
        """
        Initialize with authenticated session cookies.

        Args:
            session_cookies: List of cookie dicts from authenticated browser session
                            Export from browser devtools or previous session
        """
        self.cookies = session_cookies
        self.base_url = "https://www.mwcbarcelona.com"

    async def send_message(self, profile_url: str, message: str):
        """Send a message to a user."""

        # Extract UUID
        uuid_match = re.search(r'([a-f0-9-]{36})', profile_url)
        if not uuid_match:
            raise ValueError("Invalid profile URL")

        user_uuid = uuid_match.group(1)
        messaging_url = f"{self.base_url}/mymwc/messaging?conversation={user_uuid}"

        async with async_playwright() as p:
            # Launch browser (headless)
            browser = await p.chromium.launch(headless=True)
            context = await browser.new_context()

            # Set cookies for authentication
            await context.add_cookies(self.cookies)

            page = await context.new_page()
            await page.goto(messaging_url)

            # Wait for message input
            await page.wait_for_selector('input[placeholder="Type a message..."]')

            # Handle multi-line messages
            lines = message.split('\n')
            for line in lines:
                if line.strip():  # Skip empty lines
                    # Type message
                    await page.fill('input[placeholder="Type a message..."]', line)
                    # Click send button
                    await page.click('form.NewMessage button[type="submit"]')
                    # Wait for message to send
                    await page.wait_for_timeout(500)

            await browser.close()
            return {"success": True, "messages_sent": len([l for l in lines if l.strip()])}

    async def create_meeting(self, profile_url: str, meeting_details: dict):
        """Schedule a meeting with a user."""

        uuid_match = re.search(r'([a-f0-9-]{36})', profile_url)
        if not uuid_match:
            raise ValueError("Invalid profile URL")

        user_uuid = uuid_match.group(1)
        messaging_url = f"{self.base_url}/mymwc/messaging?conversation={user_uuid}"

        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            context = await browser.new_context()
            await context.add_cookies(self.cookies)

            page = await context.new_page()
            await page.goto(messaging_url)

            # Click Create Meeting button
            await page.click('text=Create Meeting')

            # Wait for modal
            await page.wait_for_selector('text=New Meeting Request')

            # Fill form
            if meeting_details.get('date'):
                await page.click('button:has-text("Select date")')
                # Date picker interaction (depends on implementation)
                # May need to navigate calendar UI

            if meeting_details.get('start_time'):
                await page.fill('input[type="time"]:first-of-type', meeting_details['start_time'])

            if meeting_details.get('end_time'):
                await page.fill('input[type="time"]:last-of-type', meeting_details['end_time'])

            if meeting_details.get('subject'):
                await page.fill('input[placeholder="Enter your meeting subject"]', meeting_details['subject'])

            if meeting_details.get('location'):
                await page.fill('input[placeholder="Enter your meeting location"]', meeting_details['location'])

            if meeting_details.get('description'):
                await page.fill('textarea[placeholder="Enter your meeting description"]', meeting_details['description'])

            # Submit
            await page.click('button:has-text("Save")')

            await page.wait_for_timeout(2000)
            await browser.close()

            return {"success": True}


# Usage example
async def main():
    # You need to export cookies from an authenticated browser session
    cookies = [
        {"name": "session_id", "value": "...", "domain": ".mwcbarcelona.com"},
        # ... other session cookies
    ]

    automation = MWCBarcelonaAutomation(cookies)

    # Send message
    result = await automation.send_message(
        "https://www.mwcbarcelona.com/mymwc/details/a0f3810e-2caf-4c19-b601-9414a407732c",
        "Hi Ethan!\n\nLooking forward to meeting at MWC!"
    )
    print(result)


if __name__ == "__main__":
    asyncio.run(main())
```

---

### Approach C: Direct API Integration (Advanced)

**Status**: Partially Feasible

The messaging uses SendBird, which requires:
- SendBird SDK initialization with App ID
- User authentication token
- WebSocket connection for real-time messaging

**SendBird API Details:**

```javascript
// SendBird Application ID (from network analysis)
const SENDBIRD_APP_ID = '5e56c77a-c064-4676-876f-4af2e0f578c6';

// API Base URL
const SENDBIRD_API = `https://api-${SENDBIRD_APP_ID}.sendbird.com/v3`;

// Endpoints discovered:
// GET  /users/{user_id}/my_group_channels - List user's conversations
// POST /group_channels - Create/get group channel
// GET  /group_channels/{channel_url}/messages - Get messages
// POST /group_channels/{channel_url}/messages - Send message (requires SDK/WebSocket)
```

> **Challenge**: SendBird typically requires WebSocket connection for sending messages, not simple REST API calls. This makes direct API integration complex without the SendBird SDK.

**BonaCMS API (Meetings/Profile):**

```javascript
// Base URL for attendee/profile data
const BONACMS_API = 'https://bonacms-api.firabarcelona.com';

// Endpoints discovered:
// GET  /attendee/v1/gsmawebteam/{event_id}
// POST /profile/v1/gsmawebteam/{event_id}/userIds
// GET  /profile/v1/gsmawebteam/{event_id}
// GET  /profile/v1/gsmawebteam/{event_id}/relationAttributes?type=profile
```

---

## Part 5: Meeting Scheduling Form

### Form Fields

| Field | Type | Selector | Required |
|-------|------|----------|----------|
| Meeting Type | Static | "In-Person" (currently only option) | Auto |
| Date | Date Picker | `button:has-text("Select date")` | Yes |
| Start Time | Time Input | `input[type="time"]:first-of-type` | Yes |
| End Time | Time Input | `input[type="time"]:last-of-type` | Yes |
| Subject | Text | `input[placeholder="Enter your meeting subject"]` | Yes |
| Location | Text | `input[placeholder="Enter your meeting location"]` | Yes |
| Description | Textarea | `textarea[placeholder="Enter your meeting description"]` | No |

> **Note**: All times are in conference timezone (Barcelona/CET)

---

## Part 6: Notifications & Response Detection

### For Browser-Based Automation (Polling Approach)

```python
async def check_new_messages(self, conversation_uuid: str, last_check_timestamp: int):
    """
    Poll for new messages in a conversation.

    Implementation:
    1. Navigate to messaging URL
    2. Read the message list
    3. Compare timestamps to find new messages
    4. Return new messages
    """
    # Navigate to conversation
    messaging_url = f"{self.base_url}/mymwc/messaging?conversation={conversation_uuid}"
    await page.goto(messaging_url)

    # Get message elements
    messages = await page.query_selector_all('li[class*="listitem"]')  # Adjust selector

    new_messages = []
    for msg in messages:
        # Check timestamp (would need to parse "X minutes ago" format)
        # Or use SendBird API for precise timestamps
        pass

    return new_messages
```

### For Direct API Integration (SendBird)

SendBird supports **webhooks** and **real-time events**. If you have access to the SendBird dashboard:

1. **Webhooks**: Configure webhook URL to receive message events
2. **WebSocket**: Listen to channel events for real-time updates

---

## Part 7: Complete Claude Code Instructions

### For Single Message Sending

```
TASK: Send message to MWC Barcelona profile

INPUT:
- Profile URL: {url}
- Message: {message_text}

STEPS:
1. Extract UUID from URL using regex: ([a-f0-9-]{36})
2. Navigate to: https://www.mwcbarcelona.com/mymwc/messaging?conversation={uuid}
3. Wait for input with placeholder "Type a message..."
4. Click on input field
5. Type message (note: Enter key sends, creates separate messages per line)
6. Click blue arrow button OR press Enter to send
7. Verify: Message appears as blue bubble on right side

SUCCESS CRITERIA:
- Message text visible in blue bubble
- Timestamp shows "a few seconds ago"
```

### For Meeting Scheduling

```
TASK: Schedule meeting with MWC Barcelona attendee

INPUT:
- Profile URL: {url}
- Date: {date}
- Start Time: {start_time}
- End Time: {end_time}
- Subject: {subject}
- Location: {location}
- Description: {description} (optional)

STEPS:
1. Extract UUID and navigate to messaging page
2. Find and click "Create Meeting" (calendar+ icon)
3. Wait for "New Meeting Request" modal
4. Fill form fields:
   - Click date picker, select date
   - Set start time (time input)
   - Set end time (time input)
   - Enter subject
   - Enter location
   - Enter description (if provided)
5. Click "Save" button
6. Verify: Modal closes, meeting created

NOTE: Times are in Barcelona/CET timezone
```

---

## Part 8: Known Limitations & Issues

| Issue | Description |
|-------|-------------|
| **Multi-line Messages** | Not supported in single message. Enter key sends message. |
| **"undefined undefined" Bug** | When creating meetings from messaging page, invitee name sometimes shows as "undefined undefined" instead of actual name. |
| **Session Authentication** | All automation requires valid authenticated session (cookies). |
| **SendBird Direct API** | Requires WebSocket, not simple REST - makes direct API integration complex. |
| **Time Zones** | Meeting times are in conference timezone (Barcelona/CET), not user's local timezone. |

---

## Part 9: Recommended Implementation Path

### Phase 1: Basic Messaging ✅ DONE
- Browser automation approach
- Single message sending
- Profile URL to messaging flow

### Phase 2: Meeting Scheduling (Documented)
- Form field mapping complete
- Modal interaction flow documented
- Ready for implementation

### Phase 3: Notifications (Future)
Options:
1. **Polling**: Periodically check messages page (simple but inefficient)
2. **SendBird WebSocket**: Real-time events (complex, requires SDK)
3. **Email Notifications**: If MWC platform sends email notifications, monitor inbox

---

## Test Data Reference

```python
TEST_USERS = {
    "snir": {
        "uuid": "a0d0c3a9-5bc2-4d6d-a0b0-59deb471bd6e",
        "name": "Snir Ambar",
        "title": "Head of Sales",
        "company": "Avon AI",
        "profile_url": "https://www.mwcbarcelona.com/mymwc/details/a0d0c3a9-5bc2-4d6d-a0b0-59deb471bd6e"
    },
    "ethan": {
        "uuid": "a0f3810e-2caf-4c19-b601-9414a407732c",
        "name": "Ethan Gargano",
        "title": "Sales",
        "company": "Avon AI",
        "location": "New York",
        "profile_url": "https://www.mwcbarcelona.com/mymwc/details/a0f3810e-2caf-4c19-b601-9414a407732c"
    }
}

SENDBIRD_CONFIG = {
    "app_id": "5e56c77a-c064-4676-876f-4af2e0f578c6",
    "channel_url": "sendbird_group_channel_778413603_993a9bebe72883dfaad5001003b35a721bc17c56"
}
```

---

## Quick Reference: CSS Selectors

| Element | Selector |
|---------|----------|
| Message Input | `input[placeholder="Type a message..."]` |
| Send Button | `form.NewMessage button[type="submit"]` |
| Create Meeting Button | `button:has-text("Create Meeting")` or calendar icon |
| Meeting Modal | `text=New Meeting Request` |
| Date Picker | `button:has-text("Select date")` |
| Start Time | `input[type="time"]:first-of-type` |
| End Time | `input[type="time"]:last-of-type` |
| Subject Input | `input[placeholder="Enter your meeting subject"]` |
| Location Input | `input[placeholder="Enter your meeting location"]` |
| Description | `textarea[placeholder="Enter your meeting description"]` |
| Save Button | `button:has-text("Save")` |

---

*Last updated: 2026-02-05*
