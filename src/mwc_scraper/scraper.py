"""
MWC Barcelona Attendee Scraper

Main scraping logic for fetching and storing attendees.
"""

import logging
from datetime import datetime
from typing import List, Dict, Any, Optional

from .config import BUCKETS, COUNTRY_GROUPS, COUNTRIES
from .api_client import MWCApiClient, parse_attendee
from .database import (
    init_database,
    prospect_exists,
    insert_prospect,
    get_or_create_company,
    link_prospect_to_company,
    start_scrape_run,
    complete_scrape_run,
    get_prospect_stats,
)


# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


class MWCScraper:
    """Main scraper for MWC Barcelona attendees."""

    def __init__(self, jwt_token: str):
        """
        Initialize the scraper.

        Args:
            jwt_token: JWT token for API authentication
        """
        self.api_client = MWCApiClient(jwt_token)
        init_database()

    def test_connection(self) -> bool:
        """Test API connection."""
        logger.info("Testing API connection...")
        success = self.api_client.test_connection()
        if success:
            logger.info("API connection successful!")
        else:
            logger.error("API connection failed!")
        return success

    def scrape_bucket(
        self,
        bucket: str,
        countries: List[str] = None,
        max_pages: int = None,
    ) -> Dict[str, int]:
        """
        Scrape all attendees from a bucket.

        Args:
            bucket: Bucket name ('partners', 'technical', 'product_innovation')
            countries: List of country codes (None = all configured)
            max_pages: Maximum pages per country (None = all)

        Returns:
            Dictionary with counts (total, new, existing)
        """
        if bucket not in BUCKETS:
            raise ValueError(f"Unknown bucket: {bucket}")

        bucket_config = BUCKETS[bucket]
        logger.info(f"Starting scrape for bucket: {bucket_config['name']}")

        # Use all configured countries if none specified
        if countries is None:
            countries = COUNTRY_GROUPS["all"]

        # Start scrape run tracking
        run_id = start_scrape_run(bucket, countries)

        total_found = 0
        new_count = 0
        existing_count = 0
        errors = []

        try:
            # Scrape each country separately for better tracking
            for country_code in countries:
                country_name = self._get_country_name(country_code)
                logger.info(f"  Scraping country: {country_name} ({country_code})")

                try:
                    for raw_attendee in self.api_client.search_by_bucket(
                        bucket=bucket,
                        countries=[country_code],
                        max_pages=max_pages,
                    ):
                        total_found += 1
                        result = self._process_attendee(raw_attendee, bucket, country_name)

                        if result == "new":
                            new_count += 1
                        else:
                            existing_count += 1

                        # Progress logging every 100 attendees
                        if total_found % 100 == 0:
                            logger.info(f"    Processed {total_found} attendees...")

                except Exception as e:
                    error_msg = f"Error scraping {country_name}: {str(e)}"
                    logger.error(error_msg)
                    errors.append(error_msg)

            # Complete the scrape run
            complete_scrape_run(
                run_id,
                total=total_found,
                new=new_count,
                existing=existing_count,
                errors="\n".join(errors) if errors else None,
            )

        except Exception as e:
            logger.error(f"Scrape failed: {e}")
            complete_scrape_run(run_id, total_found, new_count, existing_count, str(e))
            raise

        logger.info(f"Scrape complete: {total_found} total, {new_count} new, {existing_count} existing")

        return {
            "total": total_found,
            "new": new_count,
            "existing": existing_count,
            "errors": len(errors),
        }

    def scrape_all_buckets(
        self,
        countries: List[str] = None,
        max_pages: int = None,
    ) -> Dict[str, Dict[str, int]]:
        """
        Scrape all buckets.

        Args:
            countries: List of country codes (None = all)
            max_pages: Maximum pages per country per bucket

        Returns:
            Dictionary of results per bucket
        """
        results = {}

        for bucket in BUCKETS:
            logger.info(f"\n{'='*50}")
            logger.info(f"BUCKET: {bucket.upper()}")
            logger.info(f"{'='*50}")

            results[bucket] = self.scrape_bucket(
                bucket=bucket,
                countries=countries,
                max_pages=max_pages,
            )

        # Print summary
        self._print_summary(results)

        return results

    def scrape_single_country(
        self,
        country_name: str,
        buckets: List[str] = None,
        max_pages: int = None,
    ) -> Dict[str, Dict[str, int]]:
        """
        Scrape all buckets for a single country.

        Args:
            country_name: Country name (e.g., "UNITED STATES")
            buckets: List of buckets to scrape (None = all)
            max_pages: Maximum pages per bucket

        Returns:
            Dictionary of results per bucket
        """
        country_code = COUNTRIES.get(country_name.upper())
        if not country_code:
            raise ValueError(f"Unknown country: {country_name}")

        if buckets is None:
            buckets = list(BUCKETS.keys())

        results = {}

        for bucket in buckets:
            results[bucket] = self.scrape_bucket(
                bucket=bucket,
                countries=[country_code],
                max_pages=max_pages,
            )

        return results

    def _process_attendee(
        self,
        raw_attendee: Dict[str, Any],
        bucket: str,
        country: str,
    ) -> str:
        """
        Process a single attendee: parse, dedupe, and store.

        Args:
            raw_attendee: Raw attendee data from API
            bucket: The bucket this attendee belongs to
            country: The country this attendee was found in

        Returns:
            "new" if attendee was new, "existing" if already in database
        """
        # Parse the attendee data
        attendee = parse_attendee(raw_attendee, bucket, country)

        # Check if already exists
        if prospect_exists(attendee["uuid"]):
            return "existing"

        # Insert new prospect
        prospect_id = insert_prospect(attendee)

        # Create/link company
        if attendee.get("company_name"):
            company_id = get_or_create_company(attendee["company_name"])
            if company_id:
                link_prospect_to_company(prospect_id, company_id)

        return "new"

    def _get_country_name(self, country_code: str) -> str:
        """Get country name from code."""
        for name, code in COUNTRIES.items():
            if code == country_code:
                return name
        return f"Unknown ({country_code})"

    def _print_summary(self, results: Dict[str, Dict[str, int]]):
        """Print a summary of scraping results."""
        logger.info("\n" + "="*50)
        logger.info("SCRAPING SUMMARY")
        logger.info("="*50)

        total_new = 0
        total_existing = 0
        total_found = 0

        for bucket, counts in results.items():
            logger.info(f"\n{bucket.upper()}:")
            logger.info(f"  Total found: {counts['total']}")
            logger.info(f"  New:         {counts['new']}")
            logger.info(f"  Existing:    {counts['existing']}")

            total_new += counts["new"]
            total_existing += counts["existing"]
            total_found += counts["total"]

        logger.info(f"\nOVERALL:")
        logger.info(f"  Total found: {total_found}")
        logger.info(f"  New:         {total_new}")
        logger.info(f"  Existing:    {total_existing}")

        # Database stats
        stats = get_prospect_stats()
        logger.info(f"\nDATABASE:")
        logger.info(f"  Total prospects: {stats['total_prospects']}")
        logger.info(f"  Total companies: {stats['total_companies']}")
        logger.info(f"  Companies needing enrichment: {stats['companies_needing_enrichment']}")

    def get_stats(self) -> Dict[str, Any]:
        """Get current database statistics."""
        return get_prospect_stats()


def quick_test(jwt_token: str) -> bool:
    """
    Quick test to verify everything is working.

    Args:
        jwt_token: JWT token for authentication

    Returns:
        True if test passed
    """
    logger.info("Running quick test...")

    scraper = MWCScraper(jwt_token)

    # Test connection
    if not scraper.test_connection():
        return False

    # Test fetching first page of one bucket/country
    logger.info("Fetching test data (first page of US partners)...")

    results = scraper.scrape_bucket(
        bucket="partners",
        countries=["932"],  # US only
        max_pages=1,  # First page only
    )

    logger.info(f"Test complete! Found {results['total']} attendees, {results['new']} new")

    return results["total"] > 0
