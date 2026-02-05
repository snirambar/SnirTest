"""
Database operations for MWC Barcelona Scraper
"""

import sqlite3
import json
from datetime import datetime
from pathlib import Path
from typing import Optional, List, Dict, Any

from .config import DATABASE_PATH


def get_db_path() -> Path:
    """Get the database path, creating parent directories if needed."""
    db_path = Path(DATABASE_PATH)
    db_path.parent.mkdir(parents=True, exist_ok=True)
    return db_path


def get_connection() -> sqlite3.Connection:
    """Get a database connection with row factory."""
    conn = sqlite3.connect(get_db_path())
    conn.row_factory = sqlite3.Row
    return conn


def init_database():
    """Initialize the database with all required tables."""
    conn = get_connection()
    cursor = conn.cursor()

    # Companies table (cached enrichment)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS companies (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            name_normalized TEXT,
            domain TEXT,
            description TEXT,
            linkedin_url TEXT,
            website TEXT,
            hq_location TEXT,
            employee_count INTEGER,
            employee_range TEXT,
            industry TEXT,
            enriched_at DATETIME,
            enrichment_source TEXT,
            raw_apollo_data TEXT,

            -- Qualification (user-defined scores)
            company_score INTEGER,
            company_notes TEXT,
            qualification_prompt_version TEXT,
            qualified_at DATETIME,

            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

            UNIQUE(name_normalized)
        )
    """)

    # Prospects table (MWC attendees)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS prospects (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            uuid TEXT UNIQUE NOT NULL,
            mwc_profile_url TEXT,

            -- Basic data from MWC scraping
            full_name TEXT,
            first_name TEXT,
            last_name TEXT,
            job_title TEXT,
            company_name TEXT,
            company_name_normalized TEXT,
            event_badges TEXT,
            bucket TEXT,
            country TEXT,
            country_code TEXT,
            profile_image_url TEXT,

            -- Link to company
            company_id INTEGER REFERENCES companies(id),

            -- LinkedIn enrichment
            linkedin_url TEXT,
            linkedin_headline TEXT,
            linkedin_about TEXT,
            linkedin_experience TEXT,
            linkedin_enriched_at DATETIME,

            -- Qualification (user-defined scores)
            prospect_score INTEGER,
            prospect_notes TEXT,
            qualification_prompt_version TEXT,
            qualified_at DATETIME,

            -- Status
            status TEXT DEFAULT 'new',

            first_seen_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # Messages table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            prospect_id INTEGER REFERENCES prospects(id),

            message_type TEXT,
            draft_content TEXT,
            final_content TEXT,
            user_context TEXT,

            status TEXT DEFAULT 'draft',

            drafted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            approved_at DATETIME,
            sent_at DATETIME,
            approved_by INTEGER,

            follow_up_of INTEGER REFERENCES messages(id),
            scheduled_send_at DATETIME,
            auto_send BOOLEAN DEFAULT FALSE
        )
    """)

    # Conversations table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS conversations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            prospect_id INTEGER REFERENCES prospects(id),
            mwc_conversation_url TEXT,

            status TEXT DEFAULT 'active',

            meeting_scheduled BOOLEAN DEFAULT FALSE,
            meeting_datetime DATETIME,
            meeting_location TEXT,

            last_message_at DATETIME,
            last_reply_at DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # Replies table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS replies (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            conversation_id INTEGER REFERENCES conversations(id),
            prospect_id INTEGER REFERENCES prospects(id),

            content TEXT,
            detected_at DATETIME DEFAULT CURRENT_TIMESTAMP,

            sentiment TEXT,
            intent TEXT,
            suggested_reply TEXT,

            responded BOOLEAN DEFAULT FALSE,
            response_message_id INTEGER REFERENCES messages(id)
        )
    """)

    # Scrape runs table (track scraping history)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS scrape_runs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            bucket TEXT,
            countries TEXT,
            started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            completed_at DATETIME,
            total_found INTEGER DEFAULT 0,
            new_prospects INTEGER DEFAULT 0,
            existing_prospects INTEGER DEFAULT 0,
            errors TEXT,
            status TEXT DEFAULT 'running'
        )
    """)

    # Qualification prompts table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS qualification_prompts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            type TEXT NOT NULL,
            bucket TEXT,
            prompt_text TEXT NOT NULL,
            version TEXT,
            is_active BOOLEAN DEFAULT TRUE,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # Create indexes for performance
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_prospects_company ON prospects(company_name_normalized)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_prospects_status ON prospects(status)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_prospects_bucket ON prospects(bucket)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_prospects_uuid ON prospects(uuid)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_companies_name ON companies(name_normalized)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_messages_status ON messages(status)")

    conn.commit()
    conn.close()

    print(f"Database initialized at: {get_db_path()}")


