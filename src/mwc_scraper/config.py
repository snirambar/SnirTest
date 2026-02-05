"""
Configuration constants for MWC Barcelona Scraper
"""

# API Configuration
API_BASE_URL = "https://bonacms-api.firabarcelona.com"
SEARCH_ENDPOINT = "/profile/v1/gsmawebteam/28/search"
EVENT_ID = "28"  # MWC Barcelona 2026

# Page size (API returns 20 per page)
PAGE_SIZE = 20

# Rate limiting
REQUEST_DELAY_SECONDS = 1.0  # Delay between API calls

# =============================================================================
# GEOGRAPHIC FILTERS (filterCountries)
# =============================================================================

COUNTRIES = {
    # North America
    "UNITED STATES": "932",
    "CANADA": "738",

    # Middle East
    "ISRAEL": "811",

    # Europe
    "UNITED KINGDOM": "777",
    "GERMANY": "757",
    "FRANCE": "775",
    "SPAIN": "768",
    "ITALY": "813",
    "NETHERLANDS": "837",
    "SWEDEN": "770",
    "SWITZERLAND": "772",
    "BELGIUM": "725",
    "AUSTRIA": "719",
    "DENMARK": "752",
    "NORWAY": "843",
    "FINLAND": "756",
    "IRELAND": "810",
    "PORTUGAL": "762",
    "POLAND": "761",
}

# Country groups for easier filtering
COUNTRY_GROUPS = {
    "north_america": ["932", "738"],  # US, Canada
    "israel": ["811"],
    "europe": ["777", "757", "775", "768", "813", "837", "770", "772",
               "725", "719", "752", "843", "756", "810", "762", "761"],
    "all": list(COUNTRIES.values()),
}

# =============================================================================
# BUCKET FILTERS (filterExclusiveInterests)
# =============================================================================

# Bucket 1: Partners - Company Main Activity
PARTNERS_FILTERS = {
    "SYSTEMS INTEGRATOR": "1244",
    "CLOUD SERVICES": "1272",
    "SOFTWARE DEVELOPMENT": "1273",
    "CONSULTANCY": "1246",
}

# Bucket 2: Technical Prospects - Area of Responsibility
TECHNICAL_FILTERS = {
    "TECHNICAL / ENGINEERING": "1221",
    "RESEARCH / DEVELOPMENT": "1228",
    "SOFTWARE DEVELOPMENT": "1230",
    "GOVERNMENT / REGULATORY": "1237",
    "DATA & ANALYTICS": "1240",
    "ENTERPRISE IT": "1308",
}

# Bucket 3: Product / Innovation - Area of Responsibility
PRODUCT_INNOVATION_FILTERS = {
    "STRATEGY": "1222",
    "PRODUCT MANAGEMENT": "1225",
    "CLIENT / CUSTOMER SERVICE": "1226",
    "OPERATIONS": "1236",
    "GOVERNMENT / REGULATORY": "1237",
    "INNOVATION": "2625",
}

# Combined bucket configurations
BUCKETS = {
    "partners": {
        "name": "Partners",
        "description": "System integrators, cloud providers, consultancies",
        "filter_codes": list(PARTNERS_FILTERS.values()),
        "filters": PARTNERS_FILTERS,
    },
    "technical": {
        "name": "Technical Prospects",
        "description": "Technical, R&D, engineering, IT roles",
        "filter_codes": list(TECHNICAL_FILTERS.values()),
        "filters": TECHNICAL_FILTERS,
    },
    "product_innovation": {
        "name": "Product / Innovation",
        "description": "Strategy, product, innovation roles",
        "filter_codes": list(PRODUCT_INNOVATION_FILTERS.values()),
        "filters": PRODUCT_INNOVATION_FILTERS,
    },
}

# =============================================================================
# ENRICHMENT APIs
# =============================================================================

APOLLO_API_KEY = "mnTw-G71QkQ6cJrDuq_iGQ"
APOLLO_API_URL = "https://api.apollo.io/v1/organizations/enrich"

# =============================================================================
# DATABASE
# =============================================================================

DATABASE_PATH = "data/mwc_attendees.db"

# =============================================================================
# LOGGING
# =============================================================================

LOG_FILE = "logs/scraper.log"
LOG_LEVEL = "INFO"
