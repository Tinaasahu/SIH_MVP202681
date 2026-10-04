"""
fetch_history_extra_models_lead.py - Fetch Lead-Time Forecasts for UKMO and JMA from Open-Meteo Previous Runs API

Source: https://previous-runs-api.open-meteo.com/v1/forecast
Models: ukmo_seamless, jma_seamless
Lead offsets: previous_day1 (24h), previous_day2 (48h), previous_day3 (72h)
Date range: 2026-07-18 to 2026-09-16 (matching actual_history.csv / forecast_history_lead.csv)

Output: data/forecast_history_extra_lead.csv
Columns: city, model, datetime, lead_days, temperature, rainfall, wind_speed
"""

import os
import sys
import time
import requests
import pandas as pd

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
BASE_DIR = os.path.dirname(SCRIPT_DIR)
CITIES_CSV = os.path.join(BASE_DIR, "data", "cities.csv")
OUTPUT_CSV = os.path.join(BASE_DIR, "data", "forecast_history_extra_lead.csv")

PREV_RUNS_URL = "https://previous-runs-api.open-meteo.com/v1/forecast"
MODELS = ["ukmo_seamless", "jma_seamless"]
LEAD_DAYS = [1, 2, 3]

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


def fetch_with_retry(url, params, max_retries=6, timeout=90):
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
                print(f"  HTTP {res.status_code}. Attempt {attempt}/{max_retries}. Response: {res.text[:200]}")
                time.sleep(3)
        except requests.exceptions.RequestException as e:
            print(f"  Request exception on attempt {attempt}/{max_retries}: {e}")
            if attempt < max_retries:
                time.sleep(attempt * 3)
            else:
                raise
    return None


def build_hourly_vars():
    """Build the comma-separated hourly variable string with previous_dayN suffix."""
    base_vars = ["temperature_2m", "precipitation", "wind_speed_10m"]
    parts = []
    for var in base_vars:
        for day in LEAD_DAYS:
            parts.append(f"{var}_previous_day{day}")
    return ",".join(parts)


def fetch_city_data(city, lat, lon, active_models):
    """Fetch all lead-time data for one city across all active extra models."""
    hourly_vars = build_hourly_vars()

    params = {
        "latitude": lat,
        "longitude": lon,
        "start_date": START_DATE,
        "end_date": END_DATE,
        "hourly": hourly_vars,
        "models": ",".join(active_models),
        "timezone": "Asia/Kolkata",
    }

    res = fetch_with_retry(PREV_RUNS_URL, params)
    if res is None or res.status_code != 200:
        status = res.status_code if res else "No Response"
        err = res.text[:200] if res else ""
        print(f"[FATAL] API error for {city}: HTTP {status} - {err}")
        sys.exit(1)

    data = res.json().get("hourly", {})
    times = data.get("time", [])

    if not times:
        print(f"[FATAL] No timestamps returned for {city}")
        sys.exit(1)

    records = []
    for model in active_models:
        for lead in LEAD_DAYS:
            # Primary key format: {var}_previous_day{N}_{model}
            temp_key = f"temperature_2m_previous_day{lead}_{model}"
            precip_key = f"precipitation_previous_day{lead}_{model}"
            wind_key = f"wind_speed_10m_previous_day{lead}_{model}"

            temps = data.get(temp_key, [])
            precips = data.get(precip_key, [])
            winds = data.get(wind_key, [])

            # Fallback if single-model query omits model suffix
            if not temps:
                temps = data.get(f"temperature_2m_previous_day{lead}", [])
            if not precips:
                precips = data.get(f"precipitation_previous_day{lead}", [])
            if not winds:
                winds = data.get(f"wind_speed_10m_previous_day{lead}", [])

            if not temps or not precips or not winds:
                print(f"[FATAL] Missing data keys for {city}, model={model}, lead_days={lead}")
                print(f"  Available keys in response: {sorted(data.keys())[:10]}")
                sys.exit(1)

            if not (len(times) == len(temps) == len(precips) == len(winds)):
                print(f"[FATAL] Array length mismatch for {city}, model={model}, lead={lead}")
                sys.exit(1)

            for i in range(len(times)):
                t_val = temps[i]
                p_val = precips[i]
                w_val = winds[i]
                if t_val is None or p_val is None or w_val is None:
                    print(f"[FATAL] Null weather value detected for {city} model {model} lead {lead} at {times[i]}")
                    sys.exit(1)

                dt_str = times[i][:16]
                records.append({
                    "city": city,
                    "model": model,
                    "datetime": dt_str,
                    "lead_days": lead,
                    "temperature": t_val,
                    "rainfall": p_val,
                    "wind_speed": w_val,
                })

    return records


