"""
save_db.py - SQLite Database Builder (Smart India Hackathon)

Loads the 4 final CSV datasets into database/weather.db:

  Table                    Source CSV
  ─────────────────────    ──────────────────────────────
  forecast_history         data/forecast_history.csv
  actual_history           data/actual_history.csv
  forecast_history_lead    data/forecast_history_lead.csv
  forecast_current         data/forecast_current.csv

All source CSVs are direct API output — no noise, no simulation, no
interpolation. See data/README.md for column schemas.

Dependencies: sqlite3, pandas
"""

import os
import sys
import sqlite3
import pandas as pd


DB_PATH = "database/weather.db"

# Mapping: table_name → CSV path
TABLES = {
    "forecast_history":      "data/forecast_history.csv",
    "actual_history":        "data/actual_history.csv",
    "forecast_history_lead": "data/forecast_history_lead.csv",
    "forecast_current":      "data/forecast_current.csv",
}


def main():
    """
    Read the 4 final CSV files and load them into database/weather.db,
    replacing any existing tables.
    """
    # 1. Verify all CSVs exist
    missing = [f for f in TABLES.values() if not os.path.exists(f)]
    if missing:
        print("[Error] Missing CSV files:")
        for f in missing:
            print(f"  - {f}")
        print("\nRun the fetch scripts first:")
        print("  python api/fetch_history.py")
        print("  python api/fetch_history_lead.py")
        print("  python api/fetch_current.py")
        sys.exit(1)

    # 2. Load all CSVs
    dataframes = {}
    for table_name, csv_path in TABLES.items():
        df = pd.read_csv(csv_path)
        dataframes[table_name] = df
        print(f"[Loaded] {csv_path} → {len(df):,} rows")

    # 3. Ensure database directory exists
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)

    # 4. Remove old database to start fresh
    if os.path.exists(DB_PATH):
        os.remove(DB_PATH)
        print(f"\n[Info] Removed old {DB_PATH}")

    # 5. Write to SQLite
    conn = sqlite3.connect(DB_PATH)
    try:
        for table_name, df in dataframes.items():
            df.to_sql(table_name, conn, if_exists="replace", index=False)
            print(f"[Saved] {table_name}: {len(df):,} rows")
        conn.commit()
    finally:
        conn.close()

    # 6. Summary
    print(f"\n{'=' * 60}")
    print(f"  DATABASE REBUILT: {DB_PATH}")
    print(f"{'=' * 60}")
    total = sum(len(df) for df in dataframes.values())
    for table_name, df in dataframes.items():
        print(f"  {table_name:28s}  {len(df):>10,} rows")
    print(f"  {'─' * 40}")
    print(f"  {'TOTAL':28s}  {total:>10,} rows")
    print(f"{'=' * 60}")


if __name__ == "__main__":
    main()
