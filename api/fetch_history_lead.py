"""
fetch_history_lead.py - Fetch Lead-Time-Specific Forecasts from Open-Meteo Previous Runs API

Source: https://previous-runs-api.open-meteo.com/v1/forecast

Fetches lead-time forecast data for the same 45 cities, 4 models, and date range
as forecast_history.csv (2026-07-18 to 2026-09-16, hourly, Asia/Kolkata).

Lead offsets: previous_day1 (24h), previous_day2 (48h), previous_day3 (72h)
Variables: temperature_2m, precipitation, wind_speed_10m (each with _previous_dayN suffix)

Output: data/forecast_history_lead.csv
Columns: city, model, datetime, lead_days, temperature, rainfall, wind_speed
"""

import sys
import time
import requests
import pandas as pd


CITIES_CSV = "data/cities.csv"
OUTPUT_CSV = "data/forecast_history_lead.csv"

PREV_RUNS_URL = "https://previous-runs-api.open-meteo.com/v1/forecast"

MODELS = ["ecmwf_ifs025", "gfs_seamless", "icon_seamless", "gem_seamless"]
LEAD_DAYS = [1, 2, 3]

# Fixed date range matching forecast_history.csv
START_DATE = "2026-07-18"
END_DATE = "2026-09-16"


def load_cities():
    try:
        df = pd.read_csv(CITIES_CSV)
        print(f"Loaded {len(df)} cities from {CITIES_CSV}")
        return df
    except Exception as e:
        print(f"Error loading {CITIES_CSV}: {e}")
        sys.exit(1)


def fetch_with_retry(url, params, max_retries=8, timeout=90):
    """Fetch URL with retry on HTTP 429 and transient errors."""
    headers = {"User-Agent": "SIH-WeatherAI/1.0"}
    for attempt in range(1, max_retries + 1):
        try:
            res = requests.get(url, params=params, headers=headers, timeout=timeout)
            if res.status_code == 200:
                return res
            elif res.status_code == 429:
                wait = attempt * 5
                print(f"  Rate limited (429). Retrying in {wait}s... (attempt {attempt}/{max_retries})")
                time.sleep(wait)
            else:
                print(f"  HTTP {res.status_code}. Attempt {attempt}/{max_retries}.")
                print(f"  Response: {res.text[:300]}")
                time.sleep(3)
        except requests.exceptions.RequestException as e:
            print(f"  Request exception on attempt {attempt}/{max_retries}: {e}")
            if attempt < max_retries:
                time.sleep(attempt * 3)
            else:
                raise
    return None


def build_hourly_vars():
    """Build the comma-separated hourly variable string for the API."""
    base_vars = ["temperature_2m", "precipitation", "wind_speed_10m"]
    parts = []
    for var in base_vars:
        for day in LEAD_DAYS:
            parts.append(f"{var}_previous_day{day}")
    return ",".join(parts)


