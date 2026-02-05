#!/usr/bin/env python3
"""
MWC Barcelona Attendee Scraper - Entry Point

Usage:
    python run_scraper.py --help
    python run_scraper.py test --token YOUR_JWT_TOKEN
    python run_scraper.py scrape-all --token YOUR_JWT_TOKEN
"""

import sys
from pathlib import Path

# Add src to path
src_path = Path(__file__).parent / "src"
sys.path.insert(0, str(src_path))

from mwc_scraper.cli import main

if __name__ == "__main__":
    main()
