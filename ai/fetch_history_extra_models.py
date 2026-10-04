"""
fetch_history_extra_models.py - Fetch Historical Forecasts for UK Met Office and JMA from Open-Meteo

Fetches:
data/forecast_history_extra.csv (Historical forecasts for UKMO and JMA)

Period: 2026-07-18 to 2026-09-16 (matching forecast_history.csv / actual_history.csv)
Timezone: Asia/Kolkata
"""

import os
import sys
import time
import requests
import pandas as pd

# Resolve paths relative to base project directory
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
BASE_DIR = os.path.dirname(SCRIPT_DIR)
CITIES_CSV = os.path.join(BASE_DIR, "data", "cities.csv")
OUTPUT_CSV = os.path.join(BASE_DIR, "data", "forecast_history_extra.csv")

HIST_FC_URL = "https://historical-forecast-api.open-meteo.com/v1/forecast"
MODELS = ["ukmo_seamless", "jma_seamless"]

START_DATE = "2026-07-18"
END_DATE = "2026-09-16"


def load_cities():
    try:
        return pd.read_csv(CITIES_CSV)
    except Exception as e:
        print(f"Error loading {CITIES_CSV}: {e}")
        sys.exit(1)


def fetch_with_retry(url, params, max_retries=5, timeout=60):
    headers = {"User-Agent": "SIH-WeatherAI/1.0"}
    for attempt in range(1, max_retries + 1):
        try:
            res = requests.get(url, params=params, headers=headers, timeout=timeout)
            if res.status_code == 200:
                return res
            elif res.status_code == 429:
                sleep_time = attempt * 3
                print(f"Rate limited (429). Retrying in {sleep_time} seconds...")
                time.sleep(sleep_time)
            else:
                print(f"HTTP {res.status_code} received ({res.text[:100]}). Attempt {attempt}/{max_retries}...")
                time.sleep(2)
        except (requests.exceptions.RequestException, Exception) as e:
            print(f"Request exception on attempt {attempt}/{max_retries}: {e}")
            if attempt < max_retries:
                time.sleep(attempt * 2)
            else:
                raise e
    return None


def fetch_forecast_history_extra(cities_df):
    records = []
    total_cities = len(cities_df)

    for idx, row in cities_df.iterrows():
        city = row["city"]
        lat = row["latitude"]
        lon = row["longitude"]
        print(f"[{idx+1}/{total_cities}] Fetching historical forecast (UKMO & JMA) for {city}...")

        params = {
            "latitude": lat,
            "longitude": lon,
            "start_date": START_DATE,
            "end_date": END_DATE,
            "hourly": "temperature_2m,precipitation,wind_speed_10m",
            "models": ",".join(MODELS),
            "timezone": "Asia/Kolkata"
        }

        res = fetch_with_retry(HIST_FC_URL, params=params, max_retries=5, timeout=60)
        if res is None or res.status_code != 200:
            status = res.status_code if res else "No Response"
            err_msg = res.text if res else "No details"
            print(f"[FATAL] API Error fetching forecast history for {city}: HTTP {status} - {err_msg}")
            sys.exit(1)

        data = res.json().get("hourly", {})
        times = data.get("time", [])

        if not times:
            print(f"[FATAL] API Error: No timestamps returned for forecast history of {city}")
            sys.exit(1)

        for model in MODELS:
            temp_key = f"temperature_2m_{model}" if f"temperature_2m_{model}" in data else "temperature_2m"
            precip_key = f"precipitation_{model}" if f"precipitation_{model}" in data else "precipitation"
            wind_key = f"wind_speed_10m_{model}" if f"wind_speed_10m_{model}" in data else "wind_speed_10m"

            temps = data.get(temp_key, [])
            precips = data.get(precip_key, [])
            winds = data.get(wind_key, [])

            if not (len(times) == len(temps) == len(precips) == len(winds)):
                print(f"[FATAL] API Error: Data array length mismatch for {city} model {model}")
                sys.exit(1)

            # Assert no missing / None values in array
            for i in range(len(times)):
                t_val = temps[i]
                p_val = precips[i]
                w_val = winds[i]
                if t_val is None or p_val is None or w_val is None:
                    print(f"[FATAL] Null weather value found for {city} model {model} at {times[i]}")
                    sys.exit(1)

                dt_str = times[i][:16]
                records.append({
                    "city": city,
                    "model": model,
                    "datetime": dt_str,
                    "temperature": t_val,
                    "rainfall": p_val,
                    "wind_speed": w_val
                })

        # Polite interval between requests to preserve API budget
        time.sleep(0.3)

    df = pd.DataFrame(records)

    # Verification before saving
    expected_rows = total_cities * 1464 * len(MODELS)
    if len(df) != expected_rows:
        print(f"[FATAL] Row count mismatch: expected {expected_rows}, got {len(df)}. Aborting without writing file.")
        sys.exit(1)

    df.to_csv(OUTPUT_CSV, index=False)
    print(f"\n[Success] Successfully saved {len(df)} forecast history records to {OUTPUT_CSV}")
    return df


def main():
    print(f"Starting fetch for extra models: {MODELS}")
    print(f"Date range: {START_DATE} to {END_DATE} (Timezone: Asia/Kolkata)...")
    cities_df = load_cities()
    fetch_forecast_history_extra(cities_df)


if __name__ == "__main__":
    main()