def fetch_city_data(city, lat, lon):
    """Fetch all lead-time data for one city (all models, all leads in one call)."""
    hourly_vars = build_hourly_vars()

    params = {
        "latitude": lat,
        "longitude": lon,
        "start_date": START_DATE,
        "end_date": END_DATE,
        "hourly": hourly_vars,
        "models": ",".join(MODELS),
        "timezone": "Asia/Kolkata",
    }

    res = fetch_with_retry(PREV_RUNS_URL, params)
    if res is None or res.status_code != 200:
        status = res.status_code if res else "No Response"
        print(f"FATAL: API error for {city}: HTTP {status}")
        sys.exit(1)

    data = res.json().get("hourly", {})
    times = data.get("time", [])

    if not times:
        print(f"FATAL: No timestamps returned for {city}")
        sys.exit(1)

    records = []
    for model in MODELS:
        for lead in LEAD_DAYS:
            # Keys are: {var}_previous_day{N}_{model}
            temp_key = f"temperature_2m_previous_day{lead}_{model}"
            precip_key = f"precipitation_previous_day{lead}_{model}"
            wind_key = f"wind_speed_10m_previous_day{lead}_{model}"

            temps = data.get(temp_key, [])
            precips = data.get(precip_key, [])
            winds = data.get(wind_key, [])

            # If model suffix not found, try without suffix (single model response)
            if not temps:
                temp_key_alt = f"temperature_2m_previous_day{lead}"
                temps = data.get(temp_key_alt, [])
            if not precips:
                precip_key_alt = f"precipitation_previous_day{lead}"
                precips = data.get(precip_key_alt, [])
            if not winds:
                wind_key_alt = f"wind_speed_10m_previous_day{lead}"
                winds = data.get(wind_key_alt, [])

            if not temps or not precips or not winds:
                print(f"FATAL: Missing data keys for {city}, model={model}, lead_days={lead}")
                print(f"  Available keys: {sorted(data.keys())}")
                sys.exit(1)

            if not (len(times) == len(temps) == len(precips) == len(winds)):
                print(f"FATAL: Array length mismatch for {city}, model={model}, lead_days={lead}")
                print(f"  times={len(times)}, temps={len(temps)}, precips={len(precips)}, winds={len(winds)}")
                sys.exit(1)

            # Check for NaN values BEFORE adding
            for i in range(len(times)):
                if temps[i] is None or precips[i] is None or winds[i] is None:
                    null_fields = []
                    if temps[i] is None:
                        null_fields.append("temperature")
                    if precips[i] is None:
                        null_fields.append("rainfall")
                    if winds[i] is None:
                        null_fields.append("wind_speed")
                    print(f"FATAL: NaN detected at city={city}, model={model}, lead_days={lead}, "
                          f"datetime={times[i]}, fields={null_fields}")
                    sys.exit(1)

            for i in range(len(times)):
                dt_str = times[i][:16]  # YYYY-MM-DDTHH:MM
                records.append({
                    "city": city,
                    "model": model,
                    "datetime": dt_str,
                    "lead_days": lead,
                    "temperature": temps[i],
                    "rainfall": precips[i],
                    "wind_speed": winds[i],
                })

    return records


def main():
    print(f"Fetching lead-time forecasts from Previous Runs API")
    print(f"  URL: {PREV_RUNS_URL}")
    print(f"  Date range: {START_DATE} to {END_DATE}")
    print(f"  Models: {MODELS}")
    print(f"  Lead offsets: previous_day1, previous_day2, previous_day3")
    print(f"  Timezone: Asia/Kolkata")
    print()

    cities_df = load_cities()
    all_records = []
    total_cities = len(cities_df)

    for idx, row in cities_df.iterrows():
        city = row["city"]
        lat = row["latitude"]
        lon = row["longitude"]
        print(f"[{idx+1}/{total_cities}] Fetching {city} ({lat}, {lon})...")

        records = fetch_city_data(city, lat, lon)
        all_records.extend(records)
        print(f"  -> {len(records)} records")

        # Rate limit: small delay between cities
        if idx < total_cities - 1:
            time.sleep(0.5)

    df = pd.DataFrame(all_records)

    # Final NaN check
    nan_counts = df[["temperature", "rainfall", "wind_speed"]].isnull().sum()
    total_nans = int(nan_counts.sum())
    if total_nans > 0:
        print(f"\nFATAL: {total_nans} NaN values found in final DataFrame!")
        for col, cnt in nan_counts.items():
            if cnt > 0:
                bad = df[df[col].isnull()].groupby(["city", "model", "lead_days"]).size()
                print(f"  {col}: {cnt} NaN rows")
                print(f"  Breakdown:\n{bad}")
        sys.exit(1)

    df.to_csv(OUTPUT_CSV, index=False)
    print(f"\nSuccessfully saved {len(df)} records to {OUTPUT_CSV}")
    print(f"  Expected: {total_cities} cities x 1464 hours x 4 models x 3 leads = {total_cities * 1464 * 4 * 3}")
    print(f"  Actual:   {len(df)}")


if __name__ == "__main__":
    main()
