"""
fetch_history.py - Fetch Historical Forecasts and ERA5 Actual Observations from Open-Meteo

Fetches:
1. data/forecast_history.csv (Historical forecasts for ECMWF, GFS, ICON, GEM)
2. data/actual_history.csv (ERA5 reanalysis actual weather observations)

Period: Last 60 days ending 7 days before today.
Timezone: Asia/Kolkata
"""

import sys
import requests
import pandas as pd
from datetime import datetime, timedelta


CITIES_CSV = "data/cities.csv"
FORECAST_HIST_CSV = "data/forecast_history.csv"
ACTUAL_HIST_CSV = "data/actual_history.csv"

HIST_FC_URL = "https://historical-forecast-api.open-meteo.com/v1/forecast"
ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive"

MODELS = ["ecmwf_ifs025", "gfs_seamless", "icon_seamless", "gem_seamless"]


def get_date_range():
    today = datetime.now().date()
    end_date = today - timedelta(days=7)
    start_date = end_date - timedelta(days=60)
    return start_date.strftime("%Y-%m-%d"), end_date.strftime("%Y-%m-%d")


def load_cities():
    try:
        return pd.read_csv(CITIES_CSV)
    except Exception as e:
        print(f"Error loading {CITIES_CSV}: {e}")
        sys.exit(1)


import time

def fetch_with_retry(url, params, max_retries=5, timeout=60):
    headers = {"User-Agent": "SIH-WeatherAI/1.0"}
    for attempt in range(1, max_retries + 1):
        try:
            res = requests.get(url, params=params, headers=headers, timeout=timeout)
            if res.status_code == 200:
                return res
            elif res.status_code == 429:
                print(f"Rate limited (429). Retrying in {attempt * 3} seconds...")
                time.sleep(attempt * 3)
            else:
                print(f"HTTP {res.status_code} received. Attempt {attempt}/{max_retries}...")
                time.sleep(2)
        except (requests.exceptions.RequestException, Exception) as e:
            print(f"Request exception on attempt {attempt}/{max_retries}: {e}")
            if attempt < max_retries:
                time.sleep(attempt * 2)
            else:
                raise e
    return None


def fetch_forecast_history(cities_df, start_date, end_date):
    records = []
    total_cities = len(cities_df)

    for idx, row in cities_df.iterrows():
        city = row["city"]
        lat = row["latitude"]
        lon = row["longitude"]
        print(f"[{idx+1}/{total_cities}] Fetching historical forecast for {city}...")

        params = {
            "latitude": lat,
            "longitude": lon,
            "start_date": start_date,
            "end_date": end_date,
            "hourly": "temperature_2m,precipitation,wind_speed_10m",
            "models": ",".join(MODELS),
            "timezone": "Asia/Kolkata"
        }

        res = fetch_with_retry(HIST_FC_URL, params=params, max_retries=5, timeout=60)
        if res is None or res.status_code != 200:
            status = res.status_code if res else "No Response"
            print(f"API Error fetching forecast history for {city}: HTTP {status}")
            sys.exit(1)

        data = res.json().get("hourly", {})
        times = data.get("time", [])

        if not times:
            print(f"API Error: No timestamps returned for forecast history of {city}")
            sys.exit(1)

        for model in MODELS:
            temp_key = f"temperature_2m_{model}" if f"temperature_2m_{model}" in data else "temperature_2m"
            precip_key = f"precipitation_{model}" if f"precipitation_{model}" in data else "precipitation"
            wind_key = f"wind_speed_10m_{model}" if f"wind_speed_10m_{model}" in data else "wind_speed_10m"

            temps = data.get(temp_key, [])
            precips = data.get(precip_key, [])
            winds = data.get(wind_key, [])

            if not (len(times) == len(temps) == len(precips) == len(winds)):
                print(f"API Error: Data array length mismatch for {city} model {model}")
                sys.exit(1)

            for i in range(len(times)):
                dt_str = times[i][:16]
                records.append({
                    "city": city,
                    "model": model,
                    "datetime": dt_str,
                    "temperature": temps[i],
                    "rainfall": precips[i],
                    "wind_speed": winds[i]
                })

    df = pd.DataFrame(records)
    df.to_csv(FORECAST_HIST_CSV, index=False)
    print(f"Successfully saved {len(df)} forecast history records to {FORECAST_HIST_CSV}")
    return df


def fetch_actual_history(cities_df, start_date, end_date):
    records = []
    total_cities = len(cities_df)

    for idx, row in cities_df.iterrows():
        city = row["city"]
        lat = row["latitude"]
        lon = row["longitude"]
        print(f"[{idx+1}/{total_cities}] Fetching ERA5 actual history for {city}...")

        params = {
            "latitude": lat,
            "longitude": lon,
            "start_date": start_date,
            "end_date": end_date,
            "hourly": "temperature_2m,precipitation,wind_speed_10m",
            "timezone": "Asia/Kolkata"
        }

        res = fetch_with_retry(ARCHIVE_URL, params=params, max_retries=5, timeout=60)
        if res is None or res.status_code != 200:
            status = res.status_code if res else "No Response"
            print(f"API Error fetching ERA5 actual history for {city}: HTTP {status}")
            sys.exit(1)

        data = res.json().get("hourly", {})
        times = data.get("time", [])
        temps = data.get("temperature_2m", [])
        precips = data.get("precipitation", [])
        winds = data.get("wind_speed_10m", [])

        if not (len(times) == len(temps) == len(precips) == len(winds)) or len(times) == 0:
            print(f"API Error: ERA5 Data array length mismatch or empty response for {city}")
            sys.exit(1)

        for i in range(len(times)):
            dt_str = times[i][:16]
            records.append({
                "city": city,
                "datetime": dt_str,
                "actual_temperature": temps[i],
                "actual_rainfall": precips[i],
                "actual_wind": winds[i]
            })

    df = pd.DataFrame(records)
    df.to_csv(ACTUAL_HIST_CSV, index=False)
    print(f"Successfully saved {len(df)} actual history records to {ACTUAL_HIST_CSV}")
    return df


def main():
    start_date, end_date = get_date_range()
    print(f"Fetching historical datasets from {start_date} to {end_date} (Timezone: Asia/Kolkata)...")
    cities_df = load_cities()
    fetch_forecast_history(cities_df, start_date, end_date)
    fetch_actual_history(cities_df, start_date, end_date)


if __name__ == "__main__":
    main()
