"""
Fetch elevation data for all cities from Open-Meteo Free Elevation API.
Reads: data/cities.csv
Writes: data/cities_with_elevation.csv
"""

import os
import sys
import time
import requests
import pandas as pd

def main():
    # Resolve base directory (repository root)
    script_dir = os.path.dirname(os.path.abspath(__file__))
    base_dir = os.path.dirname(script_dir)
    input_path = os.path.join(base_dir, 'data', 'cities.csv')
    output_path = os.path.join(base_dir, 'data', 'cities_with_elevation.csv')

    if not os.path.exists(input_path):
        raise FileNotFoundError(f"Input file not found: {input_path}")

    # 1. Load data/cities.csv
    df = pd.read_csv(input_path)
    expected_cols = ['city', 'latitude', 'longitude']
    if list(df.columns) != expected_cols:
        raise ValueError(f"Unexpected columns in {input_path}. Expected {expected_cols}, got {list(df.columns)}")

    initial_len = len(df)
    if initial_len != 45:
        raise ValueError(f"Expected 45 cities in {input_path}, found {initial_len}")

    # 2. Prepare batch query parameters for Open-Meteo Elevation API
    lat_str = ','.join(df['latitude'].astype(str))
    lon_str = ','.join(df['longitude'].astype(str))
    url = f"https://api.open-meteo.com/v1/elevation?latitude={lat_str}&longitude={lon_str}"

    elevations = None
    max_retries = 3

    for attempt in range(1, max_retries + 1):
        try:
            resp = requests.get(url, headers={'User-Agent': 'WeatherApp/1.0'}, timeout=30)
            if resp.status_code == 429:
                sleep_sec = 2 * attempt
                print(f"[Notice] HTTP 429 Rate limited. Retrying in {sleep_sec}s (attempt {attempt}/{max_retries})...")
                time.sleep(sleep_sec)
                continue

            resp.raise_for_status()
            data = resp.json()
            elevations = data.get('elevation')
            break
        except Exception as e:
            if attempt == max_retries:
                print(f"[Error] Failed to fetch elevation data after {max_retries} attempts: {e}")
                raise
            time.sleep(2)

    if elevations is None:
        raise RuntimeError("Open-Meteo Elevation API response did not contain an 'elevation' key.")

    if len(elevations) != initial_len:
        raise RuntimeError(f"API returned {len(elevations)} elevations, expected {initial_len}.")

    # 3. Check for any missing or None values per city
    for idx, (city, elev) in enumerate(zip(df['city'], elevations)):
        if elev is None or pd.isna(elev):
            print(f"[Error] Failed to obtain elevation for city: {city} (Index {idx})")
            raise RuntimeError(f"Missing elevation value for city '{city}'. Aborting without saving.")

    # 4. Construct output dataframe preserving row order and original columns
    df_out = df.copy()
    df_out['elevation_m'] = elevations

    # 5. Assertions (raise clear error, never auto-fix)
    assert len(df_out) == initial_len == 45, f"Row count mismatch: expected 45, got {len(df_out)}"
    assert not df_out['elevation_m'].isna().any(), "Assertion failed: elevation_m contains NaN values"
    assert ((df_out['elevation_m'] >= -10) & (df_out['elevation_m'] <= 9000)).all(), (
        "Assertion failed: elevation_m contains values outside the plausible range [-10, 9000] meters."
    )

    # 6. Write to data/cities_with_elevation.csv
    df_out.to_csv(output_path, index=False)
    print(f"[Success] Saved {len(df_out)} cities with elevation to: {output_path}\n")

    # 7. Print table of all 45 cities sorted by elevation_m descending
    sorted_df = df_out.sort_values(by='elevation_m', ascending=False).reset_index(drop=True)
    pd.set_option('display.max_rows', 50)
    pd.set_option('display.width', 1000)
    print("=" * 60)
    print("45 CITIES SORTED BY ELEVATION (METERS DESCENDING)")
    print("=" * 60)
    print(sorted_df[['city', 'latitude', 'longitude', 'elevation_m']].to_string(index=True))
    print("=" * 60)

if __name__ == '__main__':
    main()
