"""
fetch_actuals.py - Real Historical Weather Observation Fetcher (Smart India Hackathon)

Ground truth uses Open-Meteo's historical archive API (ERA5 reanalysis-based),
which is independent of the forecast data pulled from Open-Meteo's forecast API.
This avoids circular validation where a forecast would be scored against a noised
copy of itself.

The archive API is free, requires no API key, and provides hourly reanalysis data
for any past date and location worldwide.

Endpoint:
    https://archive-api.open-meteo.com/v1/archive
    ?latitude={lat}&longitude={lon}
    &start_date={YYYY-MM-DD}&end_date={YYYY-MM-DD}
    &hourly=temperature_2m,precipitation,wind_speed_10m
    &timezone=auto

Output schema (matches downstream expectations):
    city, datetime, actual_temperature, actual_rainfall, actual_wind

Dependencies: requests, pandas
"""

import os
import sys
import time
import argparse
from datetime import datetime, timedelta

import requests
import pandas as pd


# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

ARCHIVE_API_URL = "https://archive-api.open-meteo.com/v1/archive"
CITIES_CSV = "data/cities.csv"
OUTPUT_CSV = "data/actual_history.csv"

# Candidates for auto-detecting the date range from existing forecast data
FORECAST_CSV_CANDIDATES = [
    "data/processed/all_models_clean.csv",
    "data/forecast_raw.csv",
]

# Polite delay between successive API calls (seconds)
REQUEST_DELAY = 0.25

# Maximum number of retries per city on API failure
MAX_RETRIES = 1


# ---------------------------------------------------------------------------
# City loader (reuses the same data/cities.csv as api/forecast.py)
# ---------------------------------------------------------------------------

def load_cities(filepath=CITIES_CSV):
    """
    Load cities and their coordinates from the shared cities CSV.

    Returns:
        pd.DataFrame with columns: city, latitude, longitude
    """
    if not os.path.exists(filepath):
        print(f"[Error] Cities file not found at: {filepath}")
        return pd.DataFrame()

    try:
        df = pd.read_csv(filepath)
        required = {"city", "latitude", "longitude"}
        if not required.issubset(df.columns):
            missing = required - set(df.columns)
            print(f"[Error] Missing columns in {filepath}: {missing}")
            return pd.DataFrame()
        return df
    except Exception as e:
        print(f"[Error] Failed to read {filepath}: {e}")
        return pd.DataFrame()


# ---------------------------------------------------------------------------
# Date-range auto-detection
# ---------------------------------------------------------------------------

def detect_date_range():
    """
    Scan existing forecast CSVs to determine the earliest and latest dates
    present in the data. Returns (start_date, end_date) as 'YYYY-MM-DD' strings.

    The end_date is capped at yesterday, because the archive API only serves
    data for completed days.
    """
    for candidate in FORECAST_CSV_CANDIDATES:
        if os.path.exists(candidate):
            try:
                df = pd.read_csv(candidate, usecols=["datetime"])
                df["datetime"] = pd.to_datetime(df["datetime"])
                start = df["datetime"].min().strftime("%Y-%m-%d")
                end = df["datetime"].max().strftime("%Y-%m-%d")

                # Cap end_date at yesterday (archive API has no future data)
                yesterday = (datetime.utcnow() - timedelta(days=1)).strftime("%Y-%m-%d")
                if end > yesterday:
                    end = yesterday

                print(f"[Info] Auto-detected date range from {candidate}: {start} → {end}")
                return start, end
            except Exception as e:
                print(f"[Warning] Could not parse dates from {candidate}: {e}")

    return None, None


# ---------------------------------------------------------------------------
# Core API fetcher
# ---------------------------------------------------------------------------

def fetch_city_actuals(city, latitude, longitude, start_date, end_date):
    """
    Fetch hourly historical weather observations for a single city from
    the Open-Meteo archive API.

    Parameters:
        city (str): City name (used to label rows, not sent to API).
        latitude (float): Latitude coordinate.
        longitude (float): Longitude coordinate.
        start_date (str): Start date in 'YYYY-MM-DD' format.
        end_date (str): End date in 'YYYY-MM-DD' format.

    Returns:
        pd.DataFrame | None: DataFrame with columns
            [city, datetime, actual_temperature, actual_rainfall, actual_wind]
            or None if the request failed after retries.
    """
    params = {
        "latitude": latitude,
        "longitude": longitude,
        "start_date": start_date,
        "end_date": end_date,
        "hourly": "temperature_2m,precipitation,wind_speed_10m",
        "timezone": "auto",
    }
    headers = {"User-Agent": "SIH-HybridWeatherAI/1.0"}

    last_error = None
    for attempt in range(1 + MAX_RETRIES):
        try:
            resp = requests.get(
                ARCHIVE_API_URL,
                params=params,
                headers=headers,
                timeout=30,
            )
            resp.raise_for_status()
            data = resp.json()

            hourly = data.get("hourly", {})
            timestamps = hourly.get("time", [])
            temps = hourly.get("temperature_2m", [])
            rains = hourly.get("precipitation", [])
            winds = hourly.get("wind_speed_10m", [])

            if not timestamps:
                print(f"  [Warning] No hourly data returned for {city}.")
                return None

            df = pd.DataFrame({
                "city": city,
                "datetime": timestamps,
                "actual_temperature": temps,
                "actual_rainfall": rains,
                "actual_wind": winds,
            })

            # Replace None / NaN with sensible defaults so downstream code
            # doesn't crash on missing reanalysis values.
            df["actual_temperature"] = pd.to_numeric(df["actual_temperature"], errors="coerce")
            df["actual_rainfall"] = pd.to_numeric(df["actual_rainfall"], errors="coerce").fillna(0.0)
            df["actual_wind"] = pd.to_numeric(df["actual_wind"], errors="coerce")

            return df

        except requests.exceptions.RequestException as e:
            last_error = e
            if attempt < MAX_RETRIES:
                print(f"  [Retry] Attempt {attempt + 1} failed for {city}: {e}. Retrying...")
                time.sleep(1)
            else:
                print(f"  [Warning] All attempts failed for {city}: {last_error}. Skipping.")
                return None


