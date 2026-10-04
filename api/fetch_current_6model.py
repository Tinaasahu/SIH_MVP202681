"""
fetch_current_6model.py - Fetch Current 72-Hour NWP Weather Forecasts for 6 Models from Open-Meteo

Fetches next 72 hours forecast for 6 models:
(ecmwf_ifs025, gfs_seamless, icon_seamless, gem_seamless, ukmo_seamless, jma_seamless)
Timezone: Asia/Kolkata
Output: data/forecast_current_6model.csv
"""

import os
import sys
import time
from pathlib import Path
import requests
import pandas as pd


BASE_DIR = Path(__file__).resolve().parent.parent
CITIES_CSV = BASE_DIR / "data" / "cities.csv"
FORECAST_CURR_CSV = BASE_DIR / "data" / "forecast_current_6model.csv"
OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"
MODELS = [
    "ecmwf_ifs025",
    "gfs_seamless",
    "icon_seamless",
    "gem_seamless",
    "ukmo_seamless",
    "jma_seamless",
]


def load_cities():
    try:
        return pd.read_csv(CITIES_CSV)
    except Exception as e:
        print(f"Error loading {CITIES_CSV}: {e}")
        sys.exit(1)


def fetch_with_retry(url, params, max_retries=5, timeout=25):
    headers = {"User-Agent": "SIH-WeatherAI-6Model/2.0"}
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
        print(f"Attempting batch multi-location query for {total_cities} cities (6 models)...")
        res = fetch_with_retry(OPEN_METEO_URL, params=batch_params, max_retries=3, timeout=30)
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
                                "temperature": temps[i] if i < len(temps) else None,
                                "rainfall": precips[i] if i < len(precips) else None,
                                "wind_speed": winds[i] if i < len(winds) else None
                            })
    except Exception as e:
        print(f"Batch fetch notice ({e}), falling back to city-by-city fetch.")

    # Fallback to city-by-city if batch query failed
    if not records:
        for idx, row in cities_df.iterrows():
            city = row["city"]
            lat = row["latitude"]
            lon = row["longitude"]
            print(f"[{idx+1}/{total_cities}] Fetching current 6-model forecast for {city}...")

            params = {
                "latitude": lat,
                "longitude": lon,
                "forecast_days": 3,
                "hourly": "temperature_2m,precipitation,wind_speed_10m",
                "models": ",".join(MODELS),
                "timezone": "Asia/Kolkata"
            }

            res = fetch_with_retry(OPEN_METEO_URL, params=params, max_retries=5, timeout=20)
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
                    print(f"API Error: Array length mismatch for {city} model {model}")
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

    # Impute missing values within (city, model) group; fail if still missing
    for col in ["temperature", "rainfall", "wind_speed"]:
        df[col] = df.groupby(["city", "model"])[col].ffill().bfill()
        if df[col].isna().any():
            culprits = df[df[col].isna()][["city", "model"]].drop_duplicates().to_dict(orient="records")
            raise RuntimeError(f"Missing data in column '{col}' after (city, model) ffill/bfill for: {culprits}")

    # Strict Assertions
    expected_rows = len(cities_df) * 72 * len(MODELS)  # 45 * 72 * 6 = 19440
    if len(df) != expected_rows:
        raise ValueError(f"Expected {expected_rows} rows, got {len(df)}")
    if df["city"].nunique() != len(cities_df):
        raise ValueError(f"Expected {len(cities_df)} cities, got {df['city'].nunique()}")
    if set(df["model"].unique()) != set(MODELS):
        raise ValueError(f"Models mismatch: {set(df['model'].unique())} vs expected {set(MODELS)}")
    if df.isna().any().any():
        raise ValueError("NaN values detected in 6-model current forecast dataset")

    FORECAST_CURR_CSV.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(FORECAST_CURR_CSV, index=False)
    print(f"Successfully saved {len(df)} 6-model current forecast records to {FORECAST_CURR_CSV}")
    return df


def main():
    print("Fetching current 72-hour NWP forecasts for 6 models (Timezone: Asia/Kolkata)...")
    cities_df = load_cities()
    fetch_current_forecast(cities_df)


if __name__ == "__main__":
    main()