def main():
    print("=" * 70)
    print("Fetching extra lead-time forecasts from Open-Meteo Previous Runs API")
    print(f"Target Models: {MODELS}")
    print(f"Date Range:    {START_DATE} to {END_DATE}")
    print(f"Lead Offsets:  previous_day1, previous_day2, previous_day3 (24h, 48h, 72h)")
    print(f"Timezone:      Asia/Kolkata")
    print("=" * 70)

    cities_df = load_cities()
    active_models = list(MODELS)

    # Initial probe to test both models together
    first_city = cities_df.iloc[0]
    test_params = {
        "latitude": first_city["latitude"],
        "longitude": first_city["longitude"],
        "start_date": START_DATE,
        "end_date": "2026-07-19",
        "hourly": "temperature_2m_previous_day1",
        "models": ",".join(active_models),
        "timezone": "Asia/Kolkata"
    }
    probe_res = fetch_with_retry(PREV_RUNS_URL, test_params)
    if probe_res is None or probe_res.status_code != 200:
        print("[Notice] Initial combined probe failed. Testing models individually...")
        working_models = []
        for m in MODELS:
            m_params = {**test_params, "models": m}
            m_res = fetch_with_retry(PREV_RUNS_URL, m_params)
            if m_res and m_res.status_code == 200:
                working_models.append(m)
            else:
                print(f"[Warning] Model {m} is rejected by Previous Runs API. Reason: {m_res.text if m_res else 'Timeout'}")
        if not working_models:
            print("[FATAL] Neither model is supported by Previous Runs API. Aborting.")
            sys.exit(1)
        active_models = working_models
        print(f"[Fallback Active] Continuing with verified models: {active_models}")
    else:
        print(f"[Verified] Both models {active_models} fully supported by Previous Runs API.")

    all_records = []
    total_cities = len(cities_df)

    for idx, row in cities_df.iterrows():
        city = row["city"]
        lat = row["latitude"]
        lon = row["longitude"]
        print(f"[{idx+1}/{total_cities}] Fetching leads for {city}...")

        records = fetch_city_data(city, lat, lon, active_models)
        all_records.extend(records)

        # Small polite interval between calls
        if idx < total_cities - 1:
            time.sleep(0.4)

    df = pd.DataFrame(all_records)

    # Integrity assertions
    expected_rows = total_cities * 1464 * len(LEAD_DAYS) * len(active_models)
    print(f"\nVerifying row count: expected {expected_rows:,} rows...")
    if len(df) != expected_rows:
        print(f"[FATAL] Row count mismatch: expected {expected_rows}, got {len(df)}. Aborting.")
        sys.exit(1)

    null_counts = df[["temperature", "rainfall", "wind_speed"]].isnull().sum()
    if null_counts.sum() > 0:
        print(f"[FATAL] Null values found:\n{null_counts}")
        sys.exit(1)

    df.to_csv(OUTPUT_CSV, index=False)
    print(f"\n[Success] Successfully saved {len(df):,} records to {OUTPUT_CSV}")
    print(f"Models: {active_models}")
    print(f"Rows: {total_cities} cities x 1464 hours x {len(LEAD_DAYS)} leads x {len(active_models)} models = {len(df):,}")


if __name__ == "__main__":
    main()