# ---------------------------------------------------------------------------
# Public entry point (importable from save_db.py or callable as script)
# ---------------------------------------------------------------------------

def fetch_all_actuals(start_date=None, end_date=None, cities_csv=CITIES_CSV,
                      output_csv=OUTPUT_CSV):
    """
    Fetch real historical observations for every city in the cities CSV
    and write the combined result to output_csv.

    Parameters:
        start_date (str | None): 'YYYY-MM-DD'. If None, auto-detected.
        end_date   (str | None): 'YYYY-MM-DD'. If None, auto-detected.
        cities_csv (str): Path to the cities CSV file.
        output_csv (str): Destination path for the actuals CSV.

    Returns:
        pd.DataFrame: The combined actuals DataFrame (also saved to disk).
    """
    # --- Load cities ---
    cities_df = load_cities(cities_csv)
    if cities_df.empty:
        print("[Error] No cities loaded. Cannot fetch actuals.")
        return pd.DataFrame()

    # --- Resolve date range ---
    if start_date is None or end_date is None:
        auto_start, auto_end = detect_date_range()
        start_date = start_date or auto_start
        end_date = end_date or auto_end

    if not start_date or not end_date:
        print("[Error] Could not determine date range. Pass --start-date / --end-date "
              "or ensure a forecast CSV exists in data/.")
        return pd.DataFrame()

    print(f"[Info] Fetching actuals for {len(cities_df)} cities, "
          f"date range: {start_date} → {end_date}")
    print(f"[Info] Output will be written to: {output_csv}")
    print()

    # --- Fetch per city ---
    frames = []
    success_count = 0
    fail_count = 0

    for idx, row in cities_df.iterrows():
        city = row["city"]
        lat = float(row["latitude"])
        lon = float(row["longitude"])
        label = f"[{idx + 1}/{len(cities_df)}]"

        print(f"{label} Fetching actuals for {city} ({lat}, {lon})...")
        df = fetch_city_actuals(city, lat, lon, start_date, end_date)

        if df is not None and not df.empty:
            frames.append(df)
            success_count += 1
            print(f"  ✓ {len(df)} hourly records")
        else:
            fail_count += 1

        # Polite delay
        if idx < len(cities_df) - 1:
            time.sleep(REQUEST_DELAY)

    if not frames:
        print("[Error] No actuals data fetched for any city.")
        return pd.DataFrame()

    combined = pd.concat(frames, ignore_index=True)

    # --- Save ---
    os.makedirs(os.path.dirname(output_csv) or ".", exist_ok=True)
    combined.to_csv(output_csv, index=False)

    # --- Summary ---
    print()
    print("=" * 60)
    print("  FETCH ACTUALS — SUMMARY")
    print("=" * 60)
    print(f"  Cities succeeded : {success_count}")
    print(f"  Cities failed    : {fail_count}")
    print(f"  Total rows       : {len(combined):,}")
    print(f"  Date range       : {start_date} → {end_date}")
    print(f"  Output file      : {output_csv}")
    print("=" * 60)

    return combined


# ---------------------------------------------------------------------------
# CLI interface
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="Fetch real historical weather actuals from Open-Meteo archive API."
    )
    parser.add_argument(
        "--start-date", type=str, default=None,
        help="Start date (YYYY-MM-DD). Auto-detected from forecast CSV if omitted."
    )
    parser.add_argument(
        "--end-date", type=str, default=None,
        help="End date (YYYY-MM-DD). Auto-detected from forecast CSV if omitted."
    )
    parser.add_argument(
        "--cities-csv", type=str, default=CITIES_CSV,
        help=f"Path to cities CSV (default: {CITIES_CSV})."
    )
    parser.add_argument(
        "--output-csv", type=str, default=OUTPUT_CSV,
        help=f"Output CSV path (default: {OUTPUT_CSV})."
    )
    args = parser.parse_args()

    result = fetch_all_actuals(
        start_date=args.start_date,
        end_date=args.end_date,
        cities_csv=args.cities_csv,
        output_csv=args.output_csv,
    )

    if result.empty:
        sys.exit(1)


if __name__ == "__main__":
    main()