def normalize_company_name(name: str) -> str:
    """Normalize company name for deduplication."""
    if not name:
        return ""
    # Lowercase, strip whitespace, remove common suffixes
    normalized = name.lower().strip()
    # Remove common company suffixes
    suffixes = [" inc", " inc.", " llc", " ltd", " ltd.", " gmbh", " ag",
                " corp", " corp.", " co.", " company", " limited"]
    for suffix in suffixes:
        if normalized.endswith(suffix):
            normalized = normalized[:-len(suffix)]
    return normalized.strip()


def prospect_exists(uuid: str) -> bool:
    """Check if a prospect with this UUID already exists."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT 1 FROM prospects WHERE uuid = ?", (uuid,))
    exists = cursor.fetchone() is not None
    conn.close()
    return exists


def get_prospect_by_uuid(uuid: str) -> Optional[Dict[str, Any]]:
    """Get a prospect by UUID."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM prospects WHERE uuid = ?", (uuid,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None


def insert_prospect(prospect_data: Dict[str, Any]) -> int:
    """Insert a new prospect and return the ID."""
    conn = get_connection()
    cursor = conn.cursor()

    # Normalize company name
    company_name = prospect_data.get("company_name", "")
    company_name_normalized = normalize_company_name(company_name)

    cursor.execute("""
        INSERT INTO prospects (
            uuid, mwc_profile_url, full_name, first_name, last_name,
            job_title, company_name, company_name_normalized, event_badges,
            bucket, country, country_code, profile_image_url, status,
            first_seen_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', ?, ?)
    """, (
        prospect_data.get("uuid"),
        prospect_data.get("mwc_profile_url"),
        prospect_data.get("full_name"),
        prospect_data.get("first_name"),
        prospect_data.get("last_name"),
        prospect_data.get("job_title"),
        company_name,
        company_name_normalized,
        json.dumps(prospect_data.get("event_badges", [])),
        prospect_data.get("bucket"),
        prospect_data.get("country"),
        prospect_data.get("country_code"),
        prospect_data.get("profile_image_url"),
        datetime.now().isoformat(),
        datetime.now().isoformat(),
    ))

    prospect_id = cursor.lastrowid
    conn.commit()
    conn.close()

    return prospect_id


def get_or_create_company(company_name: str) -> int:
    """Get existing company ID or create new one."""
    if not company_name:
        return None

    normalized = normalize_company_name(company_name)
    conn = get_connection()
    cursor = conn.cursor()

    # Try to find existing company
    cursor.execute(
        "SELECT id FROM companies WHERE name_normalized = ?",
        (normalized,)
    )
    row = cursor.fetchone()

    if row:
        company_id = row["id"]
    else:
        # Create new company
        cursor.execute("""
            INSERT INTO companies (name, name_normalized, created_at, updated_at)
            VALUES (?, ?, ?, ?)
        """, (company_name, normalized, datetime.now().isoformat(), datetime.now().isoformat()))
        company_id = cursor.lastrowid

    conn.commit()
    conn.close()

    return company_id


def link_prospect_to_company(prospect_id: int, company_id: int):
    """Link a prospect to a company."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "UPDATE prospects SET company_id = ?, updated_at = ? WHERE id = ?",
        (company_id, datetime.now().isoformat(), prospect_id)
    )
    conn.commit()
    conn.close()


def get_company_by_name(company_name: str) -> Optional[Dict[str, Any]]:
    """Get a company by name (normalized lookup)."""
    normalized = normalize_company_name(company_name)
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM companies WHERE name_normalized = ?", (normalized,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None


def company_needs_enrichment(company_name: str) -> bool:
    """Check if a company needs enrichment (not yet enriched)."""
    company = get_company_by_name(company_name)
    if not company:
        return True
    return company.get("enriched_at") is None


def update_company_enrichment(company_id: int, enrichment_data: Dict[str, Any]):
    """Update a company with enrichment data."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        UPDATE companies SET
            domain = ?,
            description = ?,
            linkedin_url = ?,
            website = ?,
            hq_location = ?,
            employee_count = ?,
            employee_range = ?,
            industry = ?,
            enriched_at = ?,
            enrichment_source = ?,
            raw_apollo_data = ?,
            updated_at = ?
        WHERE id = ?
    """, (
        enrichment_data.get("domain"),
        enrichment_data.get("description"),
        enrichment_data.get("linkedin_url"),
        enrichment_data.get("website"),
        enrichment_data.get("hq_location"),
        enrichment_data.get("employee_count"),
        enrichment_data.get("employee_range"),
        enrichment_data.get("industry"),
        datetime.now().isoformat(),
        enrichment_data.get("enrichment_source", "apollo"),
        json.dumps(enrichment_data.get("raw_data", {})),
        datetime.now().isoformat(),
        company_id,
    ))
    conn.commit()
    conn.close()


def start_scrape_run(bucket: str, countries: List[str]) -> int:
    """Start a new scrape run and return the ID."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO scrape_runs (bucket, countries, started_at, status)
        VALUES (?, ?, ?, 'running')
    """, (bucket, json.dumps(countries), datetime.now().isoformat()))
    run_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return run_id


def complete_scrape_run(run_id: int, total: int, new: int, existing: int, errors: str = None):
    """Mark a scrape run as complete."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        UPDATE scrape_runs SET
            completed_at = ?,
            total_found = ?,
            new_prospects = ?,
            existing_prospects = ?,
            errors = ?,
            status = 'completed'
        WHERE id = ?
    """, (datetime.now().isoformat(), total, new, existing, errors, run_id))
    conn.commit()
    conn.close()


def get_prospect_stats() -> Dict[str, Any]:
    """Get statistics about prospects in the database."""
    conn = get_connection()
    cursor = conn.cursor()

    stats = {}

    # Total prospects
    cursor.execute("SELECT COUNT(*) as count FROM prospects")
    stats["total_prospects"] = cursor.fetchone()["count"]

    # By bucket
    cursor.execute("""
        SELECT bucket, COUNT(*) as count
        FROM prospects
        GROUP BY bucket
    """)
    stats["by_bucket"] = {row["bucket"]: row["count"] for row in cursor.fetchall()}

    # By status
    cursor.execute("""
        SELECT status, COUNT(*) as count
        FROM prospects
        GROUP BY status
    """)
    stats["by_status"] = {row["status"]: row["count"] for row in cursor.fetchall()}

    # Total companies
    cursor.execute("SELECT COUNT(*) as count FROM companies")
    stats["total_companies"] = cursor.fetchone()["count"]

    # Companies needing enrichment
    cursor.execute("SELECT COUNT(*) as count FROM companies WHERE enriched_at IS NULL")
    stats["companies_needing_enrichment"] = cursor.fetchone()["count"]

    conn.close()
    return stats


def get_new_prospects_since(since_datetime: str, bucket: str = None) -> List[Dict[str, Any]]:
    """Get prospects added since a specific datetime."""
    conn = get_connection()
    cursor = conn.cursor()

    query = "SELECT * FROM prospects WHERE first_seen_at > ?"
    params = [since_datetime]

    if bucket:
        query += " AND bucket = ?"
        params.append(bucket)

    query += " ORDER BY first_seen_at DESC"

    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()

    return [dict(row) for row in rows]
