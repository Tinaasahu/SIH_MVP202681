"""
push_to_supabase.py — Push SQLite Weather Database to Supabase
Smart India Hackathon 2026 (PS: 26081)

Transfers tables from database/weather.db and outputs/*.csv into Supabase PostgreSQL.

Usage:
  1. Push everything (or remaining outputs):
     ./venv/bin/python database/push_to_supabase.py

  2. Push only AI pipeline output tables:
     ./venv/bin/python database/push_to_supabase.py --only-outputs
"""

import os
import sys
import time
import sqlite3
import argparse
import requests
import pandas as pd

# Supabase Project Configuration
SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://pwtukbopowxejquoyxbr.supabase.co")
SUPABASE_SECRET = os.environ.get("SUPABASE_SECRET", "")
DB_PATH = "database/weather.db"

# Core Tables in weather.db
TABLES = [
    "forecast_current",
    "actual_history",
    "forecast_history",
    "forecast_history_lead",
]

# AI output tables from outputs/*.csv
OUTPUT_TABLES = {
    "hybrid_forecast": "outputs/hybrid_forecast.csv",
    "confidence_scores": "outputs/confidence_scores.csv",
    "extreme_alerts": "outputs/extreme_alerts.csv",
    "model_weights_lead": "outputs/model_weights_lead.csv",
    "skill_scores_lead": "outputs/skill_scores_lead.csv",
}


def check_supabase_table(table_name: str) -> bool:
    """Check if a table exists and is accessible via PostgREST."""
    url = f"{SUPABASE_URL}/rest/v1/{table_name}?limit=1"
    headers = {
        "apikey": SUPABASE_SECRET,
        "Authorization": f"Bearer {SUPABASE_SECRET}",
    }
    try:
        r = requests.get(url, headers=headers, timeout=5)
        return r.status_code == 200
    except Exception:
        return False


def upload_table_rest(table_name: str, records: list, chunk_size: int = 2500):
    """Batch-insert records via Supabase REST API using service_role secret key."""
    url = f"{SUPABASE_URL}/rest/v1/{table_name}"
    headers = {
        "apikey": SUPABASE_SECRET,
        "Authorization": f"Bearer {SUPABASE_SECRET}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal",  # High throughput mode
    }

    total_records = len(records)
    uploaded = 0
    start_time = time.time()

    print(f"\n[Pushing] {table_name}: {total_records:,} rows (chunks of {chunk_size})...")

    for i in range(0, total_records, chunk_size):
        chunk = records[i : i + chunk_size]
        for attempt in range(3):
            try:
                res = requests.post(url, headers=headers, json=chunk, timeout=30)
                if res.status_code in (200, 201):
                    uploaded += len(chunk)
                    pct = (uploaded / total_records) * 100
                    elapsed = time.time() - start_time
                    speed = uploaded / elapsed if elapsed > 0 else 0
                    print(f"  -> {uploaded:,}/{total_records:,} ({pct:5.1f}%) | {speed:,.0f} rows/s", end="\r")
                    break
                else:
                    if attempt == 2:
                        print(f"\n  [Error] Batch {i // chunk_size + 1} failed: {res.status_code} - {res.text[:200]}")
                    time.sleep(1)
            except Exception as e:
                if attempt == 2:
                    print(f"\n  [Exception] Batch {i // chunk_size + 1}: {e}")
                time.sleep(1)

    elapsed = time.time() - start_time
    print(f"\n  [Done] {table_name}: {uploaded:,} rows uploaded in {elapsed:.1f}s")
    return uploaded


def push_to_supabase(only_outputs: bool = False, skip_existing_core: bool = True):
    """Reads datasets and pushes to Supabase via REST."""
    print("=" * 65)
    print("  SUPABASE CLOUD SYNC: REST API (Service Role)")
    print(f"  Target: {SUPABASE_URL}")
    print("=" * 65)

    results = {}

    # 1. Core SQLite Tables
    if not only_outputs:
        if not os.path.exists(DB_PATH):
            print(f"[Error] Database file not found at {DB_PATH}.")
            sys.exit(1)

        conn = sqlite3.connect(DB_PATH)
        for t in TABLES:
            # Check if table already has rows in Supabase to avoid re-uploading 1.1M rows
            if skip_existing_core:
                try:
                    r = requests.get(
                        f"{SUPABASE_URL}/rest/v1/{t}",
                        headers={
                            "apikey": SUPABASE_SECRET,
                            "Authorization": f"Bearer {SUPABASE_SECRET}",
                            "Range": "0-0",
                            "Prefer": "count=exact",
                        },
                        timeout=5,
                    )
                    cr = r.headers.get("Content-Range", "")
                    if "/" in cr:
                        total_in_db = int(cr.split("/")[1])
                        if total_in_db > 0:
                            print(f"[Skip] {t} already populated in Supabase ({total_in_db:,} rows).")
                            results[t] = total_in_db
                            continue
                except Exception:
                    pass

            if not check_supabase_table(t):
                print(f"[Warning] Table {t} not found in Supabase. Run database/supabase_schema.sql first.")
                continue

            print(f"\nReading {t} from {DB_PATH}...")
            df = pd.read_sql_query(f"SELECT * FROM {t}", conn)
            df = df.where(pd.notnull(df), None)
            records = df.to_dict(orient="records")
            uploaded = upload_table_rest(t, records)
            results[t] = uploaded
        conn.close()

    # 2. Output tables
    for t, path in OUTPUT_TABLES.items():
        if not os.path.exists(path):
            continue

        if not check_supabase_table(t):
            print(f"[Warning] Output table {t} not found in Supabase schema. Run database/supabase_schema.sql.")
            continue

        print(f"\nReading output: {path}...")
        df = pd.read_csv(path)
        df = df.where(pd.notnull(df), None)
        records = df.to_dict(orient="records")
        uploaded = upload_table_rest(t, records)
        results[t] = uploaded

    # Summary
    print("\n" + "=" * 65)
    print("  SUPABASE SYNC STATUS SUMMARY")
    print("=" * 65)
    total = sum(results.values())
    for t, count in results.items():
        print(f"  {t:28s} : {count:>10,} rows")
    print("  " + "─" * 40)
    print(f"  {'TOTAL IN SUPABASE':28s} : {total:>10,} rows")
    print("=" * 65)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Push SQLite DB & Outputs to Supabase Cloud")
    parser.add_argument("--secret", type=str, help="Supabase Secret Key (or set SUPABASE_SECRET env var)")
    parser.add_argument("--only-outputs", action="store_true", help="Push only AI output tables")
    parser.add_argument("--force-all", action="store_true", help="Force re-upload of all tables even if populated")
    args = parser.parse_args()

    if args.secret:
        SUPABASE_SECRET = args.secret

    if not SUPABASE_SECRET:
        print("[Error] Supabase Secret Key required.")
        print("Provide via --secret sb_secret_... or export SUPABASE_SECRET=...")
        sys.exit(1)

    push_to_supabase(only_outputs=args.only_outputs, skip_existing_core=not args.force_all)
