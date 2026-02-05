"""
MWC Barcelona API Client

Handles all API requests to the BonaCMS API.
"""

import time
import requests
from typing import Dict, List, Any, Optional, Generator
from dataclasses import dataclass

from .config import (
    API_BASE_URL,
    SEARCH_ENDPOINT,
    EVENT_ID,
    PAGE_SIZE,
    REQUEST_DELAY_SECONDS,
    BUCKETS,
    COUNTRIES,
)


@dataclass
class SearchResult:
    """Container for search results."""
    content: List[Dict[str, Any]]
    total_elements: int
    total_pages: int
    page_number: int
    page_size: int
    is_last: bool


class MWCApiClient:
    """Client for the MWC Barcelona BonaCMS API."""

    def __init__(self, jwt_token: str):
        """
        Initialize the API client.

        Args:
            jwt_token: The JWT token from the Jemex-Authorization header
        """
        self.jwt_token = jwt_token
        self.base_url = API_BASE_URL
        self.search_url = f"{API_BASE_URL}{SEARCH_ENDPOINT}"
        self.session = requests.Session()
        self.session.headers.update({
            "Content-Type": "application/json",
            "Jemex-Authorization": jwt_token,
        })

    def search_attendees(
        self,
        page: int = 0,
        filter_interests: List[str] = None,
        filter_countries: List[str] = None,
        filter_events: List[str] = None,
        keyword: str = "",
    ) -> SearchResult:
        """
        Search for attendees with filters.

        Args:
            page: Page number (0-indexed)
            filter_interests: List of interest/filter codes (filterExclusiveInterests)
            filter_countries: List of country codes (filterCountries)
            filter_events: List of event codes (filterEventRegister)
            keyword: Search keyword

        Returns:
            SearchResult with attendees and pagination info
        """
        payload = {
            "random": False,
            "keyword": keyword,
            "page": page,
            "filterExclusiveInterests": filter_interests or [],
        }

        if filter_countries:
            payload["filterCountries"] = filter_countries

        if filter_events:
            payload["filterEventRegister"] = filter_events
        else:
            # Default to MWC Barcelona 2026
            payload["filterEventRegister"] = [EVENT_ID]

        response = self.session.post(self.search_url, json=payload)
        response.raise_for_status()

        data = response.json()

        return SearchResult(
            content=data.get("content", []),
            total_elements=data.get("totalElements", 0),
            total_pages=data.get("totalPages", 0),
            page_number=data.get("number", 0),
            page_size=data.get("size", PAGE_SIZE),
            is_last=data.get("last", True),
        )

    def search_all_pages(
        self,
        filter_interests: List[str] = None,
        filter_countries: List[str] = None,
        filter_events: List[str] = None,
        keyword: str = "",
        max_pages: int = None,
        delay: float = REQUEST_DELAY_SECONDS,
    ) -> Generator[Dict[str, Any], None, None]:
        """
        Search all pages and yield each attendee.

        Args:
            filter_interests: List of interest/filter codes
            filter_countries: List of country codes
            filter_events: List of event codes
            keyword: Search keyword
            max_pages: Maximum number of pages to fetch (None = all)
            delay: Delay between requests in seconds

        Yields:
            Individual attendee dictionaries
        """
        page = 0
        total_pages = None

        while True:
            # Check max pages limit
            if max_pages is not None and page >= max_pages:
                break

            result = self.search_attendees(
                page=page,
                filter_interests=filter_interests,
                filter_countries=filter_countries,
                filter_events=filter_events,
                keyword=keyword,
            )

            # Set total pages on first request
            if total_pages is None:
                total_pages = result.total_pages
                print(f"  Total attendees: {result.total_elements}, Pages: {total_pages}")

            # Yield each attendee
            for attendee in result.content:
                yield attendee

            # Check if we're done
            if result.is_last or page >= total_pages - 1:
                break

            # Move to next page
            page += 1

            # Rate limiting
            if delay > 0:
                time.sleep(delay)

    def search_by_bucket(
        self,
        bucket: str,
        countries: List[str] = None,
        max_pages: int = None,
    ) -> Generator[Dict[str, Any], None, None]:
        """
        Search attendees by bucket (partners, technical, product_innovation).

        Args:
            bucket: Bucket name ('partners', 'technical', 'product_innovation')
            countries: List of country codes (None = all configured countries)
            max_pages: Maximum pages to fetch

        Yields:
            Individual attendee dictionaries
        """
        if bucket not in BUCKETS:
            raise ValueError(f"Unknown bucket: {bucket}. Valid: {list(BUCKETS.keys())}")

        bucket_config = BUCKETS[bucket]
        filter_codes = bucket_config["filter_codes"]

        print(f"\nSearching bucket: {bucket_config['name']}")
        print(f"  Filters: {list(bucket_config['filters'].keys())}")

        yield from self.search_all_pages(
            filter_interests=filter_codes,
            filter_countries=countries,
            max_pages=max_pages,
        )

    def search_by_country(
        self,
        country_name: str,
        filter_interests: List[str] = None,
        max_pages: int = None,
    ) -> Generator[Dict[str, Any], None, None]:
        """
        Search attendees by country name.

        Args:
            country_name: Country name (e.g., "UNITED STATES")
            filter_interests: Optional interest filters
            max_pages: Maximum pages to fetch

        Yields:
            Individual attendee dictionaries
        """
        country_code = COUNTRIES.get(country_name.upper())
        if not country_code:
            raise ValueError(f"Unknown country: {country_name}")

        print(f"\nSearching country: {country_name} (code: {country_code})")

        yield from self.search_all_pages(
            filter_interests=filter_interests,
            filter_countries=[country_code],
            max_pages=max_pages,
        )

    def get_attendee_count(
        self,
        filter_interests: List[str] = None,
        filter_countries: List[str] = None,
    ) -> int:
        """
        Get the total count of attendees matching filters.

        Args:
            filter_interests: List of interest/filter codes
            filter_countries: List of country codes

        Returns:
            Total number of matching attendees
        """
        result = self.search_attendees(
            page=0,
            filter_interests=filter_interests,
            filter_countries=filter_countries,
        )
        return result.total_elements

    def test_connection(self) -> bool:
        """
        Test if the API connection is working.

        Returns:
            True if connection successful, False otherwise
        """
        try:
            result = self.search_attendees(page=0)
            return result.total_elements > 0
        except requests.exceptions.RequestException as e:
            print(f"Connection test failed: {e}")
            return False


