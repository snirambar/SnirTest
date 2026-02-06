"""
CLI for MWC Barcelona Attendee Scraper

Usage:
    python -m mwc_scraper.cli --help
    python -m mwc_scraper.cli test --token YOUR_JWT_TOKEN
    python -m mwc_scraper.cli scrape --token YOUR_JWT_TOKEN --bucket partners
    python -m mwc_scraper.cli scrape-all --token YOUR_JWT_TOKEN
    python -m mwc_scraper.cli stats
"""

import argparse
import sys
import os
from pathlib import Path

# Add src to path if running directly
src_path = Path(__file__).parent.parent.parent
if str(src_path) not in sys.path:
    sys.path.insert(0, str(src_path))

import csv
import sqlite3
from datetime import datetime

from mwc_scraper.scraper import MWCScraper, quick_test
from mwc_scraper.database import init_database, get_prospect_stats, get_db_path
from mwc_scraper.config import BUCKETS, COUNTRIES, COUNTRY_GROUPS


def cmd_test(args):
    """Test API connection and do a quick scrape."""
    if not args.token:
        print("Error: --token is required")
        sys.exit(1)

    success = quick_test(args.token)
    sys.exit(0 if success else 1)


def cmd_scrape(args):
    """Scrape a single bucket."""
    if not args.token:
        print("Error: --token is required")
        sys.exit(1)

    if args.bucket not in BUCKETS:
        print(f"Error: Unknown bucket '{args.bucket}'")
        print(f"Valid buckets: {list(BUCKETS.keys())}")
        sys.exit(1)

    scraper = MWCScraper(args.token)

    # Parse countries
    countries = None
    if args.countries:
        countries = _parse_countries(args.countries)

    results = scraper.scrape_bucket(
        bucket=args.bucket,
        countries=countries,
        max_pages=args.max_pages,
    )

    print(f"\nResults for {args.bucket}:")
    print(f"  Total found: {results['total']}")
    print(f"  New:         {results['new']}")
    print(f"  Existing:    {results['existing']}")


def cmd_scrape_all(args):
    """Scrape all buckets."""
    if not args.token:
        print("Error: --token is required")
        sys.exit(1)

    scraper = MWCScraper(args.token)

    # Parse countries
    countries = None
    if args.countries:
        countries = _parse_countries(args.countries)

    results = scraper.scrape_all_buckets(
        countries=countries,
        max_pages=args.max_pages,
    )

    # Summary already printed by scraper


def cmd_scrape_country(args):
    """Scrape all buckets for a single country."""
    if not args.token:
        print("Error: --token is required")
        sys.exit(1)

    country_upper = args.country.upper()
    if country_upper not in COUNTRIES:
        print(f"Error: Unknown country '{args.country}'")
        print("Valid countries:")
        for name in sorted(COUNTRIES.keys()):
            print(f"  - {name}")
        sys.exit(1)

    scraper = MWCScraper(args.token)

    results = scraper.scrape_single_country(
        country_name=country_upper,
        max_pages=args.max_pages,
    )

    print(f"\nResults for {country_upper}:")
    for bucket, counts in results.items():
        print(f"  {bucket}: {counts['new']} new / {counts['total']} total")


def cmd_stats(args):
    """Show database statistics."""
    init_database()
    stats = get_prospect_stats()

    print("\nDatabase Statistics")
    print("="*40)
    print(f"Total prospects: {stats['total_prospects']}")
    print(f"Total companies: {stats['total_companies']}")
    print(f"Companies needing enrichment: {stats['companies_needing_enrichment']}")

    if stats.get("by_bucket"):
        print("\nBy Bucket:")
        for bucket, count in stats["by_bucket"].items():
            print(f"  {bucket}: {count}")

    if stats.get("by_status"):
        print("\nBy Status:")
        for status, count in stats["by_status"].items():
            print(f"  {status}: {count}")


def cmd_list_filters(args):
    """List available filters and countries."""
    print("\nBUCKETS (filter categories)")
    print("="*40)
    for name, config in BUCKETS.items():
        print(f"\n{name}:")
        print(f"  Description: {config['description']}")
        print(f"  Filters:")
        for filter_name, code in config["filters"].items():
            print(f"    - {filter_name}: {code}")

    print("\n\nCOUNTRIES")
    print("="*40)
    for name, code in sorted(COUNTRIES.items()):
        print(f"  {name}: {code}")

    print("\n\nCOUNTRY GROUPS")
    print("="*40)
    for group, codes in COUNTRY_GROUPS.items():
        print(f"  {group}: {len(codes)} countries")


def cmd_init(args):
    """Initialize the database."""
    init_database()
    print("Database initialized successfully!")


