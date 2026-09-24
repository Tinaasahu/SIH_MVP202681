"""
save_db.py - SQLite Database Storage Pipeline (Smart India Hackathon)

This script reads forecast and actual weather CSV files (data/forecast_raw.csv
and data/actual_weather.csv) and stores them into database/weather.db in tables
`forecast_data` and `actual_data`.

Actual observations are sourced from the Open-Meteo archive API via
api/fetch_actuals.py. If data/actual_weather.csv does not exist, this script
will attempt to fetch it automatically. See api/fetch_actuals.py for details
on why independent ground truth matters for honest skill scoring.

Dependencies: sqlite3, pandas
"""

import os
import sys
import sqlite3
import pandas as pd


DB_PATH = "database/weather.db"
FORECAST_CSV_CANDIDATES = ["data/processed/all_models_clean.csv", "data/forecast_raw.csv"]
ACTUAL_CSV_PATH = "data/actual_weather.csv"


def main():
    """
    Read forecast and actual CSV files, connect to database/weather.db,
    and insert/replace tables forecast_data and actual_data.
    """
    # 1. Load forecast data
    forecast_csv_path = None
    for candidate in FORECAST_CSV_CANDIDATES:
        if os.path.exists(candidate):
            forecast_csv_path = candidate
            break

    if not forecast_csv_path:
        print(f"[Error] Forecast CSV file missing. Please run api/forecast.py and api/clean_data.py first.")
        return

    forecast_df = pd.read_csv(forecast_csv_path)

    # 2. Load actual data — fetch from Open-Meteo archive if missing
    if not os.path.exists(ACTUAL_CSV_PATH):
        print(f"[Notice] {ACTUAL_CSV_PATH} not found. Fetching real actuals from Open-Meteo archive API...")
        try:
            # Import the fetcher from the same project
            sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
            from api.fetch_actuals import fetch_all_actuals

            actual_df = fetch_all_actuals(output_csv=ACTUAL_CSV_PATH)
            if actual_df.empty:
                print("[Error] Failed to fetch actual weather data. "
                      "Run 'python api/fetch_actuals.py' manually to debug.")
                return
        except Exception as e:
            print(f"[Error] Could not auto-fetch actuals: {e}")
            print("[Hint] Run 'python api/fetch_actuals.py' manually before running save_db.py.")
            return
    else:
        actual_df = pd.read_csv(ACTUAL_CSV_PATH)
        print(f"[Info] Loaded {len(actual_df)} rows from {ACTUAL_CSV_PATH}")

    # 3. Ensure database directory exists
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)

    # 4. Save to SQLite database
    conn = sqlite3.connect(DB_PATH)
    try:
        forecast_df.to_sql("forecast_data", conn, if_exists="replace", index=False)
        actual_df.to_sql("actual_data", conn, if_exists="replace", index=False)
        conn.commit()
    finally:
        conn.close()

    # 5. Output expected insertion log
    print(f"Forecast rows inserted: {len(forecast_df)}")
    print(f"Actual rows inserted: {len(actual_df)}")


if __name__ == "__main__":
    main()