def parse_attendee(raw_attendee: Dict[str, Any], bucket: str = None, country: str = None) -> Dict[str, Any]:
    """
    Parse raw attendee data from API into our format.

    Args:
        raw_attendee: Raw attendee data from API
        bucket: The bucket this attendee was found in
        country: The country filter used (if any)

    Returns:
        Parsed attendee dictionary
    """
    # Extract UUID from profile URL or directly
    uuid = raw_attendee.get("uuid") or raw_attendee.get("id")

    # Parse name
    first_name = raw_attendee.get("firstName", "")
    last_name = raw_attendee.get("lastName", "")
    full_name = f"{first_name} {last_name}".strip()

    # Get profile image
    profile_pic = raw_attendee.get("profilePicture") or raw_attendee.get("profilePictureUrl")

    # Get event badges
    event_badges = raw_attendee.get("eventBadges", [])
    if isinstance(event_badges, str):
        event_badges = [event_badges]

    return {
        "uuid": uuid,
        "mwc_profile_url": f"https://www.mwcbarcelona.com/mymwc/details/{uuid}",
        "full_name": full_name,
        "first_name": first_name,
        "last_name": last_name,
        "job_title": raw_attendee.get("jobTitle", ""),
        "company_name": raw_attendee.get("company", ""),
        "event_badges": event_badges,
        "bucket": bucket,
        "country": country,
        "country_code": raw_attendee.get("countryCode"),
        "profile_image_url": profile_pic,
    }