def cmd_export(args):
    """Export prospects to CSV."""
    init_database()

    output_file = args.output or f"attendees_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"

    conn = sqlite3.connect(get_db_path())
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    # Build query
    query = "SELECT * FROM prospects WHERE 1=1"
    params = []

    if args.bucket:
        query += " AND bucket = ?"
        params.append(args.bucket)

    if args.country:
        query += " AND country = ?"
        params.append(args.country.upper())

    if args.status:
        query += " AND status = ?"
        params.append(args.status)

    query += " ORDER BY first_seen_at DESC"

    cursor.execute(query, params)
    rows = cursor.fetchall()

    if not rows:
        print("No prospects found matching criteria.")
        conn.close()
        return

    # Write CSV
    fieldnames = ["uuid", "full_name", "job_title", "company_name", "bucket",
                  "country", "mwc_profile_url", "status", "first_seen_at"]

    with open(output_file, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()

        for row in rows:
            writer.writerow({field: row[field] for field in fieldnames})

    conn.close()

    print(f"Exported {len(rows)} prospects to: {output_file}")


def cmd_new(args):
    """Show new prospects since last run or given date."""
    init_database()

    conn = sqlite3.connect(get_db_path())
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    # Get prospects from last 24 hours by default
    if args.since:
        since = args.since
    else:
        since = (datetime.now().replace(hour=0, minute=0, second=0)).isoformat()

    query = """
        SELECT full_name, job_title, company_name, bucket, country, first_seen_at
        FROM prospects
        WHERE first_seen_at > ?
        ORDER BY first_seen_at DESC
    """

    cursor.execute(query, (since,))
    rows = cursor.fetchall()

    if not rows:
        print(f"No new prospects since {since}")
        conn.close()
        return

    print(f"\nNew Prospects Since {since}")
    print("=" * 80)

    for row in rows:
        print(f"\n{row['full_name']}")
        print(f"  {row['job_title']} @ {row['company_name']}")
        print(f"  Bucket: {row['bucket']} | Country: {row['country']}")
        print(f"  Added: {row['first_seen_at']}")

    print(f"\n{'-' * 80}")
    print(f"Total: {len(rows)} new prospects")

    conn.close()


def _parse_countries(countries_arg: str) -> list:
    """Parse countries argument into list of codes."""
    countries = []

    for item in countries_arg.split(","):
        item = item.strip().upper()

        # Check if it's a country group
        if item.lower() in COUNTRY_GROUPS:
            countries.extend(COUNTRY_GROUPS[item.lower()])
        # Check if it's a country name
        elif item in COUNTRIES:
            countries.append(COUNTRIES[item])
        # Check if it's already a code
        elif item.isdigit():
            countries.append(item)
        else:
            print(f"Warning: Unknown country/group '{item}', skipping")

    return list(set(countries))  # Dedupe


def main():
    parser = argparse.ArgumentParser(
        description="MWC Barcelona Attendee Scraper",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Test API connection
  python -m mwc_scraper.cli test --token YOUR_JWT_TOKEN

  # Scrape partners bucket
  python -m mwc_scraper.cli scrape --token YOUR_JWT_TOKEN --bucket partners

  # Scrape all buckets
  python -m mwc_scraper.cli scrape-all --token YOUR_JWT_TOKEN

  # Scrape only US attendees
  python -m mwc_scraper.cli scrape-all --token YOUR_JWT_TOKEN --countries "UNITED STATES"

  # Scrape North America
  python -m mwc_scraper.cli scrape-all --token YOUR_JWT_TOKEN --countries north_america

  # View stats
  python -m mwc_scraper.cli stats

  # List available filters
  python -m mwc_scraper.cli list-filters
        """
    )

    subparsers = parser.add_subparsers(dest="command", help="Command to run")

    # Test command
    test_parser = subparsers.add_parser("test", help="Test API connection")
    test_parser.add_argument("--token", "-t", help="JWT token for authentication")

    # Scrape command
    scrape_parser = subparsers.add_parser("scrape", help="Scrape a single bucket")
    scrape_parser.add_argument("--token", "-t", required=True, help="JWT token")
    scrape_parser.add_argument("--bucket", "-b", required=True,
                               choices=list(BUCKETS.keys()),
                               help="Bucket to scrape")
    scrape_parser.add_argument("--countries", "-c",
                               help="Comma-separated countries or groups (default: all)")
    scrape_parser.add_argument("--max-pages", "-m", type=int,
                               help="Max pages per country (default: all)")

    # Scrape-all command
    scrape_all_parser = subparsers.add_parser("scrape-all", help="Scrape all buckets")
    scrape_all_parser.add_argument("--token", "-t", required=True, help="JWT token")
    scrape_all_parser.add_argument("--countries", "-c",
                                   help="Comma-separated countries or groups (default: all)")
    scrape_all_parser.add_argument("--max-pages", "-m", type=int,
                                   help="Max pages per country (default: all)")

    # Scrape-country command
    scrape_country_parser = subparsers.add_parser("scrape-country",
                                                   help="Scrape all buckets for one country")
    scrape_country_parser.add_argument("--token", "-t", required=True, help="JWT token")
    scrape_country_parser.add_argument("--country", "-c", required=True,
                                        help="Country name (e.g., 'UNITED STATES')")
    scrape_country_parser.add_argument("--max-pages", "-m", type=int,
                                        help="Max pages per bucket (default: all)")

    # Stats command
    stats_parser = subparsers.add_parser("stats", help="Show database statistics")

    # List-filters command
    list_parser = subparsers.add_parser("list-filters", help="List available filters")

    # Init command
    init_parser = subparsers.add_parser("init", help="Initialize database")

    # Export command
    export_parser = subparsers.add_parser("export", help="Export prospects to CSV")
    export_parser.add_argument("--output", "-o", help="Output file path (default: attendees_YYYYMMDD.csv)")
    export_parser.add_argument("--bucket", "-b", choices=list(BUCKETS.keys()),
                               help="Filter by bucket")
    export_parser.add_argument("--country", "-c", help="Filter by country")
    export_parser.add_argument("--status", "-s", help="Filter by status")

    # New command
    new_parser = subparsers.add_parser("new", help="Show new prospects since date")
    new_parser.add_argument("--since", "-s", help="Show prospects since date (YYYY-MM-DD)")

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        sys.exit(1)

    # Route to command handler
    commands = {
        "test": cmd_test,
        "scrape": cmd_scrape,
        "scrape-all": cmd_scrape_all,
        "scrape-country": cmd_scrape_country,
        "stats": cmd_stats,
        "list-filters": cmd_list_filters,
        "init": cmd_init,
        "export": cmd_export,
        "new": cmd_new,
    }

    handler = commands.get(args.command)
    if handler:
        handler(args)
    else:
        parser.print_help()
        sys.exit(1)


if __name__ == "__main__":
    main()
