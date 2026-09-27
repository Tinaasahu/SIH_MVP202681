"""
fetch_current.py - Fetch Current 72-Hour NWP Weather Forecasts from Open-Meteo

Fetches next 72 hours forecast for 4 models (ecmwf_ifs025, gfs_seamless, icon_seamless, gem_seamless)
Timezone: Asia/Kolkata
Output: data/forecast_current.csv
"""

import os
import sys
import time
from pathlib import Path
import requests
import pandas as pd


BASE_DIR = Path(__file__).resolve().parent.parent
CITIES_CSV = BASE_DIR / "data" / "cities.csv"
FORECAST_CURR_CSV = BASE_DIR / "data" / "forecast_current.csv"
OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"
MODELS = ["ecmwf_ifs025", "gfs_seamless", "icon_seamless", "gem_seamless"]


def load_cities():
    try:
        return pd.read_csv(CITIES_CSV)
    except Exception as e:
        print(f"Error loading {CITIES_CSV}: {e}")
        sys.exit(1)


def fetch_with_retry(url, params, max_retries=5, timeout=15):
    headers = {"User-Agent": "SIH-WeatherAI/1.0"}
    for attempt in range(1, max_retries + 1):
        try:
            res = requests.get(url, params=params, headers=headers, timeout=timeout)
            if res.status_code == 200:
                time.sleep(0.1)  # Short sleep between API calls to handle rate limits
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


def fetch_current_forecast(cities_df):
    records = []
    total_cities = len(cities_df)

    # First attempt fast multi-location batch request
    lats = ",".join(cities_df["latitude"].astype(str))
    lons = ",".join(cities_df["longitude"].astype(str))
    batch_params = {
        "latitude": lats,
        "longitude": lons,
        "forecast_days": 3,
        "hourly": "temperature_2m,precipitation,wind_speed_10m",
        "models": ",".join(MODELS),
        "timezone": "Asia/Kolkata"
    }

    try:
        res = fetch_with_retry(OPEN_METEO_URL, params=batch_params, max_retries=3, timeout=20)
        if res and res.status_code == 200:
            data_list = res.json()
            if isinstance(data_list, list) and len(data_list) == total_cities:
                print(f"Batch fetch succeeded for all {total_cities} cities.")
                for idx, item in enumerate(data_list):
                    city = cities_df.iloc[idx]["city"]
                    data = item.get("hourly", {})
                    times = data.get("time", [])
                    for model in MODELS:
                        temps = data.get(f"temperature_2m_{model}", data.get("temperature_2m", []))
                        precips = data.get(f"precipitation_{model}", data.get("precipitation", []))
                        winds = data.get(f"wind_speed_10m_{model}", data.get("wind_speed_10m", []))
                        for i in range(len(times)):
                            records.append({
                                "city": city,
                                "model": model,
                                "datetime": times[i][:16],
                                "temperature": temps[i],
                                "rainfall": precips[i],
                                "wind_speed": winds[i]
                            })
    except Exception as e:
        print(f"Batch fetch failed ({e}), falling back to city-by-city fetch.")

    # Fallback to city-by-city if batch query failed
    if not records:
        for idx, row in cities_df.iterrows():
            city = row["city"]
            lat = row["latitude"]
            lon = row["longitude"]
            print(f"[{idx+1}/{total_cities}] Fetching current forecast for {city}...")

            params = {
                "latitude": lat,
                "longitude": lon,
                "forecast_days": 3,
                "hourly": "temperature_2m,precipitation,wind_speed_10m",
                "models": ",".join(MODELS),
                "timezone": "Asia/Kolkata"
            }

            res = fetch_with_retry(OPEN_METEO_URL, params=params, max_retries=5, timeout=15)
            if res is None or res.status_code != 200:
                status = res.status_code if res else "No Response"
                print(f"API Error fetching current forecast for {city}: HTTP {status}")
                sys.exit(1)

            data = res.json().get("hourly", {})
            times = data.get("time", [])

            if not times:
                print(f"API Error: No timestamps returned for current forecast of {city}")
                sys.exit(1)

            for model in MODELS:
                temp_key = f"temperature_2m_{model}" if f"temperature_2m_{model}" in data else "temperature_2m"
                precip_key = f"precipitation_{model}" if f"precipitation_{model}" in data else "precipitation"
                wind_key = f"wind_speed_10m_{model}" if f"wind_speed_10m_{model}" in data else "wind_speed_10m"

                temps = data.get(temp_key, [])
                precips = data.get(precip_key, [])
                winds = data.get(wind_key, [])

                if not (len(times) == len(temps) == len(precips) == len(winds)):
                    print(f"API Error: Current forecast array length mismatch for {city} model {model}")
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
    # Ensure no NaN
    df["temperature"] = df.groupby(["city", "model"])["temperature"].ffill().bfill().fillna(28.0)
    df["rainfall"] = df.groupby(["city", "model"])["rainfall"].ffill().bfill().fillna(0.0)
    df["wind_speed"] = df.groupby(["city", "model"])["wind_speed"].ffill().bfill().fillna(10.0)

    FORECAST_CURR_CSV.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(FORECAST_CURR_CSV, index=False)
    print(f"Successfully saved {len(df)} current forecast records to {FORECAST_CURR_CSV}")
    return df


def main():
    print("Fetching current 72-hour NWP forecasts (Timezone: Asia/Kolkata)...")
    cities_df = load_cities()
    fetch_current_forecast(cities_df)


if __name__ == "__main__":
    main()
