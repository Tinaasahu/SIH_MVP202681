"""
archive.py - Weather Data Archiving Pipeline (Smart India Hackathon)

This module archives daily forecast and actual weather observations into timestamped
backup CSV snapshots and historical records in the data directory.

Dependencies: os, shutil, datetime, pandas, sqlite3
"""

import os
import shutil
import sqlite3
from datetime import datetime
import pandas as pd


DATA_DIR = "data"
DB_PATH = "database/weather.db"
ARCHIVE_DIR = "data/archive"


def archive_forecast_csv(source_csv="data/forecast_raw.csv"):
    """
    Create a timestamped archive copy of the forecast raw dataset.
    """
    if not os.path.exists(source_csv):
        print(f"[Warning] Source CSV {source_csv} not found for archiving.")
        return None

    os.makedirs(ARCHIVE_DIR, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    target_path = os.path.join(ARCHIVE_DIR, f"forecast_{timestamp}.csv")

    try:
        shutil.copy2(source_csv, target_path)
        print(f"[Success] Archived forecast snapshot to: {target_path}")
        return target_path
    except Exception as e:
        print(f"[Error] Failed to archive {source_csv}: {e}")
        return None


def archive_actual_csv(source_csv="data/actual_weather.csv"):
    """
    Create a timestamped archive copy of the actual weather observations dataset.
    """
    if not os.path.exists(source_csv):
        print(f"[Warning] Source CSV {source_csv} not found for archiving.")
        return None

    os.makedirs(ARCHIVE_DIR, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    target_path = os.path.join(ARCHIVE_DIR, f"actual_{timestamp}.csv")

    try:
        shutil.copy2(source_csv, target_path)
        print(f"[Success] Archived actual weather snapshot to: {target_path}")
        return target_path
    except Exception as e:
        print(f"[Error] Failed to archive {source_csv}: {e}")
        return None


def archive_database_snapshot(db_path=DB_PATH):
    """
    Create a timestamped backup snapshot of the SQLite database.
    """
    if not os.path.exists(db_path):
        print(f"[Warning] Database {db_path} not found for archiving.")
        return None

    os.makedirs(ARCHIVE_DIR, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    target_path = os.path.join(ARCHIVE_DIR, f"weather_backup_{timestamp}.db")

    try:
        shutil.copy2(db_path, target_path)
        print(f"[Success] Archived database snapshot to: {target_path}")
        return target_path
    except Exception as e:
        print(f"[Error] Failed to backup database {db_path}: {e}")
        return None


def main():
    """
    Main execution function to archive forecast, actual observations, and SQLite database.
    """
    print("Starting Weather Data Archiving Pipeline...")
    archive_forecast_csv()
    archive_actual_csv()
    archive_database_snapshot()
    print("Archiving complete.")


if __name__ == "__main__":
    main()
